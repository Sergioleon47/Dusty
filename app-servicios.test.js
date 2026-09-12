// app-servicios.test.js
//
// Pruebas del MODO SERVICIOS (app-15): contratos que se repiten, cobros, notas del
// calendario y el tope del historial de salidas. Se corren con `node --test`.
//
// Por qué existe. La auditoría del módulo de Servicios (2026-09-12) encontró
// fallos que ninguna prueba veía porque app-15 nunca se cargaba en un arnés:
//   1. "cada mes" desde el 31 derivaba al 28 para siempre (Feb 28 → Mar 28 → Abr 28);
//   2. un contrato con fecha de hace años (un dígito mal) creaba 60 trabajos
//      pasados, todos como cobros vencidos, en cada guardado;
//   3. cambiar la fecha o la frecuencia del contrato dejaba vivas las ocurrencias
//      futuras de la regla vieja: cobros duplicados;
//   4. dos teléfonos sin conexión generaban la misma ocurrencia con ids distintos
//      y la nube se quedaba con las dos;
//   5. un trabajo SIN COBRAR desaparecía de Por cobrar al pasar las 400 salidas;
//   6. des-cobrar un trabajo por error no devolvía su nota 💵 al calendario.
//
// Cómo. Mismo arnés que app-dinero.test.js (vm con lo mínimo del navegador) más
// app-15 encima; la fecha de "hoy" se congela con una clase Date falsa para que las
// pruebas no dependan del día en que se corren.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function nuevaApp(hoy){
  const guardado = {};
  const localStorage = {
    getItem: k => (k in guardado ? guardado[k] : null),
    setItem: (k,v) => { guardado[k] = String(v); },
    removeItem: k => { delete guardado[k]; }
  };
  const elemento = { style:{}, value:'', checked:false, classList:{add(){},remove(){},toggle(){}},
    addEventListener(){}, removeEventListener(){}, appendChild(){}, remove(){}, click(){},
    getBoundingClientRect: () => ({height:0,width:0}), closest: () => null, dataset:{} };
  const sandbox = {
    console, Math, Date, JSON, parseInt, parseFloat, isNaN, isFinite, Number, String,
    Boolean, Array, Object, Set, Map, Promise, RegExp, Error, Intl,
    encodeURIComponent, decodeURIComponent, setTimeout, clearTimeout, setInterval, clearInterval,
    requestAnimationFrame: cb => setTimeout(cb, 0),
    localStorage,
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
      createElement: () => elemento, addEventListener(){}, body: elemento, documentElement: elemento, visibilityState: 'visible' },
    navigator: { onLine: true, language: 'es' },
    location: { protocol:'https:', href:'https://x/', origin:'https://x' },
    fetch: () => Promise.reject(new Error('sin red')),
    __confirms: [], __avisos: []
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox);
  const correr = (codigo, nombre) => vm.runInContext(codigo, sandbox, {filename: nombre || 'prueba'});
  const cargar = f => correr(fs.readFileSync(path.join(__dirname, f), 'utf8'), f);

  correr('var module = {exports:{}};');
  cargar('patron-core.js');
  correr('module = undefined;');
  cargar('app-01-estado.js');
  cargar('app-03-base.js');
  cargar('app-06-modales.js');
  cargar('app-08-produccion.js');
  correr(`
    function confirm(m){ if(__confirms.length===0) throw new Error('confirm() sin respuesta: '+m); return __confirms.shift(); }
    function alert(){}
    function render(){ resetFinancialCache(); }
    function renderApp(){ resetFinancialCache(); }
    function logActivity(){}
    function showToast(m){ __avisos.push(String(m)); }
    function syncUid(){ return null; }
    function currentUserLabel(){ return 'prueba'; }
    function scheduleCloudSync(){}
    function stampLocalEdits(){}
    function checkBudgetAlerts(){}
    function evictOldReceiptPhotos(){}
    function uploadReceiptImages(){}
    function celebrateFirstScan(){}
    function hapticAviso(){}
    function hapticGolpe(){}
    function closeScanModal(){}
    function loadNextQueuedReceipt(){ return false; }
    function finishScanBatch(){}
    function recipesForCloud(){ return recipes; }
    function lastSalePriceFor(){ return ''; }
    function callDustyAI(){ return Promise.reject(new Error('sin red')); }
    function cropToBase64(){ return null; }
    function endAiWait(){}
    function stockIconSvg(){ return ''; }
    function lineIcon(){ return ''; }
    function uploadRecipePhoto(){}
    function openUpgradeModal(){}
    function isTrialUser(){ return false; }
    var currentUser = null;
    var priceAlertThreshold = 15, businessName = '', monthlyBudget = null;
    var budgetMeta = normalizeBudgetMeta(null);
    var bizProfile = normalizeBizProfile(null);
    var profitsVisibleToMembers = false, categories = null, expenseCategories = [];
    var cycleCountPct = 20, cycleCountIntervalDays = 3, cycleCountLastDate = null, cycleCountCursor = 0;
  `);
  cargar('app-15-servicios.js');
  // "Hoy" congelado: new Date() sin argumentos devuelve el día pedido.
  correr(`
    const RealDate = Date;
    Date = class extends RealDate {
      constructor(...a){ if(a.length===0) super('${hoy}T12:00:00'); else super(...a); }
      static now(){ return new RealDate('${hoy}T12:00:00').getTime(); }
    };
    bizProfile.services = true; bizProfile.sells = false;
    outflows = []; receipts = []; calNotes = []; deletedCalNoteIds = [];
    /* Ayudantes */
    function contrato(id, fecha, repeat, extra){
      recordOutflow(Object.assign({id, type:'service', date:fecha, client:'ACME', serviceName:'Servicio', price:100, paid:false,
        dueDate: addDaysStr(fecha, 15), dueDays:15, repeat, items:[], createdAt: fecha+'T00:00:00Z'}, extra||{}));
      return jobById(id);
    }
    function hijos(tplId){ return outflows.filter(o=>o.parentId===tplId && !o.deleted).map(o=>o.date).sort(); }
    function hijosTodos(tplId){ return outflows.filter(o=>o.parentId===tplId).map(o=>o.date+(o.deleted?'(x)':'')).sort(); }
  `);
  // Las listas se devuelven como JSON y se parsean ACÁ: un arreglo creado dentro del vm
  // tiene otro Array.prototype y deepEqual estricto lo rechaza aunque sea igual.
  const lista = (codigo)=> JSON.parse(correr("JSON.stringify("+codigo+")"));
  return { correr, lista, sandbox };
}

