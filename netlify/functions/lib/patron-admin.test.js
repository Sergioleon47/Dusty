// Pruebas del cupo de escaneos con firebase-admin simulado.
//
// Estas funciones no las cubría NADA: el workflow de CI corre las pruebas de
// patron-core/nudgy-core y el chequeo de sintaxis del código del navegador, pero
// netlify/functions/ quedaba afuera — y es donde vive el dinero (cada llamada a
// Claude cuesta) y el acceso de los equipos.
//
// Se simula firebase-admin interceptando require: así corre con `node --test`
// sin credenciales ni red, como el resto de las pruebas del repo.
//
// OJO al escribir casos nuevos: usar un uid de dueño DISTINTO por caso. La caché
// de emails de accountOwnerEmail vive en el módulo y es por uid; reusando el
// mismo dueño, todos los casos leen el email del primero y la prueba pasa en
// verde por el motivo equivocado (pasó al escribirla).
const { test } = require('node:test');
const assert = require('node:assert');
const Module = require('module');
const real = Module._load;
let USUARIOS = {}, DOC = {};
const admin = {
  apps: [{}],
  auth: ()=>({ getUser: async (uid)=>{ if(!USUARIOS[uid]) throw new Error('no existe'); return USUARIOS[uid]; } }),
  firestore: ()=>({
    doc: (path)=>({ path }),
    runTransaction: async (fn)=>fn({
      get: async (ref)=>({ exists: !!DOC[ref.path], data: ()=>DOC[ref.path]||{} }),
      set: (ref, val)=>{ DOC[ref.path]=Object.assign({}, DOC[ref.path], val); }
    })
  }),
  credential:{cert:()=>({})}, initializeApp:()=>({})
};
Module._load = function(req, ...rest){ return req==='firebase-admin' ? admin : real.call(this, req, ...rest); };
const lib = require('./patron-admin.js');

(async ()=>{
  const MIEMBRO='uidEmpleado';
  const casos=[]; let seq=0;
  // uid DISTINTO por caso: la caché de emails vive en el módulo y es por uid, así
  // que reusar el mismo dueño hacía que todos los casos leyeran el primer email.
  const correr = async (nombre, {emailDueno, emailCaller, callerUid, usados}) => {
    const OWNER = 'uidDueno'+(++seq);
    USUARIOS = { [OWNER]: {email: emailDueno} };
    DOC = { [`users/${OWNER}/meta/billing`]: {scansUsed: usados, scansPeriod: new Date().getUTCFullYear()+'-'+String(new Date().getUTCMonth()+1).padStart(2,'0')} };
    const caller = {uid: callerUid==='OWNER' ? OWNER : callerUid, isAnonymous:false, emailVerified:true, email:emailCaller};
    const r = await lib.reserveScanQuota(OWNER, caller);
    casos.push({caso:nombre, permitido:r.allowed, ilimitado:!!r.unlimited, limite:r.limit, usados:r.used});
  };

  // El dueño tiene el pase (su email está en la lista por defecto)
  const PASE='sergioleon47@hotmail.com';
  await correr('dueño con pase, contador agotado', {emailDueno:PASE, emailCaller:PASE, callerUid:'OWNER', usados:60});
  await correr('EMPLEADO en cuenta con pase, contador agotado', {emailDueno:PASE, emailCaller:'empleado@gmail.com', callerUid:MIEMBRO, usados:60});
  await correr('empleado en cuenta SIN pase, contador agotado', {emailDueno:'otro@gmail.com', emailCaller:'empleado@gmail.com', callerUid:MIEMBRO, usados:60});
  await correr('empleado en cuenta SIN pase, con cupo libre', {emailDueno:'otro@gmail.com', emailCaller:'empleado@gmail.com', callerUid:MIEMBRO, usados:3});
  const esperado = [
    {caso:'dueño con pase, contador agotado',            permitido:true,  ilimitado:true},
    {caso:'EMPLEADO en cuenta con pase, contador agotado',permitido:true,  ilimitado:true},
    {caso:'empleado en cuenta SIN pase, contador agotado',permitido:false, ilimitado:false},
    {caso:'empleado en cuenta SIN pase, con cupo libre',  permitido:true,  ilimitado:false},
  ];
  esperado.forEach((e,i)=>{
    test(e.caso, ()=>{
      assert.strictEqual(casos[i].permitido, e.permitido);
      assert.strictEqual(casos[i].ilimitado, e.ilimitado);
    });
  });
})();

