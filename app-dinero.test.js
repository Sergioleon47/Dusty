// app-dinero.test.js
//
// Pruebas de LAS MATEMÁTICAS DEL DINERO: qué le pasa a cada número cuando se
// crea un recibo, se registra un pago y —sobre todo— cuando se BORRA un recibo.
// Se corren con `node --test`, igual que patron-core.test.js.
//
// Por qué existe este archivo. patron-core.js está probado desde siempre, pero
// las cuentas que el usuario realmente ve (gasto del mes, inversión, valor del
// inventario, desglose por categoría, costo por unidad) viven en app-03 y app-06,
// que son scripts de navegador sin exports: hasta ahora lo único que los tocaba
// era `node --check`, que solo mira que parseen. Los cuatro errores de deducción
// que arreglaron estas pruebas (revisión de matemáticas 2026-09-10) eran todos
// invisibles para el CI y visibles para cualquier usuario:
//   1. borrar un recibo no devolvía ing.costPerUnit al precio de la compra anterior;
//   2. una boleta de servicio escaneada sumaba su monto al Valor del inventario
//      además del gasto del mes (la misma plata contada dos veces);
//   3. el desglose por categoría ignoraba impuestos/cargos y los recibos sin
//      líneas, así que no cerraba con la barra del presupuesto;
//   4. una línea emparejada a un producto borrado entraba MUDA (compra y plata
//      registradas, sin stock ni nombre).
//
// Cómo. Se cargan app-01/03/06 (más patron-core) dentro de un contexto de `vm`
// con lo mínimo del navegador simulado, y se les pone delante los ayudantes que
// viven en los módulos que no se cargan (nube, render, eventos). No es un
// navegador: alcanza para llamar a applyScanResults/deleteReceipt y mirar los
// números, que es de lo que se trata.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

/* opts.servicios: carga también app-15 (modo Servicios) y app-17 (cotizaciones),
   para probar el cruce entre trabajos/cotizaciones y el inventario físico. */