test('cada mes desde el 31: cae el 28 de febrero pero vuelve al 31/30 después (no deriva al 28 para siempre)', () => {
  const { correr, lista } = nuevaApp('2026-04-20'); // horizonte: hasta el 4 de mayo
  correr(`contrato('tplA', '2026-01-31', 'monthly'); saveState();`);
  assert.deepEqual(lista(`hijos('tplA')`), ['2026-04-30'], 'la ocurrencia de abril es el 30, no el 28');
  assert.equal(correr(`svcNextDate('2026-02-28', 'monthly', 31)`), '2026-03-31');
  assert.equal(correr(`svcNextDate('2026-03-31', 'monthly', 31)`), '2026-04-30');
  assert.equal(correr(`svcNextDate('2026-02-28', 'monthly')`), '2026-03-28', 'sin ancla se comporta como antes');
});

test('un contrato con fecha de hace años no inventa trabajos pasados: solo los próximos 14 días', () => {
  const { correr, lista } = nuevaApp('2026-04-02');
  correr(`contrato('tplB', '2016-01-04', 'weekly'); saveState(); saveState(); saveState();`);
  assert.deepEqual(lista(`hijos('tplB')`), ['2026-04-06', '2026-04-13']);
  assert.equal(correr(`svcJobs().filter(j=>j.parentId==='tplB' && j.date<'2026-04-02').length`), 0, 'ninguno vencido');
});