/* ---------- presupuesto de tiempo (auditoría de datos 2026-09-12) ---------- */
test('remainingBudgetMs descuenta lo transcurrido y nunca baja de cero', ()=>{
  assert.strictEqual(lib.remainingBudgetMs(1000, 24000, 1000), 24000);
  assert.strictEqual(lib.remainingBudgetMs(1000, 24000, 11000), 14000);
  assert.strictEqual(lib.remainingBudgetMs(1000, 24000, 99000), 0);
  // Sin presupuesto explícito usa el de la función (>= 3 s por construcción).
  assert.ok(lib.remainingBudgetMs(Date.now()) >= 3000 - 5);
  assert.strictEqual(lib.FUNCTION_BUDGET_MS >= 3000, true);
});
test('isAbortError reconoce el aborto por tiempo y nada más', ()=>{
  assert.strictEqual(lib.isAbortError({name:'AbortError'}), true);
  assert.strictEqual(lib.isAbortError({name:'TimeoutError'}), true);
  assert.strictEqual(lib.isAbortError(new Error('boom')), false);
  assert.strictEqual(lib.isAbortError(null), false);
});
test('upstreamTimeoutResponse es un 504 con código estable para el cliente', ()=>{
  const r = lib.upstreamTimeoutResponse();
  assert.strictEqual(r.statusCode, 504);
  assert.strictEqual(JSON.parse(r.body).code, 'upstream_timeout');
});
test('la relectura con el modelo grande solo se intenta si la primera lectura fue rápida', ()=>{
  const { canEscalate, weakReasons } = require('../extract-receipt.js');
  assert.strictEqual(canEscalate(2000), true);
  assert.strictEqual(canEscalate(8999), true);
  assert.strictEqual(canEscalate(9000), false);
  assert.strictEqual(canEscalate(30000), false);
  assert.strictEqual(canEscalate(NaN), false);
  // y weakReasons sigue decidiendo cuándo hace falta releer
  assert.deepStrictEqual(weakReasons({supplier:'X', invoice_total: 10, items:[{total_price: 10, confidence:'alta'}]}, false), []);
  assert.ok(weakReasons({supplier:'X', items:[{total_price: 10}]}, false).includes('no_total'));
});

/* ---------- CUPO DEL AGENTE POR PLAN (2026-09-16) ----------
   El contador existía, pero su tope era una constante plana en agent.js: el plan
   más caro y la cuenta sin plan tenían las mismas 600 vueltas. Estas pruebas
   fijan que el plan mande, que un email sin verificar no valga lo mismo que uno
   verificado, y que el trial cuente de por vida y no por mes.
   OJO: uid de dueño DISTINTO por caso, por la caché de emails del módulo. */
const PERIODO = new Date().getUTCFullYear()+'-'+String(new Date().getUTCMonth()+1).padStart(2,'0');
const conDoc = (uid, doc)=>{ USUARIOS = { [uid]: {email:'dueno'+uid+'@gmail.com'} }; DOC = { [`users/${uid}/meta/billing`]: doc }; };
const persona = (uid, extra)=>Object.assign({uid, isAnonymous:false, emailVerified:true, email:'x'+uid+'@gmail.com'}, extra||{});

test('agentLimitFor: manda el plan; sin plan cae al tope por defecto', ()=>{
  const yo = persona('u1');
  assert.strictEqual(lib.agentLimitFor({plan:'starter'}, yo, 'u1'), 100);
  assert.strictEqual(lib.agentLimitFor({plan:'pro'},     yo, 'u1'), 300);
  assert.strictEqual(lib.agentLimitFor({plan:'negocio'}, yo, 'u1'), 500);
  assert.strictEqual(lib.agentLimitFor({plan:'equipo'},  yo, 'u1'), 800);
  // Sin plan: el default de hoy (600). Es MÁS que starter a propósito hasta que
  // se abra el cobro — ver el comentario de DEFAULT_AGENT_LIMIT.
  assert.strictEqual(lib.agentLimitFor({}, yo, 'u1'), 600);
  assert.strictEqual(lib.agentLimitFor({plan:'inventado'}, yo, 'u1'), 600);
});

test('agentLimitFor: email sin verificar vale menos, pero solo en su propia cuenta', ()=>{
  const sinVerificar = persona('u2', {emailVerified:false});
  // Contra su propia cuenta: cupo reducido (la puerta barata al abuso).
  assert.strictEqual(lib.agentLimitFor({}, sinVerificar, 'u2'), 60);
  // Como MIEMBRO del equipo de otro: gasta el cupo del dueño, con el plan del dueño.
  assert.strictEqual(lib.agentLimitFor({plan:'pro'}, sinVerificar, 'duenoAjeno'), 300);
  assert.strictEqual(lib.agentLimitFor({}, sinVerificar, 'duenoAjeno'), 600);
  // Un plan pago tampoco se castiga por no haber verificado.
  assert.strictEqual(lib.agentLimitFor({plan:'starter'}, sinVerificar, 'u2'), 100);
});