function nuevaApp(opts){
  const servicios = !!(opts && opts.servicios);
  const guardado = {};
  const localStorage = {
    getItem: k => (k in guardado ? guardado[k] : null),
    setItem: (k,v) => { guardado[k] = String(v); },
    removeItem: k => { delete guardado[k]; }
  };
  const elemento = { style:{}, value:'', checked:false, classList:{add(){},remove(){}},
    addEventListener(){}, removeEventListener(){}, appendChild(){}, remove(){}, click(){},
    getBoundingClientRect: () => ({height:0,width:0}), closest: () => null };
  const sandbox = {
    console, Math, Date, JSON, parseInt, parseFloat, isNaN, isFinite, Number, String,
    Boolean, Array, Object, Set, Map, Promise, RegExp, Error, Intl,
    encodeURIComponent, decodeURIComponent, setTimeout, clearTimeout, setInterval, clearInterval,
    requestAnimationFrame: cb => setTimeout(cb, 0),
    localStorage,
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
      createElement: () => elemento, addEventListener(){}, body: elemento, documentElement: elemento },
    navigator: { onLine: true, language: 'es' },
    location: { protocol:'https:', href:'https://x/', origin:'https://x' },
    fetch: () => Promise.reject(new Error('sin red')),
    // Respuestas encoladas para los confirm() del flujo de borrado.
    __confirms: [],
    // Lo que el borrado le dice al usuario, para poder afirmarlo en las pruebas.
    __avisos: []
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
  if(servicios){ cargar('app-15-servicios.js'); cargar('app-17-cotizaciones.js'); }

  // Lo que vive en los módulos que no se cargan (nube, render, eventos, producción).
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
    function openPaywall(){}
    var currentUser = null;
    var priceAlertThreshold = 15, businessName = '', monthlyBudget = null;
    var budgetMeta = normalizeBudgetMeta(null);
    // Modo Servicios (app-15): lo que app-03/app-06 tocan de él. receiptAttach lo
    // declara app-15 cuando se carga (opts.servicios); si no, se declara acá.
    var bizProfile = normalizeBizProfile(null);
    ${servicios ? '' : 'var receiptAttach = null;'}
    var profitsVisibleToMembers = false, categories = null, expenseCategories = [];
    var cycleCountPct = 20, cycleCountIntervalDays = 3, cycleCountLastDate = null, cycleCountCursor = 0;

    /* Ayudantes de las pruebas */
    function escanear(proveedor, fecha, lineas, totalImpreso){
      scanExtracted = lineas; scanSupplier = proveedor; scanDate = fecha;
      scanInvoiceTotal = (totalImpreso===undefined ? null : totalImpreso);
      scanImages = []; scanCurrentImages = null; scanBatchMode = false;
      scanDuplicateOf = null; scanPayReminder = false;
      applyScanResults();
      return receipts[receipts.length-1];
    }
    // El mismo cálculo que la franja de Inventario y el Cierre de mes.
    function valorInventario(){
      return inventory.filter(i=>!isExpenseItem(i)).reduce((s,i)=>s+(i.qtyOnHand||0)*(i.costPerUnit||0), 0);
    }
    function borrar(id, revertirStock){ __avisos = []; __confirms = [true, revertirStock!==false]; deleteReceipt(id); }
    function ultimoAviso(){ return __avisos[__avisos.length-1] || ''; }
    function producto(nombre){ return inventory.find(i=>i.name===nombre); }
  `);
  return { correr, sandbox };
}
const redondo = n => Math.round(n*100)/100;

test('borrar un recibo devuelve el costo por unidad al de la compra que queda', () => {
  // Bug real: aplicar un recibo pisa ing.costPerUnit. Al borrarlo, la compra
  // desaparecía del historial pero el costo pisado se quedaba, así que el Valor
  // del inventario (y el COGS, y el margen) seguían usando el precio de un
  // recibo que ya no existe.
  const { correr } = nuevaApp();
  correr(`escanear('A','2026-09-01',[{rawName:'Tomate',qty:10,unit:'lb',totalPrice:50,matchedIngId:'__new__'}],50)`);
  correr(`escanear('A','2026-09-10',[{rawName:'Tomate',qty:10,unit:'lb',totalPrice:80,matchedIngId:producto('Tomate').id}],80)`);
  // (50 + 80) / 20 lb = $6.50 de promedio ponderado. Antes esta linea esperaba $8,
  // el ULTIMO precio, porque asi valuaba Dusty la materia prima hasta el
  // 2026-09-11; el resto de la prueba no cambio, que es lo que de verdad vigila:
  // borrar el recibo no puede dejar un costo que ya no corresponde a nada.
  assert.equal(correr(`producto('Tomate').costPerUnit`), 6.5);

  correr(`borrar(receipts[1].id, true)`);
  assert.equal(correr(`producto('Tomate').costPerUnit`), 5, 'vuelve al precio de la compra de $50/10lb');
  assert.equal(correr(`producto('Tomate').qtyOnHand`), 10);
  assert.equal(correr(`valorInventario()`), 50);
  assert.equal(correr(`purchases.length`), 1);
});

test('el costo también vuelve atrás si NO se revierten las cantidades', () => {
  // La pregunta "¿resto también el stock?" no debería decidir el precio: la
  // compra se borra del historial en los dos casos, así que el costo tiene que
  // volver igual — si no, el stock que sí quedó se valúa a un precio inexistente.
  const { correr } = nuevaApp();
  correr(`escanear('A','2026-09-01',[{rawName:'Tomate',qty:10,unit:'lb',totalPrice:50,matchedIngId:'__new__'}],50)`);
  correr(`escanear('A','2026-09-10',[{rawName:'Tomate',qty:10,unit:'lb',totalPrice:80,matchedIngId:producto('Tomate').id}],80)`);
  correr(`borrar(receipts[1].id, false)`);
  assert.equal(correr(`producto('Tomate').costPerUnit`), 5);
  assert.equal(correr(`producto('Tomate').qtyOnHand`), 20, 'el stock se queda, eso sí depende de la respuesta');
});

test('sin ninguna compra que quede, el costo no se pone en cero', () => {
  // No hay a qué volver: dejarlo como está es lo honesto (puede haberlo puesto
  // el usuario a mano). Ponerlo en 0 valuaría el inventario en $0 sin pedirlo.
  const { correr } = nuevaApp();
  correr(`escanear('A','2026-09-01',[{rawName:'Tomate',qty:10,unit:'lb',totalPrice:50,matchedIngId:'__new__'}],50)`);
  correr(`borrar(receipts[0].id, false)`); // sin revertir: el producto sobrevive
  assert.equal(correr(`producto('Tomate').costPerUnit`), 5);
  assert.equal(correr(`purchases.length`), 0);
});

test('borrar un recibo resta de TODOS los números del mes', () => {
  const { correr } = nuevaApp();
  correr(`escanear('Proveedor','2026-09-02',[
    {rawName:'Tomate', qty:10, unit:'lb', totalPrice:50, matchedIngId:'__new__'},
    {rawName:'Queso',  qty:4,  unit:'lb', totalPrice:40, matchedIngId:'__new__'}
  ], 100)`);
  correr(`escanear('Luz','2026-09-05',[{rawName:'Energia',qty:1,unit:'servicio',totalPrice:600,matchedIngId:'__new__'}],600)`);
  correr(`resetFinancialCache()`);
  assert.equal(correr(`spendForMonth('2026-09')`), 700);
  assert.equal(redondo(correr(`spendSplitForMonth('2026-09').invested`)), 100);
  assert.equal(redondo(correr(`spendSplitForMonth('2026-09').expense`)), 600);

  correr(`borrar(receipts[0].id, true)`); // se va el de mercadería
  correr(`resetFinancialCache()`);
  assert.equal(correr(`spendForMonth('2026-09')`), 600);
  assert.equal(redondo(correr(`spendSplitForMonth('2026-09').invested`)), 0);
  assert.equal(redondo(correr(`spendSplitForMonth('2026-09').expense`)), 600);
  assert.equal(correr(`valorInventario()`), 0);
  assert.equal(correr(`purchases.length`), 1, 'queda la línea del recibo de servicio');
  assert.equal(correr(`receipts.length`), 1);

  correr(`borrar(receipts[0].id, true)`); // y el de servicio
  correr(`resetFinancialCache()`);
  assert.equal(correr(`spendForMonth('2026-09')`), 0);
  assert.equal(redondo(correr(`spendSplitForMonth('2026-09').expense`)), 0);
  assert.equal(correr(`inventory.length`), 0);
});

test('una boleta de servicio no suma al Valor del inventario', () => {
  // Bug real: la línea de servicio creaba el producto con qtyOnHand = 1 y
  // costPerUnit = el monto de la boleta. No se veía en ninguna grilla de stock
  // (stockRowsData filtra los ítems de gasto) pero SÍ entraba en el Valor del
  // inventario: $600 de luz eran $600 de gasto Y $600 de "mercadería".
  const { correr } = nuevaApp();
  correr(`escanear('CFE','2026-09-05',[{rawName:'Energia',qty:1,unit:'servicio',totalPrice:600,matchedIngId:'__new__'}],600)`);
  correr(`resetFinancialCache()`);
  assert.equal(correr(`valorInventario()`), 0);
  assert.equal(redondo(correr(`spendSplitForMonth('2026-09').expense`)), 600);
  assert.equal(correr(`producto('Energia').qtyOnHand`), 0);
  assert.equal(correr(`isExpenseItem(producto('Energia'))`), true);
});

test('el desglose por categoría suma exactamente lo mismo que la barra del presupuesto', () => {
  // Bug real: el desglose usaba totalPrice crudo mientras la barra reparte los
  // impuestos pro-rata, así que los dos números del MISMO modal no cerraban.
  const { correr } = nuevaApp();
  correr(`escanear('Mixto','2026-09-03',[
    {rawName:'Tomate',   qty:10, unit:'lb',       totalPrice:100, matchedIngId:'__new__'},
    {rawName:'Internet', qty:1,  unit:'servicio', totalPrice:100, matchedIngId:'__new__'}
  ], 220)`);
  correr(`resetFinancialCache()`);
  const gasto = correr(`spendSplitForMonth('2026-09').expense`);
  const porCategoria = correr(`expenseByCategoryForMonth('2026-09').reduce((s,c)=>s+c.amount,0)`);
  assert.equal(redondo(gasto), 110, '100 de servicio + su parte de los $20 de impuestos');
  assert.equal(redondo(porCategoria), redondo(gasto));
});

test('un recibo sin líneas aplicadas aparece en el desglose por categoría', () => {
  // Bug real: la barra contaba su total entero como gasto y el desglose lo
  // ignoraba — $300 de gasto que no estaban en ninguna categoría.
  const { correr } = nuevaApp();
  correr(`receipts.push({id:'r1', images:[], supplier:'Ferretería', date:'2026-09-04',
    total:300, itemCount:0, appliedItems:[], createdAt:'', purchaseIds:[]}); resetFinancialCache()`);
  assert.equal(correr(`spendSplitForMonth('2026-09').expense`), 300);
  assert.equal(correr(`expenseByCategoryForMonth('2026-09').reduce((s,c)=>s+c.amount,0)`), 300);
});

test('borrar un pago manual lo resta del gasto del mes y "despaga" el bill', () => {
  // Los pagos de bills son recibos manuales sin compras: borrarlos tiene que
  // mover la barra del presupuesto y devolver el ＋ a la fila del bill.
  const { correr } = nuevaApp();
  correr(`
    inventory.push({id:'bill1', name:'Renta', unit:'servicio', costPerUnit:900, qtyOnHand:0, expenseOnly:true});
    receipts.push({id:'pago1', images:[], supplier:'Renta', date:'2026-09-01', total:900, itemCount:0,
      appliedItems:[], createdAt:'', purchaseIds:[], manual:true, manualKind:'expense', billItemId:'bill1'});
    resetFinancialCache();
  `);
  assert.equal(correr(`spendSplitForMonth('2026-09').expense`), 900);
  assert.equal(correr(`billPaidInMonth(producto('Renta'), '2026-09')`), true);

  correr(`__confirms=[true]; deleteReceipt('pago1'); resetFinancialCache()`);
  assert.equal(correr(`spendSplitForMonth('2026-09').expense`), 0);
  assert.equal(correr(`billPaidInMonth(producto('Renta'), '2026-09')`), false);
  assert.equal(correr(`inventory.length`), 1, 'el bill (el catálogo) sigue existiendo');
  assert.equal(correr(`deletedReceiptIds.includes('pago1')`), true, 'lápida, para que no reviva por la nube');
});

test('un gasto manual de inversión cuenta como inversión, no como gasto', () => {
  const { correr } = nuevaApp();
  correr(`
    receipts.push({id:'m1', images:[], supplier:'Mercadería en efectivo', date:'2026-09-06', total:400,
      itemCount:0, appliedItems:[], createdAt:'', purchaseIds:[], manual:true, manualKind:'investment'});
    resetFinancialCache();
  `);
  assert.equal(correr(`spendSplitForMonth('2026-09').invested`), 400);
  assert.equal(correr(`spendSplitForMonth('2026-09').expense`), 0);
  assert.equal(correr(`expenseByCategoryForMonth('2026-09').length`), 0);
  correr(`__confirms=[true]; deleteReceipt('m1'); resetFinancialCache()`);
  assert.equal(correr(`spendSplitForMonth('2026-09').invested`), 0);
});

test('una línea emparejada a un producto ya borrado no entra muda', () => {
  // Bug real: si el producto desaparecía entre la revisión y el "Guardar" (lo
  // borró un compañero y llegó por la nube), ninguna rama enganchaba: se
  // registraba la compra y la plata como inversión, pero sin stock, sin nombre
  // de producto y sin nada que se pudiera ver en el inventario.
  const { correr } = nuevaApp();
  correr(`escanear('A','2026-09-01',[{rawName:'Tomate',qty:10,unit:'lb',totalPrice:50,matchedIngId:'__new__'}],50)`);
  correr(`var muerto = producto('Tomate').id; inventory = [];`);
  correr(`escanear('A','2026-09-08',[{rawName:'Tomate',qty:10,unit:'lb',totalPrice:60,matchedIngId:muerto}],60)`);
  assert.equal(correr(`inventory.length`), 1, 'la línea recrea el producto en vez de perderse');
  assert.equal(correr(`producto('Tomate').qtyOnHand`), 10);
  assert.equal(correr(`valorInventario()`), 60);
  assert.equal(correr(`receipts[1].appliedItems[0].ingName`), 'Tomate');
});

test('borrar el recibo que creó un producto lo olvida también del aliasMap', () => {
  // Un alias aprendido que apunta a un producto borrado es una trampa: el
  // próximo escaneo lo da por emparejado con algo que no existe.
  const { correr } = nuevaApp();
  correr(`escanear('A','2026-09-01',[{rawName:'tomate roma',qty:10,unit:'lb',totalPrice:50,matchedIngId:'__new__'}],50)`);
  assert.equal(correr(`Object.keys(aliasMap).length`), 1);
  correr(`borrar(receipts[0].id, true)`);
  assert.equal(correr(`inventory.length`), 0);
  assert.equal(correr(`Object.keys(aliasMap).length`), 0);
});

test('borrar un recibo no toca los otros meses', () => {
  const { correr } = nuevaApp();
  correr(`escanear('A','2026-08-10',[{rawName:'Tomate',qty:10,unit:'lb',totalPrice:50,matchedIngId:'__new__'}],50)`);
  correr(`escanear('A','2026-09-10',[{rawName:'Queso',qty:5,unit:'lb',totalPrice:75,matchedIngId:'__new__'}],75)`);
  correr(`borrar(receipts[1].id, true); resetFinancialCache()`);
  assert.equal(redondo(correr(`spendSplitForMonth('2026-08').invested`)), 50, 'agosto queda intacto');
  assert.equal(redondo(correr(`spendSplitForMonth('2026-09').invested`)), 0);
  assert.deepEqual(correr(`JSON.stringify(allMonths())`), '["2026-08"]');
});

test('borrar un recibo dice qué restó del mes y qué pasó con el stock', () => {
  // Reporte del usuario: "borré todos los recibos y el Valor no bajó". El borrado
  // no decía nada, así que un número que no se movía —a veces con razón— se leía
  // como una falla de la app.
  const { correr } = nuevaApp();
  correr(`escanear('A','2026-09-01',[{rawName:'Cable',qty:16,unit:'unidad',totalPrice:720,matchedIngId:'__new__'}],720)`);
  correr(`borrar(receipts[0].id, true)`);
  assert.match(correr(`ultimoAviso()`), /−\$720/, 'dice cuánto sale del mes');
  assert.match(correr(`ultimoAviso()`), /−16 restadas del inventario/);

  const b = nuevaApp();
  b.correr(`escanear('A','2026-09-01',[{rawName:'Cable',qty:16,unit:'unidad',totalPrice:720,matchedIngId:'__new__'}],720)`);
  b.correr(`borrar(receipts[0].id, false)`);
  assert.match(b.correr(`ultimoAviso()`), /quedaron como estaban/, 'dice que el stock se dejó a propósito');
});

test('un recibo VIEJO (sin compras anotadas) igual resta el stock', () => {
  /* Reporte del usuario: "borré todos los recibos y el Valor no bajó". purchaseIds
     se guarda desde hace un tiempo; los recibos anteriores no lo tienen, y el
     borrado no tocaba el inventario. Pero las líneas del recibo (appliedItems)
     guardan el mismo par producto+cantidad que las compras — son las que la app
     ya muestra al abrir el recibo — así que sí se puede restar. */
  const { correr } = nuevaApp();
  correr(`
    inventory.push({id:'i1', name:'Cable 10-2', unit:'unidad', costPerUnit:45, qtyOnHand:16, stockFullRef:16});
    receipts.push({id:'rv', images:[], supplier:'Home Depot', date:'2026-09-01', total:720, itemCount:1,
      appliedItems:[{rawName:'Cable 10-2', qty:16, unit:'unidad', totalPrice:720, ingName:'Cable 10-2', ingId:'i1'}],
      createdAt:''});  // <- sin purchaseIds
  `);
  assert.equal(correr(`valorInventario()`), 720);
  correr(`borrar('rv', true)`);
  assert.equal(correr(`producto('Cable 10-2').qtyOnHand`), 0, 'las 16 unidades se restaron');
  assert.equal(correr(`valorInventario()`), 0, 'y el Valor bajó, que es lo que el usuario esperaba');
  assert.match(correr(`ultimoAviso()`), /−16 restadas del inventario/);
});

test('un recibo viejo emparejado por NOMBRE también resta', () => {
  // Los recibos más viejos todavía no guardaban ingId en sus líneas: solo el
  // nombre del producto. Es el mismo camino de respaldo que ya usa el reparto
  // inversión/gasto para esas líneas.
  const { correr } = nuevaApp();
  correr(`
    inventory.push({id:'i1', name:'Cable 12/3', unit:'unidad', costPerUnit:35, qtyOnHand:22, stockFullRef:22});
    receipts.push({id:'rv', images:[], supplier:'Home Depot', date:'2026-09-01', total:770, itemCount:1,
      appliedItems:[{rawName:'CABLE 12/3 250FT', qty:22, unit:'unidad', totalPrice:770, ingName:'Cable 12/3'}],
      createdAt:''});  // <- ni purchaseIds ni ingId
  `);
  correr(`borrar('rv', true)`);
  assert.equal(correr(`producto('Cable 12/3').qtyOnHand`), 0);
  assert.equal(correr(`valorInventario()`), 0);
});

test('un recibo viejo NO borra el producto, solo le resta', () => {
  /* Sin compras de por medio, que un producto no tenga historial no prueba que lo
     haya creado este recibo: puede haberse cargado a mano. Borrarlo sería una
     suposición destructiva — se resta y se deja. */
  const { correr } = nuevaApp();
  correr(`
    inventory.push({id:'i1', name:'Cable 10-2', unit:'unidad', costPerUnit:45, qtyOnHand:16, stockFullRef:16});
    receipts.push({id:'rv', images:[], supplier:'HD', date:'2026-09-01', total:720, itemCount:1,
      appliedItems:[{rawName:'Cable 10-2', qty:16, unit:'unidad', totalPrice:720, ingName:'Cable 10-2', ingId:'i1'}],
      createdAt:''});
  `);
  correr(`borrar('rv', true)`);
  assert.equal(correr(`inventory.length`), 1, 'el producto sigue en la lista, en cero');
  assert.equal(correr(`deletedInventoryIds.length`), 0);
});

test('un recibo viejo de SERVICIO no inventa stock que restar', () => {
  // Una boleta de luz nunca tocó el inventario: no se pregunta ni se menciona.
  const { correr, sandbox } = nuevaApp();
  correr(`
    inventory.push({id:'i2', name:'Energia', unit:'servicio', costPerUnit:600, qtyOnHand:0, expenseOnly:true});
    receipts.push({id:'rs', images:[], supplier:'CFE', date:'2026-09-01', total:600, itemCount:1,
      appliedItems:[{rawName:'Energia', qty:1, unit:'servicio', totalPrice:600, ingName:'Energia', ingId:'i2'}],
      createdAt:''});
    __avisos=[]; __confirms=[true]; deleteReceipt('rs');
  `);
  assert.equal(correr(`receipts.length`), 0);
  assert.equal(sandbox.__confirms.length, 0, 'no pregunta por el stock: no hay ninguno que restar');
  assert.doesNotMatch(correr(`ultimoAviso()`), /inventario/i);
});

test('borrar un pago manual no habla de stock que nunca tocó', () => {
  const { correr } = nuevaApp();
  correr(`
    receipts.push({id:'pago1', images:[], supplier:'Renta', date:'2026-09-01', total:900, itemCount:0,
      appliedItems:[], createdAt:'', purchaseIds:[], manual:true, manualKind:'expense'});
    __avisos=[]; __confirms=[true]; deleteReceipt('pago1');
  `);
  const aviso = correr(`ultimoAviso()`);
  assert.match(aviso, /−\$900/);
  assert.doesNotMatch(aviso, /inventario|stock|mano/i, 'un pago nunca tuvo stock: no se menciona');
});

/* ---------- PRODUCTO TERMINADO: fabricar, costear y vender ---------- */

test('fabricar mueve la plata de materia prima a producto terminado, sin inventarla', () => {
  /* La transferencia tiene DOS patas. Antes solo estaba la primera: salía el
     insumo y no entraba nada, así que el Valor del inventario bajaba sin motivo y
     el P&L se inventaba un ingreso al FABRICAR para tapar el agujero. */
  const { correr } = nuevaApp();
  correr(`
    inventory.push({id:'i1', name:'Cable', unit:'unidad', costPerUnit:4, qtyOnHand:1000, salePrice:0});
    recipes.push({id:'rc1', name:'Tablero', salePrice:100, components:[{ingId:'i1', qty:10}]});
  `);
  const valorAntes = correr(`valorInventario()`);
  correr(`produceRecipeId='rc1'; produceCount=20; applyProduction(); resetFinancialCache()`);
  assert.equal(correr(`inventory[0].qtyOnHand`), 800, 'salieron 200 cables');
  assert.equal(correr(`finishedItemFor(recipeById('rc1')).qtyOnHand`), 20, 'entraron 20 tableros');
  assert.equal(correr(`finishedItemFor(recipeById('rc1')).costPerUnit`), 40, '10 cables a $4 cada tablero');
  assert.equal(correr(`valorInventario()`), valorAntes, 'el valor total no se mueve: la plata cambió de forma');
  assert.equal(correr(`periodFinancials(localMonthStr()).revenue`), 0, 'fabricar no es vender');
});

test('el costo del terminado es el PROMEDIO de las tandas, no el de la última', () => {
  // Fabricar en tandas a precios distintos no deja "un" costo, deja un promedio.
  const { correr } = nuevaApp();
  correr(`
    inventory.push({id:'i1', name:'Cable', unit:'unidad', costPerUnit:4, qtyOnHand:1000, salePrice:0});
    recipes.push({id:'rc1', name:'Tablero', salePrice:100, components:[{ingId:'i1', qty:10}]});
    produceRecipeId='rc1'; produceCount=20; applyProduction();
    inventory[0].costPerUnit = 7;              // el cable subió
    produceRecipeId='rc1'; produceCount=10; applyProduction();
  `);
  // 20 a $40 = $800, más 10 a $70 = $700  ->  $1500 / 30 = $50
  assert.equal(correr(`finishedItemFor(recipeById('rc1')).qtyOnHand`), 30);
  assert.equal(correr(`finishedItemFor(recipeById('rc1')).costPerUnit`), 50);
});

test('vender el terminado da ingreso y costo de lo vendido en el mes', () => {
  const { correr } = nuevaApp();
  correr(`
    inventory.push({id:'i1', name:'Cable', unit:'unidad', costPerUnit:4, qtyOnHand:1000, salePrice:0});
    recipes.push({id:'rc1', name:'Tablero', salePrice:100, components:[{ingId:'i1', qty:10}]});
    produceRecipeId='rc1'; produceCount=20; applyProduction();
    // Sale de estante con motivo "Lo vendí", igual que cualquier producto.
    const term = finishedItemFor(recipeById('rc1'));
    term.qtyOnHand = term.qtyOnHand - 12;
    outflows.push({id:'o1', type:'adjust', reason:'sale', date: localDateStr(), items:[
      {ingId: term.id, ingName: term.name, qty:12, unit:'unidad', reason:'sale', costAt: term.costPerUnit, priceAt:100}]});
    resetFinancialCache();
  `);
  const fin = JSON.parse(correr(`JSON.stringify(periodFinancials(localMonthStr()))`));
  assert.equal(fin.revenue, 1200, '12 x $100');
  assert.equal(fin.cogs, 480, '12 x $40, el costo con el que se fabricaron');
  assert.equal(fin.gross, 720);
});

test('el producto terminado queda marcado para no mezclarse con lo que se compra', () => {
  /* Es un ítem del inventario (así hereda el Valor, el escáner de venta y el P&L),
     pero lleva la bandera finishedGood, que es por la que stockRowsData (app-05)
     lo deja fuera de la grilla de Inventario: son stock igual, pero mezclarlos
     haría parecer que se compran cuando se fabrican. La bandera se prueba acá; la
     grilla vive en la capa de vistas, que este harness no carga. */
  const { correr } = nuevaApp();
  correr(`
    inventory.push({id:'i1', name:'Cable', unit:'unidad', costPerUnit:4, qtyOnHand:100, salePrice:0});
    recipes.push({id:'rc1', name:'Tablero', salePrice:100, components:[{ingId:'i1', qty:10}]});
    produceRecipeId='rc1'; produceCount=5; applyProduction();
  `);
  assert.equal(correr(`inventory.length`), 2, 'el terminado existe como ítem del inventario');
  assert.equal(correr(`finishedItemFor(recipeById('rc1')).finishedGood`), true);
  assert.equal(correr(`finishedItemFor(recipeById('rc1')).recipeId`), 'rc1', 'emparejado con su receta');
  // El mismo filtro que aplica la grilla de Inventario.
  assert.equal(correr(`JSON.stringify(inventory.filter(i=>!isExpenseItem(i) && !i.finishedGood).map(i=>i.name))`), '["Cable"]');
});

test('renombrar la receta renombra su stock, pero no le toca el costo', () => {
  const { correr } = nuevaApp();
  correr(`
    inventory.push({id:'i1', name:'Cable', unit:'unidad', costPerUnit:4, qtyOnHand:100, salePrice:0});
    recipes.push({id:'rc1', name:'Tablero', salePrice:100, components:[{ingId:'i1', qty:10}]});
    produceRecipeId='rc1'; produceCount=5; applyProduction();
    recipes[0].name = 'Tablero grande'; recipes[0].salePrice = 150;
    syncFinishedItem(recipes[0]);
  `);
  assert.equal(correr(`finishedItemFor(recipeById('rc1')).name`), 'Tablero grande');
  assert.equal(correr(`finishedItemFor(recipeById('rc1')).salePrice`), 150);
  assert.equal(correr(`finishedItemFor(recipeById('rc1')).costPerUnit`), 40, 'el costo lo pone producir, no el formulario');
  assert.equal(correr(`finishedItemFor(recipeById('rc1')).qtyOnHand`), 5);
});

test('una produccion VIEJA sigue contando como antes: los meses cerrados no se mueven', () => {
  // Sin producedItemId = modelo viejo, estimaba el ingreso por el precio de la pieza.
  const { correr } = nuevaApp();
  correr(`
    inventory.push({id:'i1', name:'Cable', unit:'unidad', costPerUnit:4, qtyOnHand:100, salePrice:0});
    recipes.push({id:'rc1', name:'Tablero', salePrice:100, components:[{ingId:'i1', qty:10}]});
    outflows.push({id:'o1', type:'production', recipeId:'rc1', recipeName:'Tablero', count:5,
      items:[{ingId:'i1', ingName:'Cable', qty:50, unit:'unidad', costAt:4}],
      saleTotal:500, costTotal:200, date:'2026-08-10'});
    resetFinancialCache();
  `);
  assert.equal(correr(`periodFinancials('2026-08').revenue`), 500, 'agosto queda como estaba');
  assert.equal(correr(`periodFinancials('2026-08').cogs`), 200);
});

/* ===== COSTO PROMEDIO PONDERADO DE LA MATERIA PRIMA (2026-09-11) =====
   Hasta este cambio, la compra que entraba pisaba el costo de TODO el stock que
   ya estaba en el estante (último precio). Estas pruebas fijan el criterio nuevo
   y, sobre todo, el caso que lo motivó: una compra chica y cara no puede
   revaluar un estante lleno de mercancía barata. */

test('una compra chica y cara NO revalua todo el stock que ya estaba', () => {
  const { correr } = nuevaApp();
  // 100 unidades a $4 = $400 en el estante
  correr(`escanear('Prov','2026-09-01',[{rawName:'Tornillo',qty:100,unit:'unidad',totalPrice:400,matchedIngId:'__new__'}],400)`);
  assert.equal(correr(`producto('Tornillo').costPerUnit`), 4);
  assert.equal(correr(`valorInventario()`), 400);

  // entran 2 más, carísimas, a $9 cada una
  const ing = correr(`producto('Tornillo').id`);
  correr(`escanear('Prov','2026-09-10',[{rawName:'Tornillo',qty:2,unit:'unidad',totalPrice:18,matchedIngId:'${ing}'}],18)`);
  correr(`resetFinancialCache()`);

  // Con último precio: 102 × $9 = $918 de "mercadería" salidos de la nada.
  // Con promedio ponderado: (400 + 18) / 102 = $4.098
  assert.equal(correr(`producto('Tornillo').qtyOnHand`), 102);
  assert.equal(correr(`producto('Tornillo').costPerUnit`), 4.098);
  assert.equal(redondo(correr(`valorInventario()`)), 418);   // lo que de verdad se pagó
});

test('el promedio ponderado sube de verdad cuando la compra es grande', () => {
  const { correr } = nuevaApp();
  correr(`escanear('Prov','2026-09-01',[{rawName:'Cable',qty:10,unit:'unidad',totalPrice:100,matchedIngId:'__new__'}],100)`);
  const ing = correr(`producto('Cable').id`);
  // 10 a $10 + 10 a $20 -> promedio $15, no $20
  correr(`escanear('Prov','2026-09-09',[{rawName:'Cable',qty:10,unit:'unidad',totalPrice:200,matchedIngId:'${ing}'}],200)`);
  assert.equal(correr(`producto('Cable').costPerUnit`), 15);
  assert.equal(redondo(correr(`valorInventario()`)), 300);
});

test('un cambio de unidad NO promedia: arranca el costo de cero', () => {
  const { correr } = nuevaApp();
  correr(`escanear('Prov','2026-09-01',[{rawName:'Cebolla',qty:20,unit:'lb',totalPrice:40,matchedIngId:'__new__'}],40)`);
  const ing = correr(`producto('Cebolla').id`);
  // el mismo producto, ahora por caja: promediar $/lb con $/caja seria basura
  correr(`escanear('Prov','2026-09-09',[{rawName:'Cebolla',qty:2,unit:'caja',totalPrice:90,matchedIngId:'${ing}'}],90)`);
  assert.equal(correr(`producto('Cebolla').unit`), 'caja');
  assert.equal(correr(`producto('Cebolla').qtyOnHand`), 2);
  assert.equal(correr(`producto('Cebolla').costPerUnit`), 45);
});

test('borrar un recibo devuelve el promedio exacto de las compras que quedan', () => {
  const { correr } = nuevaApp();
  correr(`escanear('Prov','2026-09-01',[{rawName:'Tubo',qty:10,unit:'unidad',totalPrice:100,matchedIngId:'__new__'}],100)`);
  const ing = correr(`producto('Tubo').id`);
  correr(`escanear('Prov','2026-09-05',[{rawName:'Tubo',qty:10,unit:'unidad',totalPrice:300,matchedIngId:'${ing}'}],300)`);
  assert.equal(correr(`producto('Tubo').costPerUnit`), 20);   // (100+300)/20

  // se borra el segundo recibo (el caro): tiene que volver a $10, el promedio real
  // de lo que queda — no al "ultimo precio", que daria lo mismo por casualidad aca
  correr(`borrar(receipts[1].id, true)`);
  assert.equal(correr(`producto('Tubo').costPerUnit`), 10);
  assert.equal(correr(`producto('Tubo').qtyOnHand`), 10);
});

test('borrar un recibo del medio deja el promedio de los otros dos, no el ultimo precio', () => {
  const { correr } = nuevaApp();
  correr(`escanear('Prov','2026-09-01',[{rawName:'Clavo',qty:10,unit:'unidad',totalPrice:100,matchedIngId:'__new__'}],100)`);
  const ing = correr(`producto('Clavo').id`);
  correr(`escanear('Prov','2026-09-05',[{rawName:'Clavo',qty:10,unit:'unidad',totalPrice:900,matchedIngId:'${ing}'}],900)`);
  correr(`escanear('Prov','2026-09-09',[{rawName:'Clavo',qty:10,unit:'unidad',totalPrice:200,matchedIngId:'${ing}'}],200)`);
  // se va el carisimo del medio: quedan 10 a $10 y 10 a $20 -> promedio $15.
  // El ultimo precio habria dicho $20.
  correr(`borrar(receipts[1].id, true)`);
  assert.equal(correr(`producto('Clavo').costPerUnit`), 15);
});


/* ---------- AUDITORÍA DE DATOS 2026-09-12: cruces entre módulos ---------- */

test('la misma foto no entra dos veces como página del recibo', () => {
  const { correr } = nuevaApp();
  correr(`scanImages = [{base64:'AAA', mediaType:'image/jpeg'}];`);
  assert.equal(correr(`scanPageIsDuplicate('AAA')`), true, 'idéntica: se descarta');
  assert.equal(correr(`scanPageIsDuplicate('BBB')`), false, 'otra foto: pasa');
  assert.equal(correr(`scanPageIsDuplicate('')`), false);
});

test('dos productos terminados de la misma receta (carrera entre dispositivos) se funden en uno', () => {
  const { correr } = nuevaApp();
  correr(`
    recipes.push({id:'rc1', name:'Tablero', salePrice:100, components:[{ingId:'i1', qty:1}]});
    inventory.push({id:'i1', name:'Cable', unit:'unidad', costPerUnit:4, qtyOnHand:100, salePrice:0});
    inventory.push({id:'fg-rc1', name:'Tablero', unit:'unidad', costPerUnit:40, qtyOnHand:10, finishedGood:true, recipeId:'rc1', salePrice:100});
    inventory.push({id:'iotro12', name:'Tablero', unit:'unidad', costPerUnit:60, qtyOnHand:5, finishedGood:true, recipeId:'rc1', salePrice:100});
    var valorAntes = valorInventario();
    saveState();
  `);
  assert.equal(correr(`inventory.filter(i=>i.finishedGood).length`), 1, 'queda una sola fila');
  assert.equal(correr(`finishedItemFor(recipeById('rc1')).id`), 'fg-rc1', 'gana el id determinista');
  assert.equal(correr(`finishedItemFor(recipeById('rc1')).qtyOnHand`), 15, 'las cantidades se suman');
  assert.equal(correr(`finishedItemFor(recipeById('rc1')).costPerUnit`), 46.6667, 'costo = promedio ponderado de los dos stocks');
  assert.ok(Math.abs(correr(`valorInventario() - valorAntes`)) < 0.01, 'el Valor del inventario no se mueve');
  assert.ok(correr(`deletedInventoryIds.includes('iotro12')`), 'el perdedor queda con lápida para la nube');
  // Producir sobre la receta sigue funcionando y usa el id determinista.
  correr(`produceRecipeId='rc1'; produceCount=2; applyProduction();`);
  assert.equal(correr(`inventory.filter(i=>i.finishedGood).length`), 1);
  assert.equal(correr(`finishedItemFor(recipeById('rc1')).qtyOnHand`), 17);
});

test('un producto terminado nuevo nace con id determinista (el mismo en cualquier dispositivo)', () => {
  const ids = [1,2].map(()=>{
    const { correr } = nuevaApp();
    correr(`
      inventory.push({id:'i1', name:'Cable', unit:'unidad', costPerUnit:4, qtyOnHand:100, salePrice:0});
      recipes.push({id:'rc9', name:'Tablero', salePrice:100, components:[{ingId:'i1', qty:1}]});
      produceRecipeId='rc9'; produceCount=1; applyProduction();
    `);
    return correr(`finishedItemFor(recipeById('rc9')).id`);
  });
  assert.equal(ids[0], ids[1]);
  assert.equal(ids[0], 'fg-rc9');
});

test('con la cuenta cerrada (solo lectura) producir no toca el stock', () => {
  const { correr } = nuevaApp();
  correr(`
    inventory.push({id:'i1', name:'Cable', unit:'unidad', costPerUnit:4, qtyOnHand:100, salePrice:0});
    recipes.push({id:'rc1', name:'Tablero', salePrice:100, components:[{ingId:'i1', qty:10}]});
    accessState = {locked:true};
    produceRecipeId='rc1'; produceCount=3; applyProduction();
  `);
  assert.equal(correr(`inventory[0].qtyOnHand`), 100, 'no salió nada');
  assert.equal(correr(`inventory.length`), 1, 'no nació ningún terminado');
  assert.equal(correr(`outflows.length`), 0);
});

test('el tope de salidas no se lleva trabajos por cobrar ni cotizaciones abiertas', () => {
  const { correr } = nuevaApp({servicios:true});
  correr(`
    bizProfile.services = true;
    for(let k=0;k<3;k++) outflows.push({id:'jobv'+k, type:'service', date:'2025-01-1'+k, client:'C'+k, price:100, paid:false, dueDate:'2025-02-01', dueDays:15, createdAt:'2025-01-0'+(k+1)+'T00:00:00Z', items:[]});
    outflows.push({id:'qopen', type:'quote', status:'sent', date: localDateStr(), validDays:30, client:'Q', lines:[{desc:'x', qty:1, price:50}], createdAt:'2025-01-05T00:00:00Z'});
    outflows.push({id:'jpaid', type:'service', date:'2025-01-20', client:'P', price:70, paid:true, paidDate:'2025-01-25', createdAt:'2025-01-06T00:00:00Z', items:[]});
    for(let k=0;k<400;k++) outflows.unshift({id:'o'+String(k).padStart(3,'0'), type:'production', producedItemId:'x', recipeId:'r', recipeName:'R', count:1, items:[], costTotal:0, date:'2025-03-01', createdAt:'2025-03-01T00:'+String(Math.floor(k/60)).padStart(2,'0')+':'+String(k%60).padStart(2,'0')+'Z'});
    recordOutflow({id:'nuevo', type:'adjust', reason:'sale', items:[], date: localDateStr(), createdAt: new Date().toISOString()});
  `);
  assert.equal(correr(`outflows.length`), 400, 'se respeta el tope');
  assert.equal(correr(`outflows.filter(o=>o.type==='service' && !o.paid).length`), 3, 'los cobros pendientes siguen');
  assert.ok(correr(`!!outflows.find(o=>o.id==='qopen')`), 'la cotización abierta sigue');
  assert.ok(correr(`!!outflows.find(o=>o.id==='nuevo')`), 'lo recién registrado entra');
  assert.ok(correr(`!outflows.find(o=>o.id==='jpaid')`), 'el cobrado viejo sí se evicta (era el más viejo evictable)');
  assert.equal(correr(`(outflowArchive['2025-01']||{}).revenue`), 70, 'y su ingreso quedó archivado en su mes');
  assert.ok(correr(`!outflows.find(o=>o.id==='o000') && !!outflows.find(o=>o.id==='o399')`), 'de las producciones caen las más viejas');
});

test('aceptar una cotización con productos descuenta el stock y el Cierre lleva ingreso y costo de lo vendido', () => {
  const { correr } = nuevaApp({servicios:true});
  correr(`
    bizProfile.services = true; bizProfile.sells = true;
    bizProfile.catalog.push({id:'sv1', name:'Instalación', desc:'', price:200, unit:'fixed'});
    inventory.push({id:'i1', name:'Breaker', unit:'unidad', costPerUnit:10, qtyOnHand:50, salePrice:25});
    draftQuote = {id:null, client:'Ana', clientId:null, date: localDateStr(), validDays:15, notes:'', discount:0, taxPct:0,
      lines:[{desc:'Instalación', qty:1, unit:'fixed', price:200}, {desc:'Breaker', qty:4, unit:'unidad', price:25}]};
    var q = saveQuoteFromDraft(); draftQuote = null;
    var valorAntes = valorInventario();
    var job = acceptQuote(q); resetFinancialCache();
  `);
  assert.equal(correr(`q.lines[1].itemId`), 'i1', 'la línea de producto quedó enlazada al inventario');
  assert.equal(correr(`producto('Breaker').qtyOnHand`), 46, 'salieron 4 breakers');
  assert.equal(correr(`job.price`), 300, 'el trabajo vale el total de la cotización');
  assert.equal(correr(`JSON.stringify(job.items.map(i=>[i.ingId, i.qty, i.costAt, i.priceAt, i.reason]))`), '[["i1",4,10,25,"sale"]]');
  const fin = JSON.parse(correr(`JSON.stringify(periodFinancials(localMonthStr()))`));
  assert.equal(fin.revenue, 300, 'ingreso = precio del trabajo (incluye los productos, no se cuenta dos veces)');
  assert.equal(fin.cogs, 40, 'costo de lo vendido = 4 × $10');
  assert.equal(fin.gross, 260);
  assert.equal(correr(`valorAntes - valorInventario()`), 40, 'el Valor del inventario bajó exactamente el costo de lo que salió');
  // Aceptar de nuevo es idempotente: mismo trabajo, sin volver a descontar.
  assert.equal(correr(`acceptQuote(q).id`), correr(`job.id`));
  assert.equal(correr(`producto('Breaker').qtyOnHand`), 46);
  assert.equal(correr(`quoteState(q)`), 'accepted');
});

test('una cotización sin stock suficiente descuenta lo que hay y anota lo que faltó', () => {
  const { correr } = nuevaApp({servicios:true});
  correr(`
    bizProfile.services = true; bizProfile.sells = true;
    inventory.push({id:'i1', name:'Breaker', unit:'unidad', costPerUnit:10, qtyOnHand:3, salePrice:25});
    draftQuote = {id:null, client:'Ana', clientId:null, date: localDateStr(), validDays:15, notes:'', discount:0, taxPct:0,
      lines:[{desc:'Breaker', qty:5, unit:'unidad', price:25}]};
    var q = saveQuoteFromDraft(); draftQuote = null;
    var job = acceptQuote(q); resetFinancialCache();
  `);
  assert.equal(correr(`producto('Breaker').qtyOnHand`), 0, 'nunca queda negativo');
  assert.equal(correr(`job.items[0].qty`), 3);
  assert.equal(correr(`job.items[0].short`), 2);
  const fin = JSON.parse(correr(`JSON.stringify(periodFinancials(localMonthStr()))`));
  assert.equal(fin.revenue, 125, 'el ingreso es lo cotizado');
  assert.equal(fin.cogs, 30, 'el costo, solo de lo que de verdad salió');
});

test('eliminar el trabajo de una cotización devuelve sus productos al inventario, una sola vez', () => {
  const { correr } = nuevaApp({servicios:true});
  correr(`
    bizProfile.services = true; bizProfile.sells = true;
    inventory.push({id:'i1', name:'Breaker', unit:'unidad', costPerUnit:10, qtyOnHand:50, salePrice:25});
    draftQuote = {id:null, client:'Ana', clientId:null, date: localDateStr(), validDays:15, notes:'', discount:0, taxPct:0,
      lines:[{desc:'Breaker', qty:4, unit:'unidad', price:25}]};
    var q = saveQuoteFromDraft(); draftQuote = null;
    var job = acceptQuote(q);
    job.deleted = true; var n1 = restoreJobStock(job); var n2 = restoreJobStock(job); saveState(); resetFinancialCache();
  `);
  assert.equal(correr(`n1`), 1);
  assert.equal(correr(`n2`), 0, 'la segunda vez no devuelve nada');
  assert.equal(correr(`producto('Breaker').qtyOnHand`), 50);
  const fin = JSON.parse(correr(`JSON.stringify(periodFinancials(localMonthStr()))`));
  assert.equal(fin.revenue, 0, 'un trabajo borrado no aporta nada');
  assert.equal(fin.cogs, 0);
  // Aceptar de nuevo la cotización crea un trabajo NUEVO (el anterior está borrado).
  correr(`var job2 = acceptQuote(q);`);
  assert.notEqual(correr(`job2.id`), correr(`job.id`));
  assert.equal(correr(`producto('Breaker').qtyOnHand`), 46);
});

test('despagar un trabajo devuelve su cobro al calendario; lo borrado a mano no vuelve', () => {
  const { correr } = nuevaApp({servicios:true});
  correr(`
    bizProfile.services = true;
    var j = {id:'jobA1', type:'service', date: localDateStr(), client:'Ana', price:100, paid:false, dueDate: addDaysStr(localDateStr(), 15), dueDays:15, createdAt:new Date().toISOString(), items:[]};
    recordOutflow(j); saveState();
  `);
  const cobro = `calNotes.find(n=>n.svcKind==='due' && n.jobId==='jobA1')`;
  assert.ok(correr(`!!${cobro}`), 'pendiente: el cobro está en el calendario');
  correr(`j.paid = true; j.paidDate = localDateStr(); j.dueDate = null; saveState();`);
  assert.ok(correr(`!${cobro}`), 'cobrado: el cobro se va');
  assert.equal(correr(`deletedCalNoteIds.length`), 0, 'y no deja lápida: es una nota derivada');
  correr(`j.paid = false; j.paidDate = null; j.dueDate = addDaysStr(localDateStr(), 15); saveState();`);
  assert.ok(correr(`!!${cobro}`), 'despagado: el cobro VUELVE');
  correr(`var id = ${cobro}.id; calNotes = calNotes.filter(n=>n.id!==id); deletedCalNoteIds.push(id); saveState();`);
  assert.ok(correr(`!${cobro}`), 'borrado a mano por el usuario: no se vuelve a crear');
  // Una cuenta con la lápida VIEJA ('svc-due-…', de antes de este cambio) no queda trabada.
  correr(`deletedCalNoteIds = ['svc-due-jobB2']; var k = {id:'jobB2', type:'service', date: localDateStr(), client:'Bo', price:50, paid:false, dueDate: addDaysStr(localDateStr(), 7), dueDays:7, createdAt:new Date().toISOString(), items:[]}; recordOutflow(k); saveState();`);
  assert.ok(correr(`!!calNotes.find(n=>n.svcKind==='due' && n.jobId==='jobB2')`), 'la lápida vieja ya no muerde');
});

test('una cotización abierta aparece en el calendario el día que vence y se va al aceptarla', () => {
  const { correr } = nuevaApp({servicios:true});
  correr(`
    bizProfile.services = true;
    bizProfile.catalog.push({id:'sv1', name:'Flete', desc:'', price:120, unit:'fixed'});
    draftQuote = {id:null, client:'Ana', clientId:null, date: localDateStr(), validDays:7, notes:'', discount:0, taxPct:0, lines:[{desc:'Flete', qty:1, unit:'fixed', price:120}]};
    var q = saveQuoteFromDraft(); draftQuote = null;
  `);
  const nota = `calNotes.find(n=>n.svcKind==='quote' && n.quoteId===q.id)`;
  assert.ok(correr(`!!${nota}`), 'abierta: hay nota');
  assert.equal(correr(`${nota}.date`), correr(`quoteValidUntil(q)`), 'el día que vence');
  assert.match(correr(`${nota}.text`), /Ana/);
  correr(`acceptQuote(q);`);
  assert.ok(correr(`!${nota}`), 'aceptada: la nota se va');
  assert.ok(correr(`!!calNotes.find(n=>n.svcKind==='due' && n.jobId===q.jobId)`), 'y aparece el cobro del trabajo');
});

test('las ocurrencias de un contrato tienen el mismo id en cualquier dispositivo', () => {
  const ids = [1,2].map(()=>{
    const { correr } = nuevaApp({servicios:true});
    correr(`
      bizProfile.services = true;
      recordOutflow({id:'tpl1', type:'service', date: localDateStr(), client:'Ana', serviceName:'Limpieza', price:100, paid:false, dueDays:15, repeat:'weekly', createdAt:new Date().toISOString(), items:[]});
      saveState();
    `);
    return correr(`JSON.stringify(svcJobs().filter(j=>j.parentId==='tpl1').map(j=>j.id+'@'+j.date))`);
  });
  assert.equal(ids[0], ids[1], 'mismo contrato, mismas fechas → mismos ids');
  const lista = JSON.parse(ids[0]);
  assert.ok(lista.length >= 1, 'generó ocurrencias dentro de los 14 días');
  assert.ok(lista.every(s=>/^job-.+@\d{4}-\d{2}-\d{2}$/.test(s)), 'con forma de id de trabajo (job-<contrato>-<fecha>, svcChildId)');
});

test('modo Servicios: un recibo escaneado desde un trabajo es GASTO línea por línea (el diésel no es mercadería con stock)', () => {
  const { correr } = nuevaApp({servicios:true});
  correr(`bizProfile.services = true; bizProfile.sells = false;
    recordOutflow({id:'jf', type:'service', date:'2026-04-01', client:'Flete', serviceName:'Viaje', price:500, paid:false, dueDate:'2026-04-16', dueDays:15, items:[], createdAt:'2026-04-01T00:00:00Z'});
    receiptAttach = {jobId:'jf', assetId:null};`);
  const r = JSON.parse(correr(`JSON.stringify(escanear('Shell', '2026-04-01', [{rawName:'DIESEL', qty:45, unit:'l', totalPrice:180, matchedIngId:'__new__'}]))`));
  assert.equal(r.jobId, 'jf');
  assert.equal(correr(`valorInventario()`), 0, 'nada en el estante');
  assert.equal(correr(`inventory.filter(i=>!isExpenseItem(i)).length`), 0);
  assert.equal(correr(`receiptSplit(receipts[receipts.length-1], finCache()).expense`), 180, 'entra entero como gasto');
  assert.equal(correr(`jobExpenseTotal(jobById('jf'))`), 180);
  // Segundo ticket del mismo producto: se reutiliza el "solo gasto", no nace un producto con stock.
  correr(`receiptAttach = {jobId:'jf', assetId:null};`);
  const diesel = correr(`inventory.find(i=>i.name==='DIESEL').id`);
  correr(`escanear('Shell', '2026-04-03', [{rawName:'DIESEL', qty:40, unit:'l', totalPrice:160, matchedIngId:'${diesel}'}]);`);
  assert.equal(correr(`valorInventario()`), 0);
  assert.equal(correr(`jobExpenseTotal(jobById('jf'))`), 340);
});