test('cambiar la fecha del contrato retira las ocurrencias futuras de la regla vieja y crea las nuevas, sin duplicar', () => {
  const { correr, lista } = nuevaApp('2026-04-02');
  correr(`contrato('tplC', '2026-03-30', 'weekly'); saveState();`); // lunes
  assert.deepEqual(lista(`hijos('tplC')`), ['2026-04-06', '2026-04-13']);
  // El usuario mueve el contrato al martes (mismo camino que el modal: svcAfterJobEdit con regla cambiada).
  correr(`{ const tpl = jobById('tplC'); tpl.date = '2026-03-31'; tpl.lastEditedAt = new Date().toISOString(); svcAfterJobEdit(tpl, true); saveState(); }`);
  assert.deepEqual(lista(`hijos('tplC')`), ['2026-04-07', '2026-04-14'], 'solo martes');
  assert.deepEqual(lista(`hijosTodos('tplC')`), ['2026-04-06(x)', '2026-04-07', '2026-04-13(x)', '2026-04-14'], 'las del lunes quedan retiradas, no borradas del arreglo');
  // Vuelve al lunes: se reviven las mismas (mismo id), no nacen otras con el mismo id.
  correr(`{ const tpl = jobById('tplC'); tpl.date = '2026-03-30'; svcAfterJobEdit(tpl, true); saveState(); }`);
  assert.deepEqual(lista(`hijos('tplC')`), ['2026-04-06', '2026-04-13']);
  assert.equal(correr(`outflows.filter(o=>o.id==='job-tplC-2026-04-06').length`), 1, 'un solo objeto con ese id');
});

test('eliminar el contrato o apagar "Se repite" retira las próximas sin tocar; una ya cobrada o editada a mano se queda', () => {
  const { correr, lista } = nuevaApp('2026-04-02');
  correr(`contrato('tplD', '2026-03-30', 'weekly'); saveState();`);
  correr(`{ const k = outflows.find(o=>o.id==='job-tplD-2026-04-06'); k.paid = true; k.paidDate = '2026-04-02'; k.lastEditedAt = new Date().toISOString(); }`);
  correr(`{ const tpl = jobById('tplD'); tpl.deleted = true; tpl.lastEditedAt = new Date().toISOString(); svcAfterJobDelete(tpl); saveState(); }`);
  assert.deepEqual(lista(`hijos('tplD')`), ['2026-04-06'], 'la cobrada sigue; la del 13 se retiró');
  assert.equal(correr(`svcJobs().length`), 1);
});

test('cambiar el precio del contrato se propaga a las próximas sin tocar, no a las cobradas', () => {
  const { correr, lista } = nuevaApp('2026-04-02');
  correr(`contrato('tplE', '2026-03-30', 'weekly'); saveState();`);
  correr(`{ const k = outflows.find(o=>o.id==='job-tplE-2026-04-06'); k.paid = true; k.lastEditedAt = new Date().toISOString(); }`);
  correr(`{ const tpl = jobById('tplE'); tpl.price = 150; tpl.lastEditedAt = new Date().toISOString(); svcAfterJobEdit(tpl, false); saveState(); }`);
  assert.equal(correr(`outflows.find(o=>o.id==='job-tplE-2026-04-06').price`), 100, 'la cobrada conserva su precio');
  assert.equal(correr(`outflows.find(o=>o.id==='job-tplE-2026-04-13').price`), 150);
  // Y la propagada sigue contando como "sin tocar": un cambio de regla después la retira.
  correr(`{ const tpl = jobById('tplE'); tpl.date = '2026-03-31'; svcAfterJobEdit(tpl, true); saveState(); }`);
  assert.equal(correr(`!!outflows.find(o=>o.id==='job-tplE-2026-04-13').deleted`), true);
});

test('dos dispositivos generan la MISMA ocurrencia con el MISMO id (el merge por id no duplica)', () => {
  const a = nuevaApp('2026-04-02'), b = nuevaApp('2026-04-02');
  a.correr(`contrato('tplF', '2026-03-30', 'weekly'); saveState();`);
  b.correr(`contrato('tplF', '2026-03-30', 'weekly'); saveState();`);
  const idsA = a.correr(`JSON.stringify(outflows.filter(o=>o.parentId==='tplF').map(o=>o.id).sort())`);
  const idsB = b.correr(`JSON.stringify(outflows.filter(o=>o.parentId==='tplF').map(o=>o.id).sort())`);
  assert.equal(idsA, idsB);
  assert.equal(idsA, JSON.stringify(['job-tplF-2026-04-06', 'job-tplF-2026-04-13']));
});