test('agentLimitFor: el trial anónimo tiene tope propio, sin mirar el plan', ()=>{
  const anon = {uid:'u3', isAnonymous:true, emailVerified:false, email:null};
  assert.strictEqual(lib.agentLimitFor({}, anon, 'u3'), 60);
  assert.strictEqual(lib.agentLimitFor({plan:'equipo'}, anon, 'u3'), 60);
});

test('reserveAgentTurn: descuenta una vuelta y frena al llegar al tope del plan', async ()=>{
  conDoc('ag1', {plan:'starter', agentUsed:99, agentPeriod:PERIODO, agentTotal:99});
  const yo = persona('ag1');
  const ok = await lib.reserveAgentTurn('ag1', yo);
  assert.strictEqual(ok.allowed, true);
  assert.strictEqual(ok.limit, 100);
  assert.strictEqual(ok.used, 100);
  assert.strictEqual(DOC['users/ag1/meta/billing'].agentUsed, 100);
  // La 101 ya no entra, y no incrementa nada.
  const no = await lib.reserveAgentTurn('ag1', yo);
  assert.strictEqual(no.allowed, false);
  assert.strictEqual(DOC['users/ag1/meta/billing'].agentUsed, 100);
});

test('reserveAgentTurn: un período viejo arranca de cero, no acumula del mes pasado', async ()=>{
  conDoc('ag2', {plan:'starter', agentUsed:100, agentPeriod:'2020-01', agentTotal:100});
  const r = await lib.reserveAgentTurn('ag2', persona('ag2'));
  assert.strictEqual(r.allowed, true);
  assert.strictEqual(r.used, 1, 'el contador del mes arranca de nuevo');
  assert.strictEqual(DOC['users/ag2/meta/billing'].agentTotal, 101, 'el acumulado histórico sigue subiendo');
});

test('reserveAgentTurn: el trial cuenta de POR VIDA, cambiar de mes no lo resetea', async ()=>{
  conDoc('ag3', {agentUsed:0, agentPeriod:'2020-01', agentTotal:60});
  const anon = {uid:'ag3', isAnonymous:true, emailVerified:false, email:null};
  const r = await lib.reserveAgentTurn('ag3', anon);
  assert.strictEqual(r.allowed, false, 'gastó sus 60 vueltas de prueba, el mes nuevo no se las devuelve');
  assert.strictEqual(r.limit, 60);
});

test('refundAgentTurn: devuelve la vuelta solo si el período no cambió', async ()=>{
  conDoc('ag4', {agentUsed:5, agentPeriod:PERIODO, agentTotal:5});
  await lib.refundAgentTurn('ag4', PERIODO);
  assert.strictEqual(DOC['users/ag4/meta/billing'].agentUsed, 4);
  assert.strictEqual(DOC['users/ag4/meta/billing'].agentTotal, 4);

  // El mes rodó entre la reserva y el fallo: tocar agentUsed pisaría el contador
  // del mes NUEVO con un descuento que no le corresponde.
  conDoc('ag5', {agentUsed:2, agentPeriod:PERIODO, agentTotal:99});
  await lib.refundAgentTurn('ag5', '2020-01');
  assert.strictEqual(DOC['users/ag5/meta/billing'].agentUsed, 2, 'el mes nuevo queda intacto');
  assert.strictEqual(DOC['users/ag5/meta/billing'].agentTotal, 98);

  // Reserva del pase del dueño (sin período): no se descontó nada, nada que devolver.
  conDoc('ag6', {agentUsed:7, agentPeriod:PERIODO, agentTotal:7});
  await lib.refundAgentTurn('ag6', null);
  assert.strictEqual(DOC['users/ag6/meta/billing'].agentUsed, 7);
});

test('reserveAgentHop: su tope es el del plan multiplicado por AGENT_MAX_HOPS', async ()=>{
  const tope = 100 * lib.AGENT_MAX_HOPS; // starter
  conDoc('ag7', {plan:'starter', agentHops:tope-1, agentHopsPeriod:PERIODO, agentHopsTotal:tope-1});
  const yo = persona('ag7');
  assert.strictEqual(await lib.reserveAgentHop('ag7', yo), true);
  assert.strictEqual(await lib.reserveAgentHop('ag7', yo), false, 'pasado el tope, la vuelta de herramientas se corta');
  // Y no toca el contador de vueltas de USUARIO: son cupos distintos.
  assert.strictEqual(DOC['users/ag7/meta/billing'].agentUsed, undefined);
});
