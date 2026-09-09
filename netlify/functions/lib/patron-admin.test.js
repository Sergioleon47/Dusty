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
// Desde firebase-admin 14 cada servicio vive en su propio subcamino y el paquete
// raíz ya no los expone, así que se simula subcamino por subcamino — igual que los
// requires reales de patron-admin.js. Si mañana la biblioteca vuelve a
// require('firebase-admin') a secas, estas simulaciones dejan de aplicarse y las
// pruebas fallan en vez de pasar contra el SDK de verdad: es lo que se quiere.
const db = {
  doc: (path)=>({ path }),
  runTransaction: async (fn)=>fn({
    get: async (ref)=>({ exists: !!DOC[ref.path], data: ()=>DOC[ref.path]||{} }),
    set: (ref, val)=>{ DOC[ref.path]=Object.assign({}, DOC[ref.path], val); }
  })
};
const auth = { getUser: async (uid)=>{ if(!USUARIOS[uid]) throw new Error('no existe'); return USUARIOS[uid]; } };
const MODULOS = {
  'firebase-admin/app': { initializeApp:()=>({}), getApps:()=>[{}], cert:()=>({}) },
  'firebase-admin/auth': { getAuth: ()=>auth },
  'firebase-admin/firestore': { getFirestore: ()=>db, Timestamp:{ fromMillis:(ms)=>({ ms }) } },
  'firebase-admin/storage': { getStorage: ()=>({ bucket: ()=>({}) }) }
};
Module._load = function(req, ...rest){
  return Object.prototype.hasOwnProperty.call(MODULOS, req) ? MODULOS[req] : real.call(this, req, ...rest);
};
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