test('una ocurrencia movida de día conserva su fecha programada: la regla no crea otra esa semana', () => {
  const { correr, lista } = nuevaApp('2026-04-02');
  correr(`contrato('tplG', '2026-03-30', 'weekly'); saveState();`);
  correr(`{ const k = outflows.find(o=>o.id==='job-tplG-2026-04-06'); k.date = '2026-04-07'; k.lastEditedAt = new Date().toISOString(); }`);
  correr(`{ const tpl = jobById('tplG'); tpl.lastGenerated = null; saveState(); }`); // como si se recorriera la cadena de nuevo
  assert.deepEqual(lista(`hijos('tplG')`), ['2026-04-07', '2026-04-13']);
});

test('un contrato de varios días repite la misma duración y choca por rango con otro trabajo del mismo equipo', () => {
  const { correr, lista } = nuevaApp('2026-04-02');
  correr(`bizProfile.assets.push({id:'cam1', name:'Camión 1', emoji:'🚚', maint:[], maintLog:[]});`);
  correr(`contrato('tplH', '2026-03-30', 'weekly', {endDate:'2026-04-01', assetId:'cam1'}); saveState();`);
  const kid = correr(`JSON.parse(JSON.stringify(outflows.find(o=>o.id==='job-tplH-2026-04-06')))`);
  assert.equal(kid.endDate, '2026-04-08', 'lunes a miércoles, igual que el contrato');
  assert.equal(correr(`jobCoversDay(outflows.find(o=>o.id==='job-tplH-2026-04-06'), '2026-04-07')`), true);
  assert.equal(correr(`(svcClash({id:null, assetId:'cam1', date:'2026-04-08', endDate:null})||{}).id`), 'job-tplH-2026-04-06', 'el 8 el camión está ocupado');
  assert.equal(correr(`svcClash({id:null, assetId:'cam1', date:'2026-04-09', endDate:'2026-04-12'})`), null);
});

test('un trabajo sin cobrar no desaparece de Por cobrar al pasar las 400 salidas', () => {
  const { correr, lista } = nuevaApp('2026-04-02');
  correr(`contrato('viejo', '2026-01-05', null); for(let i=0;i<450;i++) recordOutflow({id:'adj'+i, type:'adjust', date:'2026-03-01', items:[], createdAt:'2026-03-01T00:00:00Z'});`);
  assert.equal(correr(`outflows.length`), 400);
  assert.equal(correr(`!!jobById('viejo')`), true);
  assert.equal(correr(`collectStats().pending`), 100);
});

test('cobrar quita la nota 💵 del calendario y des-cobrar la devuelve (sin lápida del sistema)', () => {
  const { correr, lista } = nuevaApp('2026-04-02');
  correr(`contrato('j1', '2026-04-01', null); saveState();`);
  assert.equal(correr(`calNotes.filter(n=>n.svcKind==='due').length`), 1);
  correr(`{ const j = jobById('j1'); j.paid = true; j.paidDate = '2026-04-02'; j.dueDate = null; j.lastEditedAt = new Date().toISOString(); saveState(); }`);
  assert.equal(correr(`calNotes.filter(n=>n.svcKind==='due').length`), 0);
  assert.equal(correr(`deletedCalNoteIds.length`), 0, 'la quitó el dato, no el usuario: sin lápida');
  correr(`{ const j = jobById('j1'); j.paid = false; j.paidDate = null; j.dueDate = addDaysStr(j.date, 15); saveState(); }`);
  assert.equal(correr(`calNotes.filter(n=>n.svcKind==='due').length`), 1, 'vuelve la nota de cobro');
  // Lo que el usuario borra a mano sí queda borrado.
  correr(`{ const n = calNotes.find(x=>x.svcKind==='due'); deletedCalNoteIds.push(n.id); calNotes = calNotes.filter(x=>x!==n); saveState(); }`);
  assert.equal(correr(`calNotes.filter(n=>n.svcKind==='due').length`), 0);
});

