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

function nuevaApp(){
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
    function recipeById(){ return null; }
    var currentUser = null;
    var priceAlertThreshold = 15, businessName = '', monthlyBudget = null;
    var budgetMeta = normalizeBudgetMeta(null);
    var profitsVisibleToMembers = false, categories = null, expenseCategories = [];
    var cycleCountPct = 20, cycleCountIntervalDays = 3, cycleCountLastDate = null, cycleCountCursor = 0;
    var recipes = [], deletedRecipeIds = [], outflows = [], outflowArchive = {};

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
  assert.equal(correr(`producto('Tomate').costPerUnit`), 8);

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

test('un recibo viejo sin compras avisa que el stock no se puede restar solo', () => {
  // purchaseIds se guarda desde hace un tiempo; los recibos anteriores no lo
  // tienen, así que no hay cómo saber cuánto sumó cada línea. Antes se borraban
  // en silencio y el Valor del inventario no se movía sin ninguna explicación.
  const { correr, sandbox } = nuevaApp();
  correr(`
    inventory.push({id:'i1', name:'Cable 10-2', unit:'unidad', costPerUnit:45, qtyOnHand:16, stockFullRef:16});
    receipts.push({id:'rv', images:[], supplier:'Home Depot', date:'2026-09-01', total:720, itemCount:1,
      appliedItems:[{rawName:'Cable 10-2', qty:16, unit:'unidad', totalPrice:720, ingName:'Cable 10-2', ingId:'i1'}],
      createdAt:''});
  `);
  // Se pregunta ANTES de borrar: cancelar no borra nada.
  correr(`__avisos=[]; __confirms=[true, false]; deleteReceipt('rv')`);
  assert.equal(correr(`receipts.length`), 1, 'cancelar el aviso deja el recibo donde estaba');

  correr(`__avisos=[]; __confirms=[true, true]; deleteReceipt('rv')`);
  assert.equal(correr(`receipts.length`), 0);
  assert.equal(correr(`valorInventario()`), 720, 'el stock sigue ahí: no hay compras que digan cuánto restar');
  assert.match(correr(`ultimoAviso()`), /corregirlo a mano/, 'y ahora lo dice, en vez de callarse');
  assert.equal(sandbox.__confirms.length, 0, 'no pregunta por revertir: no hay nada que revertir');
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