test('un trabajo de varios días tiene nota el día que empieza (con "hasta") y el día que termina', () => {
  const { correr, lista } = nuevaApp('2026-04-02');
  correr(`contrato('j2', '2026-04-10', null, {endDate:'2026-04-12'}); saveState();`);
  const notas = correr(`JSON.stringify(calNotes.filter(n=>n.jobId==='j2' && n.svcKind==='job').map(n=>n.date).sort())`);
  assert.equal(notas, JSON.stringify(['2026-04-10', '2026-04-12']));
});

test('cobrar y eliminar pasan por un solo camino: sello para la nube, borrado suave que no se abre más', () => {
  const { correr } = nuevaApp('2026-04-02');
  correr(`contrato('j3', '2026-04-01', null); saveState();`);
  assert.equal(correr(`markJobPaid(jobById('j3'))`), true);
  assert.equal(correr(`{ const j = outflows.find(o=>o.id==='j3'); JSON.stringify([j.paid, j.paidDate, j.dueDate, !!j.lastEditedAt]) }`), JSON.stringify([true, '2026-04-02', null, true]));
  assert.equal(correr(`markJobPaid(jobById('j3'))`), true, 'volver a cobrar no rompe');
  correr(`{ const j = jobById('j3'); j.paid = false; j.paidDate = null; j.dueDate = '2026-04-16'; }`);
  assert.equal(correr(`JSON.stringify(deleteJob(jobById('j3')))`), JSON.stringify({pruned: 0, restocked: 0}), 'sin contrato no hay ocurrencias que retirar ni stock que devolver');
  assert.equal(correr(`jobById('j3')`), null, 'un trabajo borrado ya no se encuentra por id');
  assert.equal(correr(`outflows.find(o=>o.id==='j3').deleted`), true, 'pero sigue en el arreglo como lápida');
  assert.equal(correr(`collectStats().pending`), 0);
  assert.equal(correr(`JSON.stringify(deleteJob(outflows.find(o=>o.id==='j3')))`), JSON.stringify({pruned: 0, restocked: 0}), 'borrar dos veces no hace nada');
});

test('la app estuvo cerrada semanas: solo se recuperan los últimos 14 días del contrato, el resto se avisa', () => {
  const { correr, lista } = nuevaApp('2026-04-02');
  // Contrato semanal cuyo último generado fue hace 2 meses (la app no se abrió).
  correr(`contrato('tplI', '2026-01-05', 'weekly', {lastGenerated:'2026-02-02'}); __avisos = []; saveState();`);
  assert.deepEqual(lista(`hijos('tplI')`), ['2026-03-23', '2026-03-30', '2026-04-06', '2026-04-13'], 'desde 14 días atrás hasta 14 adelante');
  assert.equal(correr(`__avisos.some(a=>/saltaron|skipped/.test(a))`), true, 'se avisa cuántas fechas quedaron afuera');
  assert.equal(correr(`svcJobs().filter(j=>j.parentId==='tplI' && j.date<'2026-03-19').length`), 0);
});

test('fechas saltadas: el marcador avanza (no se avisa en cada guardado) y no cuenta las que otro teléfono ya creó', () => {
  const { correr, lista } = nuevaApp('2026-09-12');
  // Contrato mensual del 27; último generado hace dos meses; la próxima (27 sep) cae fuera del horizonte de 14 días.
  correr(`contrato('tplM', '2026-05-27', 'monthly', {lastGenerated:'2026-06-27'}); __avisos = []; saveState();`);
  assert.equal(correr(`__avisos.filter(a=>/saltaron|skipped/.test(a)).length`), 1);
  assert.equal(correr(`jobById('tplM').lastGenerated`), '2026-08-27', 'el marcador quedó en la última saltada');
  correr(`__avisos = []; saveState(); saveState();`);
  assert.equal(correr(`__avisos.filter(a=>/saltaron|skipped/.test(a)).length`), 0, 'no vuelve a avisar');
  // Si la ocurrencia saltada ya existe (vino de otro teléfono), no se cuenta.
  correr(`contrato('tplN', '2026-05-10', 'weekly', {lastGenerated:'2026-07-05'});
    recordOutflow({id:'job-tplN-2026-07-12', type:'service', parentId:'tplN', occDate:'2026-07-12', date:'2026-07-12', client:'ACME', price:100, paid:true, items:[], createdAt:'2026-07-12T00:00:00Z'});
    __avisos = []; saveState();`);
  const aviso = correr(`__avisos.find(a=>/saltaron|skipped/.test(a))||''`);
  assert.equal(/ 6 /.test(aviso), true, 'del 19 jul al 23 ago son 6 fechas sin crear: '+aviso);
});

test('reconciliación: una ocurrencia de la regla vieja que llega de otro teléfono se retira; las tocadas se quedan', () => {
  const { correr, lista } = nuevaApp('2026-04-02');
  correr(`contrato('tplR', '2026-03-31', 'weekly'); saveState();`); // martes: 04-07, 04-14
  // Llega del otro teléfono (regla vieja del lunes) una ocurrencia sin tocar y otra ya cobrada.
  correr(`recordOutflow({id:'job-tplR-2026-04-06', type:'service', parentId:'tplR', occDate:'2026-04-06', date:'2026-04-06', client:'ACME', price:100, paid:false, items:[], createdAt:'2026-04-01T00:00:00Z'});
    recordOutflow({id:'job-tplR-2026-04-13', type:'service', parentId:'tplR', occDate:'2026-04-13', date:'2026-04-13', client:'ACME', price:100, paid:true, paidDate:'2026-04-01', lastEditedAt:'2026-04-01T09:00:00Z', items:[], createdAt:'2026-04-01T00:00:00Z'});
    saveState();`);
  assert.deepEqual(lista(`hijos('tplR')`), ['2026-04-07', '2026-04-13', '2026-04-14'], 'la del 6 se retiró, la cobrada del 13 se queda');
  assert.equal(correr(`!!outflows.find(o=>o.id==='job-tplR-2026-04-06').prunedByRule`), true);
});

test('una fecha que no existe (2026-02-30) no pasa: ni al guardar el trabajo ni como contrato que genera ocurrencias', () => {
  const { correr, lista } = nuevaApp('2026-04-20');
  // Por la puerta de atrás (JSON de otro teléfono / versión vieja): el generador la ignora
  // en vez de dejar que JS la "arregle" al 2 de marzo y nazcan ocurrencias inventadas.
  correr(`contrato('bad', '2026-02-30', 'monthly'); saveState(); saveState();`);
  assert.deepEqual(lista(`hijosTodos('bad')`), []);
  // Por el modal: se rechaza con mensaje, igual que la fecha vacía.
  correr(`draftJob = { id:null, client:'X', serviceName:'', serviceId:null, date:'2026-02-30', endDate:'', assetId:null, price:'0', qty:'', paid:false, paidDate:'', dueDays:15, pending:[], repeat:null, parentId:null };`);
  assert.equal(correr(`saveJobFromDraft()`), null);
  assert.equal(correr(`jobModalError.length>0`), true);
  // Precio 0 con fecha real sí se guarda (visita de garantía).
  correr(`draftJob.date = '2026-04-20';`);
  assert.equal(correr(`!!saveJobFromDraft()`), true);
});

test('svcNextDate: cadena mensual del 31 durante un año entero, bisiesto, y semanas que cruzan el cambio de horario', () => {
  const { correr } = nuevaApp('2026-04-20');
  let d = '2026-01-31'; const seq = [];
  for(let i=0;i<12;i++){ d = correr(`svcNextDate('${d}','monthly',31)`); seq.push(d); }
  assert.deepEqual(seq, ['2026-02-28','2026-03-31','2026-04-30','2026-05-31','2026-06-30','2026-07-31','2026-08-31','2026-09-30','2026-10-31','2026-11-30','2026-12-31','2027-01-31']);
  assert.equal(correr(`svcNextDate('2028-01-30','monthly',30)`), '2028-02-29');
  assert.equal(correr(`svcNextDate('2028-02-29','monthly',30)`), '2028-03-30');
  assert.equal(correr(`svcNextDate('2026-03-02','weekly')`), '2026-03-09');
  assert.equal(correr(`svcNextDate('2026-10-26','biweekly')`), '2026-11-09');
});

/* ---- Auditoría de la auditoría (2026-09-12): segunda pasada sobre los arreglos ---- */

test('reconciliación: una ocurrencia más allá del horizonte de ESTE teléfono (la generó otro con el "hoy" adelantado) no se poda', () => {
  const { correr, lista } = nuevaApp('2026-09-13'); // horizonte: hasta el 27
  correr(`contrato('tplS', '2026-09-07', 'weekly'); saveState();`); // lunes
  assert.deepEqual(lista(`hijos('tplS')`), ['2026-09-14', '2026-09-21']);
  // Llega de la nube la del 28 (el otro teléfono ya estaba en el 14 y la generó): está en la regla, no en el horizonte.
  correr(`recordOutflow({ id: svcChildId('tplS','2026-09-28'), type:'service', date:'2026-09-28', occDate:'2026-09-28', parentId:'tplS', client:'ACME', serviceName:'Servicio', price:100, paid:false, dueDate:'2026-10-13', dueDays:15, items:[], createdAt:'2026-09-14T00:00:00Z' }); saveState(); saveState();`);
  assert.deepEqual(lista(`hijos('tplS')`), ['2026-09-14', '2026-09-21', '2026-09-28'], 'sigue viva');
  // Una de la regla vieja DENTRO del horizonte sí se retira.
  correr(`recordOutflow({ id: svcChildId('tplS','2026-09-16'), type:'service', date:'2026-09-16', occDate:'2026-09-16', parentId:'tplS', client:'ACME', serviceName:'Servicio', price:100, paid:false, dueDate:'2026-10-01', dueDays:15, items:[], createdAt:'2026-09-10T00:00:00Z' }); saveState();`);
  assert.deepEqual(lista(`hijos('tplS')`), ['2026-09-14', '2026-09-21', '2026-09-28']);
});

test('cambiar la frecuencia dos veces el mismo día no deja un cobro de HOY de una regla que ya no existe', () => {
  const { correr, lista } = nuevaApp('2026-04-02'); // jueves
  correr(`contrato('tplT', '2026-03-26', 'weekly'); saveState();`); // jueves → hoy 2, 9 y 16 de abril (horizonte inclusive)
  assert.deepEqual(lista(`hijos('tplT')`), ['2026-04-02', '2026-04-09', '2026-04-16']);
  correr(`{ const tpl = jobById('tplT'); tpl.repeat = 'monthly'; svcAfterJobEdit(tpl, true); saveState(); }`);
  assert.deepEqual(lista(`hijos('tplT')`), [], 'mensual desde el 26/03: la próxima (26/04) cae fuera del horizonte; la de hoy, sin tocar, se retiró');
  correr(`{ const tpl = jobById('tplT'); tpl.repeat = 'weekly'; svcAfterJobEdit(tpl, true); saveState(); }`);
  assert.deepEqual(lista(`hijos('tplT')`), ['2026-04-02', '2026-04-09', '2026-04-16'], 'vuelve a semanal: las mismas tres, revividas con el mismo id');
  assert.equal(correr(`outflows.filter(o=>o.parentId==='tplT').length`), 3);
});

test('abrir una ocurrencia y tocar Guardar sin cambiar nada no la marca como tocada (sigue al contrato y se retira con la regla)', () => {
  const { correr } = nuevaApp('2026-04-02');
  correr(`contrato('tplU', '2026-03-30', 'weekly'); saveState();`);
  const antes = correr(`outflows.find(o=>o.id==='job-tplU-2026-04-06').lastEditedAt || ''`);
  // El arnés no tiene DOM: readJobDraftFromDom no toca el borrador, igual que un usuario que no cambia nada.
  correr(`openJobModal('job-tplU-2026-04-06'); saveJobFromDraft();`);
  assert.equal(correr(`outflows.find(o=>o.id==='job-tplU-2026-04-06').lastEditedAt || ''`), antes, 'sin sello nuevo');
  assert.equal(correr(`svcChildUntouched(outflows.find(o=>o.id==='job-tplU-2026-04-06'))`), true);
  // Un cambio real sí sella.
  correr(`openJobModal('job-tplU-2026-04-06'); draftJob.price = '120'; saveJobFromDraft();`);
  assert.equal(correr(`outflows.find(o=>o.id==='job-tplU-2026-04-06').price`), 120);
  assert.equal(correr(`svcChildUntouched(outflows.find(o=>o.id==='job-tplU-2026-04-06'))`), false);
});

test('registrar un mantenimiento: el historial conserva el nombre aunque se borre el plan, y una fecha o km anteriores no retroceden el plan ni el odómetro', () => {
  const { correr, lista } = nuevaApp('2026-04-02');
  correr(`bizProfile.assets.push({id:'cam2', name:'Camión 2', emoji:'🚚', km: 50000, maint:[{id:'mt1', name:'Aceite', emoji:'🛢', everyKm:10000, everyMonths:0, lastDate:'2026-03-01', lastKm:48000}], maintLog:[]});`);
  correr(`svcLogMaintenance(assetById('cam2'), {plan: assetById('cam2').maint[0], date:'2026-04-01', km: 52000, cost: 80});`);
  let a = JSON.parse(correr(`JSON.stringify(assetById('cam2'))`));
  assert.equal(a.maint[0].lastDate, '2026-04-01'); assert.equal(a.maint[0].lastKm, 52000); assert.equal(a.km, 52000);
  assert.equal(a.maintLog[0].desc, 'Aceite', 'el nombre del plan queda copiado');
  assert.equal(correr(`receipts.filter(r=>r.assetId==='cam2').length`), 1, 'con costo hay recibo');
  // Se carga tarde un cambio de hace dos meses: no retrocede nada, pero queda en el historial.
  correr(`svcLogMaintenance(assetById('cam2'), {plan: assetById('cam2').maint[0], date:'2026-02-01', km: 45000, cost: 0});`);
  a = JSON.parse(correr(`JSON.stringify(assetById('cam2'))`));
  assert.equal(a.maint[0].lastDate, '2026-04-01'); assert.equal(a.maint[0].lastKm, 52000); assert.equal(a.km, 52000);
  assert.equal(a.maintLog.length, 2);
  assert.equal(correr(`receipts.filter(r=>r.assetId==='cam2').length`), 1, 'sin costo no hay recibo');
  // Se borra el plan: el historial sigue diciendo qué se hizo.
  correr(`assetById('cam2').maint = [];`);
  assert.deepEqual(lista(`assetById('cam2').maintLog.map(l=>l.desc)`), ['Aceite', 'Aceite']);
});

test('archivo de salidas idempotente por id: evictar dos veces la misma salida no duplica el ingreso, y una copia archivada no vuelve viva al cargar', () => {
  const { correr } = nuevaApp('2026-04-02');
  correr(`recordOutflow({id:'jan1', type:'service', date:'2026-01-10', client:'A', serviceName:'S', price:100, paid:true, paidDate:'2026-01-10', items:[], createdAt:'2026-01-10T00:00:00Z'});
    for(let i=0;i<450;i++) recordOutflow({id:'adj'+i, type:'adjust', date:'2026-03-01', items:[], createdAt:'2026-03-01T00:00:00Z'});`);
  assert.equal(correr(`!!outflows.find(o=>o.id==='jan1')`), false, 'evictado');
  assert.equal(correr(`outflowArchive['2026-01'].revenue`), 100);
  assert.deepEqual(JSON.parse(correr(`JSON.stringify(outflowArchive['2026-01'].ids)`)), ['jan1']);
  // Vuelve de la nube (o de un respaldo) la misma salida: ni se archiva de nuevo ni queda viva.
  correr(`archiveEvictedOutflows([{id:'jan1', type:'service', date:'2026-01-10', price:100, paid:true, items:[]}]);`);
  assert.equal(correr(`outflowArchive['2026-01'].revenue`), 100, 'sigue en 100');
  correr(`applyStateData({outflows: outflows.concat([{id:'jan1', type:'service', date:'2026-01-10', client:'A', serviceName:'S', price:100, paid:true, items:[], createdAt:'2026-01-10T00:00:00Z'}]), outflowArchive});`);
  assert.equal(correr(`!!outflows.find(o=>o.id==='jan1')`), false, 'no revive');
  assert.equal(correr(`outflowArchive['2026-01'].revenue`), 100);
});
