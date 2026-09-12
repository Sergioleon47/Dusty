// patron-core.test.js
//
// Pruebas automáticas de la lógica de patron-core.js. Se corren con:
//   node --test
// (viene incluido con Node, no hace falta instalar nada). Tarda segundos, no minutos,
// y agarra este tipo de bug ANTES de subir el cambio, no después de que un usuario
// real lo reporte.

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  money, escapeHtml, isValidDateStr, localDateStr, localMonthStr, addDaysStr, daysBetweenStr,
  receiptImages, receiptImageSrc, monthKey, monthLabel, shiftMonthStr, lastPriceChangePct,
  profitMarginPct, sameJSON, normalizeBizProfile, maintStatus, quoteTotals
} = require('./patron-core.js');

test('money formatea números y cae en $0.00 si no es un número', () => {
  assert.equal(money(12.5), '$12.50');
  assert.equal(money(0), '$0.00');
  assert.equal(money(NaN), '$0.00');
  assert.equal(money(undefined), '$0.00');
});

test('money con un total en TEXTO no tira la app (bug real: reventaba render entero)', () => {
  // isNaN('50') es false, pero '50'.toFixed no existe -> TypeError. El parser de IA
  // (o un import) puede devolver el total como string y llega a todo el equipo por la nube.
  assert.equal(money('50'), '$50.00');
  assert.equal(money('12.5'), '$12.50');
  assert.equal(money(''), '$0.00');
  assert.equal(money('abc'), '$0.00');
  assert.equal(money(null), '$0.00');
  assert.equal(money(Infinity), '$0.00');
  assert.equal(money(-3.2), '$-3.20');
});

test('escapeHtml neutraliza los 5 caracteres peligrosos y tolera null/undefined', () => {
  assert.equal(escapeHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(escapeHtml('a" onerror="evil'), 'a&quot; onerror=&quot;evil'); // breakout de atributo
  assert.equal(escapeHtml("O'Brien & Co"), 'O&#39;Brien &amp; Co');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(42), '42'); // números pasan a string sin romper
});

test('isValidDateStr acepta solo YYYY-MM-DD con día/mes reales', () => {
  assert.equal(isValidDateStr('2026-08-23'), true);
  assert.equal(isValidDateStr('2026-02-29'), false); // 2026 no es bisiesto
  assert.equal(isValidDateStr('2024-02-29'), true);  // 2024 sí
  assert.equal(isValidDateStr('2026-13-01'), false);
  assert.equal(isValidDateStr('2026-08-40'), false);
  assert.equal(isValidDateStr('23/08/2026'), false);
  assert.equal(isValidDateStr('<img src=x>'), false);
  assert.equal(isValidDateStr(''), false);
  assert.equal(isValidDateStr(undefined), false);
});

test('localDateStr/localMonthStr usan la fecha local, no UTC', () => {
  // 15 de enero a las 2am — si usara toISOString() (UTC) en vez de hora local,
  // en varias zonas horarias de América esto se leería como el día 14.
  const d = new Date(2026, 0, 15, 2, 0, 0);
  assert.equal(localDateStr(d), '2026-01-15');
  assert.equal(localMonthStr(d), '2026-01');
});

test('addDaysStr suma y resta días cruzando meses y años', () => {
  assert.equal(addDaysStr('2026-01-30', 5), '2026-02-04');
  assert.equal(addDaysStr('2026-12-30', 5), '2027-01-04');
  assert.equal(addDaysStr('2026-03-10', -15), '2026-02-23');
});

test('daysBetweenStr cuenta días completos entre dos fechas', () => {
  assert.equal(daysBetweenStr('2026-08-01', '2026-08-10'), 9);
  assert.equal(daysBetweenStr('2026-08-10', '2026-08-01'), -9);
  assert.equal(daysBetweenStr('2026-08-01', '2026-08-01'), 0);
});

test('receiptImages soporta el formato nuevo (varias páginas) y el viejo (una foto)', () => {
  assert.deepEqual(receiptImages({images:[{base64:'a'}]}), [{base64:'a'}]);
  assert.deepEqual(receiptImages({imageBase64:'b', mediaType:'image/png'}), [{base64:'b', mediaType:'image/png'}]);
  assert.deepEqual(receiptImages({}), []);
  assert.deepEqual(receiptImages({images:[]}), []); // array vacío no cuenta, debe caer al formato viejo/nada
});

test('receiptImageSrc prioriza el base64 local (instantáneo, sin red) sobre la URL de Storage', () => {
  assert.equal(receiptImageSrc({base64:'YWJj', mediaType:'image/jpeg'}), 'data:image/jpeg;base64,YWJj');
  // Segundo dispositivo / compañero de equipo: no escaneó esta página, solo tiene la URL de la nube
  assert.equal(receiptImageSrc({url:'https://storage.example/page1.jpg', mediaType:'image/jpeg'}), 'https://storage.example/page1.jpg');
  // Ya se subió desde este mismo dispositivo: tiene las dos cosas, gana el base64 local
  assert.equal(receiptImageSrc({base64:'YWJj', mediaType:'image/jpeg', url:'https://storage.example/page1.jpg'}), 'data:image/jpeg;base64,YWJj');
  assert.equal(receiptImageSrc({}), '');
  assert.equal(receiptImageSrc(null), '');
});

test('monthKey y monthLabel', () => {
  assert.equal(monthKey('2026-08-05'), '2026-08');
  assert.equal(monthKey(''), '');
  assert.equal(monthLabel('2026-08', 'es'), 'Ago 2026');
  assert.equal(monthLabel('2026-08', 'en'), 'Aug 2026');
  // "Sept" con t en inglés (la abreviatura convencional); "Sep" en español.
  assert.equal(monthLabel('2026-09', 'en'), 'Sept 2026');
  assert.equal(monthLabel('2026-09', 'es'), 'Sep 2026');
  assert.equal(monthLabel('2026-01', 'es'), 'Ene 2026');
  // Sin "lang" no debe reventar, y cae en INGLÉS — el idioma principal de la app.
  assert.equal(monthLabel('2026-01'), 'Jan 2026');
});

test('shiftMonthStr navega meses hacia adelante/atrás cruzando años', () => {
  assert.equal(shiftMonthStr('2026-08', 1), '2026-09');
  assert.equal(shiftMonthStr('2026-08', -1), '2026-07');
  assert.equal(shiftMonthStr('2026-01', -1), '2025-12');
  assert.equal(shiftMonthStr('2026-12', 1), '2027-01');
  assert.equal(shiftMonthStr('2026-08', 12), '2027-08'); // salto de año completo (vista de año)
  assert.equal(shiftMonthStr('2026-08', -12), '2025-08');
});

test('profitMarginPct calcula el margen sobre el precio de venta, no el markup', () => {
  // comprás a $10, vendés a $15 -> 33% de margen, NO 50%
  assert.ok(Math.abs(profitMarginPct(10, 15) - 33.33) < 0.01);
  assert.equal(profitMarginPct(10, 0), null); // sin precio de venta no hay margen
  assert.equal(profitMarginPct(10, -5), null);
});

test('lastPriceChangePct: caso normal, mismo producto, misma unidad', () => {
  const purchases = [
    {ingId:'i1', qty:5, unit:'lb', totalPrice:20, date:'2026-07-01'},
    {ingId:'i1', qty:5, unit:'lb', totalPrice:25, date:'2026-08-01'}
  ];
  assert.equal(lastPriceChangePct('i1', purchases), 25);
});

test('lastPriceChangePct: dos compras el MISMO día — gana la que entró después', () => {
  // Bug real: con fechas iguales (solo YYYY-MM-DD), el sort estable dejaba primero
  // la compra más vieja del día y el % salía con el signo invertido (−20% en vez
  // de +25% para harina que subió de $4 a $5 en el mismo día).
  const purchases = [
    {ingId:'i1', qty:1, unit:'lb', totalPrice:4, date:'2026-08-01'}, // mañana: $4/lb
    {ingId:'i1', qty:1, unit:'lb', totalPrice:5, date:'2026-08-01'}  // tarde: $5/lb
  ];
  assert.equal(lastPriceChangePct('i1', purchases), 25);
});

test('lastPriceChangePct: unidades distintas -> "unit-mismatch", nunca un % inventado', () => {
  // Este es el bug real de hoy: "Margarita Salt" comparando 1 "unidad" contra 5 "lb"
  // mostraba una suba de precio de 847% que no era real.
  const purchases = [
    {ingId:'i1', qty:1, unit:'unidad', totalPrice:5, date:'2026-07-01'},
    {ingId:'i1', qty:5, unit:'lb', totalPrice:20, date:'2026-08-01'}
  ];
  assert.equal(lastPriceChangePct('i1', purchases), 'unit-mismatch');
});

test('lastPriceChangePct: compras viejas sin "unit" (undefined) también cuentan como distintas', () => {
  const purchases = [
    {ingId:'i1', qty:1, totalPrice:5, date:'2026-07-01'}, // compra vieja, sin campo "unit"
    {ingId:'i1', qty:5, unit:'lb', totalPrice:20, date:'2026-08-01'}
  ];
  assert.equal(lastPriceChangePct('i1', purchases), 'unit-mismatch');
});

test('lastPriceChangePct: menos de 2 compras -> null, no hay nada que comparar', () => {
  assert.equal(lastPriceChangePct('i1', []), null);
  assert.equal(lastPriceChangePct('i1', [{ingId:'i1', qty:1, unit:'lb', totalPrice:5, date:'2026-08-01'}]), null);
});

test('lastPriceChangePct: ignora compras de otros productos', () => {
  const purchases = [
    {ingId:'i1', qty:5, unit:'lb', totalPrice:20, date:'2026-07-01'},
    {ingId:'i2', qty:1, unit:'unidad', totalPrice:999, date:'2026-07-15'}, // otro producto, no debe afectar
    {ingId:'i1', qty:5, unit:'lb', totalPrice:25, date:'2026-08-01'}
  ];
  assert.equal(lastPriceChangePct('i1', purchases), 25);
});

test('sameJSON: mismos datos en otro orden de propiedades -> igual, no "distinto"', () => {
  // Este es el bug real: Firestore no garantiza devolver los campos de un doc en el
  // mismo orden en que se guardaron (típicamente los reordena). Un recibo recién
  // escaneado localmente (id primero) contra el mismo recibo tal como vuelve de
  // Firestore (orden distinto) debía compararse como IGUAL -- antes, con un
  // JSON.stringify plano, se veía como "distinto" y disparaba un reemplazo +
  // redibujado completo innecesario cada vez que se reconectaba a la nube.
  const local = {id:'r1', images:[{base64:'a'}], supplier:'X', date:'2026-08-19', total:50};
  const fromFirestore = {date:'2026-08-19', id:'r1', supplier:'X', total:50, images:[{base64:'a'}]};
  assert.equal(sameJSON(local, fromFirestore), true);
  assert.equal(sameJSON([local], [fromFirestore]), true);
});

test('sameJSON: detecta diferencias reales de contenido, sin importar el orden', () => {
  const a = {id:'r1', total:50, images:[{base64:'a'}]};
  const b = {total:47, id:'r1', images:[{base64:'a'}]}; // total realmente cambió
  assert.equal(sameJSON(a, b), false);
  assert.equal(sameJSON({a:1}, {a:1,b:2}), false); // falta una propiedad
  assert.equal(sameJSON([1,2,3], [1,3,2]), false); // el orden SÍ importa dentro de un array
});

/* ---------- Producción (recetas que descuentan inventario) ---------- */
const { roundQty, recipeCostTotal, productionPlan, detectedQtyFromReading } = require('./patron-core.js');

test('recipeCostTotal: suma cantidad × costo actual de cada insumo', () => {
  const inv = [
    {id:'i1', name:'Cuenta turquesa', costPerUnit:0.5},
    {id:'i2', name:'Dije dorado', costPerUnit:3}
  ];
  const comps = [{ingId:'i1', qty:38}, {ingId:'i2', qty:1}];
  assert.deepEqual(recipeCostTotal(comps, inv), {total:22, missing:0});
});

test('recipeCostTotal: un insumo borrado del inventario cuenta como "missing", no revienta', () => {
  const inv = [{id:'i1', costPerUnit:2}];
  const comps = [{ingId:'i1', qty:3}, {ingId:'fantasma', qty:10}];
  assert.deepEqual(recipeCostTotal(comps, inv), {total:6, missing:1});
  // cantidad basura (string no numérico, negativa) tampoco revienta
  assert.deepEqual(recipeCostTotal([{ingId:'i1', qty:'abc'}, {ingId:'i1', qty:-2}], inv), {total:0, missing:2});
  assert.deepEqual(recipeCostTotal([], inv), {total:0, missing:0});
  assert.deepEqual(recipeCostTotal(null, inv), {total:0, missing:0});
});

test('recipeCostTotal: costo no numérico cuenta como "missing", no como $0 silencioso', () => {
  // Dato viejo/sincronizado tipo costPerUnit:"1,50" — antes aportaba $0 sin aviso
  // y el costo de la receta quedaba subestimado. costPerUnit:0 sigue siendo válido.
  const inv = [{id:'i1', costPerUnit:'1,50'}, {id:'i2', costPerUnit:2}, {id:'i3', costPerUnit:0}];
  assert.deepEqual(recipeCostTotal([{ingId:'i1', qty:3}, {ingId:'i2', qty:1}], inv), {total:2, missing:1});
  assert.deepEqual(recipeCostTotal([{ingId:'i3', qty:5}], inv), {total:0, missing:0});
});

test('recipeCostTotal: sin colas de float (0.1×3 debe dar 0.3, no 0.30000000000000004)', () => {
  const inv = [{id:'i1', costPerUnit:0.1}];
  assert.equal(recipeCostTotal([{ingId:'i1', qty:3}], inv).total, 0.3);
});

test('productionPlan: descuenta por pieza × cantidad producida y frena en 0', () => {
  const inv = [
    {id:'i1', name:'Chips', unit:'g', qtyOnHand:100},
    {id:'i2', name:'Dije', unit:'unidad', qtyOnHand:1}
  ];
  const comps = [{ingId:'i1', qty:15}, {ingId:'i2', qty:1}];
  const plan = productionPlan(comps, 3, inv);
  // Chips: alcanza (45 de 100)
  assert.deepEqual(plan[0], {ingId:'i1', name:'Chips', unit:'g', deduct:45, current:100, after:55, short:0, missing:false});
  // Dije: NO alcanza (necesita 3, hay 1) — after queda en 0, short dice cuánto faltó
  assert.deepEqual(plan[1], {ingId:'i2', name:'Dije', unit:'unidad', deduct:3, current:1, after:0, short:2, missing:false});
});

test('productionPlan: cantidad inválida o cero devuelve plan vacío; insumo borrado se marca missing', () => {
  const inv = [{id:'i1', name:'X', unit:'g', qtyOnHand:10}];
  assert.deepEqual(productionPlan([{ingId:'i1', qty:1}], 0, inv), []);
  assert.deepEqual(productionPlan([{ingId:'i1', qty:1}], NaN, inv), []);
  assert.deepEqual(productionPlan([{ingId:'i1', qty:1}], -2, inv), []);
  const plan = productionPlan([{ingId:'borrado', qty:5}], 2, inv);
  assert.equal(plan[0].missing, true);
  assert.equal(plan[0].name, null);
  assert.equal(plan[0].short, 0); // sin producto no hay faltante que reportar
});

test('detectedQtyFromReading: conteo directo gana; porcentaje necesita capacidad', () => {
  // Conteo directo de unidades visibles — la capacidad no hace falta
  assert.equal(detectedQtyFromReading({count:12}, null), 12);
  // Nivel del envase: 30% de un frasco de 500 g = 150 g
  assert.equal(detectedQtyFromReading({count:null, fill_percent:30}, 500), 150);
  // % sin capacidad declarada → null (el llamador pide el dato, no se inventa)
  assert.equal(detectedQtyFromReading({fill_percent:30}, null), null);
  assert.equal(detectedQtyFromReading({fill_percent:30}, 0), null);
  // % arriba de 100 (lectura rara de la IA) se recorta a la capacidad, no la supera
  assert.equal(detectedQtyFromReading({fill_percent:140}, 500), 500);
  // sin nada legible → null
  assert.equal(detectedQtyFromReading({}, 500), null);
  assert.equal(detectedQtyFromReading(null, 500), null);
  // conteo negativo (basura) no pasa
  assert.equal(detectedQtyFromReading({count:-3}, null), null);
});

test('roundQty: 2 decimales estándar para cantidades de stock', () => {
  assert.equal(roundQty(4.999999999), 5);
  assert.equal(roundQty(0.1+0.2), 0.3);
  assert.equal(roundQty(1.005*100)/1, 100.5);
});

test('valueHash: mismo contenido con claves en otro orden = mismo hash (Firestore reordena campos)', () => {
  const { valueHash, hash53 } = require('./patron-core.js');
  const a = { name:'Tomate', qty: 3, nested: { x:1, y:[1,2,{z:true}] } };
  const b = { nested: { y:[1,2,{z:true}], x:1 }, qty: 3, name:'Tomate' };
  assert.equal(valueHash(a), valueHash(b));
  // Cambios reales sí cambian el hash
  assert.notEqual(valueHash(a), valueHash({ ...a, qty: 4 }));
  assert.notEqual(valueHash({v:'AB'}), valueHash({v:'BA'})); // sensible al orden dentro de strings
  // Determinista entre corridas (se persiste en localStorage entre sesiones)
  assert.equal(hash53('dusty'), hash53('dusty'));
  assert.equal(typeof hash53('x'), 'number');
});

test('stableStringify trata undefined igual que JSON.stringify (clave del sync por hash)', () => {
  const { sameJSON, valueHash } = require('./patron-core.js');
  // Una clave con undefined NO debe distinguir dos docs que en la nube son idénticos
  const local = { url:'u', mediaType:'image/jpeg', path: undefined };
  const cloud = JSON.parse(JSON.stringify(local)); // así viaja al upload: sin "path"
  assert.equal(valueHash(local), valueHash(cloud));
  assert.ok(sameJSON(local, cloud));
  // En arrays, undefined se comporta como null (igual que JSON.stringify)
  assert.equal(valueHash([1, undefined, 3]), valueHash([1, null, 3]));
  // Pero un valor REAL distinto sí distingue
  assert.notEqual(valueHash({a:1}), valueHash({a:2}));
});

/* ===== PRESUPUESTO (auditoría 2026-09-07): lógica pura ===== */
const { formatMoney, normalizeBudgetMeta, freezeBudgetHistory, carryFromPrevious, computeBudgetPace } = require('./patron-core.js');

test('formatMoney: los tres formatos regionales y negativos', () => {
  assert.equal(formatMoney(1234567.5, 'plain'), '$1234567.50');
  assert.equal(formatMoney(1234567.5, 'us'), '$1,234,567.50');
  assert.equal(formatMoney(1234567.5, 'latam'), '$1.234.567,50');
  assert.equal(formatMoney(-1500, 'latam'), '-$1.500,00');
  assert.equal(formatMoney(999, 'us'), '$999.00');
  assert.equal(formatMoney('abc', 'us'), '$0.00');
});

test('normalizeBudgetMeta: basura afuera, valores por defecto adentro', () => {
  const m = normalizeBudgetMeta({ byMonth:{'2026-08':1000, 'x':5, '2026-07':-3}, alertPct:'70', cogsTargetPct:150, byCategory:{a:50, b:0}, rollover:'yes' });
  assert.deepEqual(m.byMonth, {'2026-08':1000});
  assert.equal(m.alertPct, 70);
  assert.equal(m.cogsTargetPct, null);
  assert.deepEqual(m.byCategory, {a:50});
  assert.equal(m.rollover, false);
  const d = normalizeBudgetMeta(null);
  assert.deepEqual(d, { byMonth:{}, alerted:{}, byCategory:{}, rollover:false, alertPct:80, cogsTargetPct:null });
});

test('freezeBudgetHistory: los meses cerrados conservan el viejo, el actual toma el nuevo', () => {
  const out = freezeBudgetHistory({}, ['2026-09','2026-08','2026-07'], 1000, 1500, '2026-09');
  assert.deepEqual(out, {'2026-08':1000, '2026-07':1000, '2026-09':1500});
  // Un mes que ya tenía valor propio no se pisa; los futuros se limpian.
  const out2 = freezeBudgetHistory({'2026-08':900, '2026-10':2000}, ['2026-08'], 1000, 1500, '2026-09');
  assert.deepEqual(out2, {'2026-08':900, '2026-09':1500});
  // Sin cambio de monto no se congela nada; vaciar el presupuesto borra el actual.
  assert.deepEqual(freezeBudgetHistory({}, ['2026-08'], 1000, 1000, '2026-09'), {'2026-09':1000});
  assert.deepEqual(freezeBudgetHistory({'2026-09':1000}, ['2026-08'], 1000, null, '2026-09'), {'2026-08':1000});
});

test('carryFromPrevious: solo lo que sobró, nunca negativo, con tope', () => {
  assert.equal(carryFromPrevious(1000, 850, 1000), 150);
  assert.equal(carryFromPrevious(1000, 1200, 1000), 0);
  assert.equal(carryFromPrevious(null, 0, 1000), 0);
  assert.equal(carryFromPrevious(3000, 0, 1000), 1000);
});

test('computeBudgetPace: porcentaje, restante, ritmo y estado', () => {
  const p = computeBudgetPace({ budget:1000, expense:850, daysInMonth:30, dayOfMonth:7, isCurrent:true, threshold:80 });
  assert.equal(Math.round(p.pct), 85);
  assert.equal(p.left, 150);
  assert.equal(Math.round(p.expectedPct), 23);
  assert.equal(p.projected, 3643);
  assert.equal(p.fast, true);
  assert.equal(p.status, 'warn');
  // Va bien: 20% gastado el día 15 → ok, proyección bajo el presupuesto.
  const ok = computeBudgetPace({ budget:1000, expense:200, daysInMonth:30, dayOfMonth:15, isCurrent:true });
  assert.equal(ok.status, 'ok');
  assert.equal(ok.projected, 400);
  // Ritmo rápido antes del umbral: warn aunque el % sea bajo.
  const fast = computeBudgetPace({ budget:1000, expense:500, daysInMonth:30, dayOfMonth:5, isCurrent:true });
  assert.equal(fast.status, 'warn');
  assert.equal(fast.fast, true);
  // Pasado el 100% → crit; mes cerrado no proyecta.
  const over = computeBudgetPace({ budget:1000, expense:1200, daysInMonth:31, dayOfMonth:31, isCurrent:false });
  assert.equal(over.status, 'crit');
  assert.equal(over.projected, null);
  // Sin presupuesto → null; día 2 → sin proyección todavía.
  assert.equal(computeBudgetPace({ budget:0, expense:10 }), null);
  assert.equal(computeBudgetPace({ budget:1000, expense:10, daysInMonth:30, dayOfMonth:2, isCurrent:true }).projected, null);
});


/* ---------- mergeReceiptPages: páginas de un mismo recibo leídas por separado ---------- */
const { mergeReceiptPages } = require('./patron-core.js');

test('mergeReceiptPages: concatena items, corrige duplicate_of y toma el total general de la última página', () => {
  const p1 = { supplier:'ElectroSupply', date:'2026-09-01', invoice_total:150, items:[
    { raw_name:'A', total_price:100, duplicate_of:null }, { raw_name:'B', total_price:50, duplicate_of:0 } ] };
  const p2 = { supplier:'ElectroSupply', date:null, invoice_total:200, items:[
    { raw_name:'C', total_price:200, duplicate_of:null } ] };
  const p3 = { supplier:null, date:null, invoice_total:350, items:[], truncated:false };
  const m = mergeReceiptPages([p1, p2, p3]);
  assert.equal(m.supplier, 'ElectroSupply');
  assert.equal(m.date, '2026-09-01');
  assert.equal(m.items.length, 3);
  assert.equal(m.items[1].duplicate_of, 0);   // misma página: no cambia
  assert.equal(m.items[2].raw_name, 'C');
  assert.equal(m.invoice_total, 350);          // el total general, no un subtotal
  assert.equal(m.truncated, false);
});

test('mergeReceiptPages: si ninguna página vio el total general, usa la suma de los renglones', () => {
  const m = mergeReceiptPages([
    { supplier:'X', invoice_total:100, items:[{ total_price:60 }, { total_price:40 }] },
    { supplier:'X', invoice_total:80,  items:[{ total_price:80 }] },
  ]);
  assert.equal(m.invoice_total, 180); // 100 y 80 son subtotales de página, no el total
});

test('mergeReceiptPages: duplicate_of de la segunda página se desplaza al índice global', () => {
  const m = mergeReceiptPages([
    { items:[{ total_price:1 }, { total_price:1 }] },
    { items:[{ total_price:1 }, { total_price:1, duplicate_of:0 }] },
  ]);
  assert.equal(m.items[3].duplicate_of, 2);
});

test('mergeReceiptPages: truncated solo cuenta en la última página; páginas nulas se ignoran', () => {
  const m = mergeReceiptPages([ { items:[{ total_price:5 }], truncated:true }, null, { items:[], truncated:false } ]);
  assert.equal(m.truncated, false);
  assert.equal(m.items.length, 1);
  assert.equal(m.invoice_total, 5);
  assert.equal(mergeReceiptPages([]).invoice_total, null);
});

/* ---------- Composición de una pieza (BOM) y costeo del producto terminado ---------- */
const { bomRows, bomTotal, weightedAvgCost } = require('./patron-core.js');

test('bomRows abre la cuenta de una pieza: cantidad, costo unitario y subtotal', () => {
  const inv = [
    {id:'i1', name:'Harina', unit:'lb', costPerUnit:5},
    {id:'i2', name:'Queso',  unit:'lb', costPerUnit:12}
  ];
  const comps = [{ingId:'i1', qty:1}, {ingId:'i2', qty:0.2}];
  const rows = bomRows(comps, inv, 1);
  assert.deepEqual(rows.map(r=>[r.name, r.qty, r.cost, r.subtotal]), [
    ['Harina', 1, 5, 5],
    ['Queso', 0.2, 12, 2.4]
  ]);
  assert.equal(bomTotal(rows), 7.4, 'cuesta $7.40 hacer una');
});

test('bomRows multiplica por la cantidad a producir', () => {
  const inv = [{id:'i1', name:'Harina', unit:'lb', costPerUnit:5}];
  const rows = bomRows([{ingId:'i1', qty:1.5}], inv, 10);
  assert.equal(rows[0].qty, 15, '1.5 lb por pieza × 10 piezas');
  assert.equal(rows[0].qtyPerPiece, 1.5, 'y se conserva cuánto lleva UNA');
  assert.equal(bomTotal(rows), 75);
});

test('un insumo borrado sale marcado, no como $0 en silencio', () => {
  // Era el bug que ya cazaba recipeCostTotal: un costo que falta no puede
  // sumar cero calladito, porque deja el costo de producción subestimado.
  const rows = bomRows([{ingId:'fantasma', qty:2}], [], 1);
  assert.equal(rows[0].missing, true);
  assert.equal(rows[0].name, null);
  assert.equal(rows[0].cost, null);
  assert.equal(rows[0].subtotal, 0);
  assert.equal(bomTotal(rows), 0);
});

test('un costo que no es número usable también se marca', () => {
  // Dato viejo o sincronizado como "1,50": Number() da NaN.
  const inv = [{id:'i1', name:'Harina', unit:'lb', costPerUnit:'1,50'}];
  const rows = bomRows([{ingId:'i1', qty:2}], inv, 1);
  assert.equal(rows[0].missing, true);
  assert.equal(rows[0].subtotal, 0);
});

test('weightedAvgCost promedia las tandas en vez de pisar el costo', () => {
  // 100 piezas a $4 (=$400) + 50 piezas que costaron $300 => $700 / 150.
  assert.equal(weightedAvgCost(100, 4, 50, 300), 4.6667);
  // Primera tanda: no hay nada con qué promediar.
  assert.equal(weightedAvgCost(0, 0, 100, 400), 4);
});

test('weightedAvgCost no pisa el costo cuando no entra nada', () => {
  // Producir 0 piezas (o un dato roto) no puede poner el costo en cero: eso
  // valuaría el stock existente en $0 sin que nadie lo pidiera.
  assert.equal(weightedAvgCost(10, 7, 0, 0), 7);
  assert.equal(weightedAvgCost(10, 7, NaN, 500), 7);
});

test('weightedAvgCost aguanta stock negativo o basura sin explotar', () => {
  assert.equal(weightedAvgCost(-5, 4, 10, 40), 4);
  assert.equal(weightedAvgCost(null, null, 10, 40), 4);
});

/* ===== Modo Servicios (2026-09-11) ===== */
test('normalizeBizProfile: vacío o basura cae a vende productos, sin servicios', () => {
  const p = normalizeBizProfile(null);
  assert.equal(p.sells, true); assert.equal(p.services, false);
  assert.equal(p.remindOverdue, true); assert.equal(p.maintDays, 7);
  assert.deepEqual(p.assets, []); assert.deepEqual(p.catalog, []);
  assert.equal(normalizeBizProfile('x').sells, true);
  assert.equal(normalizeBizProfile({maintDays: 99}).maintDays, 7);
  assert.equal(normalizeBizProfile({maintDays: 14}).maintDays, 14);
  assert.equal(p.distUnit, 'km');
  assert.equal(normalizeBizProfile({distUnit: 'mi'}).distUnit, 'mi');
  assert.equal(normalizeBizProfile({distUnit: 'leguas'}).distUnit, 'km');
  assert.equal(p.remindDays, 3);
  assert.equal(p.useOdometer, true); assert.equal(p.catsSeeded, false);
  assert.equal(normalizeBizProfile({useOdometer: false}).useOdometer, false);
  assert.equal(normalizeBizProfile({remindDays: 7}).remindDays, 7);
  assert.equal(normalizeBizProfile({remindDays: 5}).remindDays, 3);
});
test('normalizeBizProfile: limpia activos, mantenimientos y servicios', () => {
  const p = normalizeBizProfile({sells:false, services:true, assets:[
    {id:'a1', name:'Camión 2', model:'Isuzu', km:'148300', purchasePrice:52000, purchaseDate:'2024-03-01',
      maint:[{id:'m1', name:'Aceite', everyKm:5000, everyMonths:3, lastDate:'2026-06-01', lastKm:145000}, {name:'sin id'}, null]},
    {id:'a2'}, null
  ], catalog:[{id:'s1', name:'Viaje local', price:'1450', unit:'nope'}, {id:'s2', name:'Por km', price:9.8, unit:'km'}]});
  assert.equal(p.sells, false); assert.equal(p.services, true);
  assert.equal(p.assets.length, 1);
  assert.equal(p.assets[0].km, 148300);
  assert.equal(p.assets[0].emoji, '🚚');
  assert.equal(p.assets[0].maint.length, 1);
  assert.equal(p.assets[0].maint[0].everyKm, 5000);
  assert.equal(p.catalog.length, 2);
  assert.equal(p.catalog[0].unit, 'fixed'); assert.equal(p.catalog[0].price, 1450);
  assert.equal(p.catalog[1].unit, 'km');
});
test('maintStatus: por km y por meses, gana el más urgente', () => {
  const asset = {km: 148300};
  // 5.000 km desde 145.000 → vence a 150.000: quedan 1.700 (ok, el aviso es a 500)
  assert.equal(maintStatus({everyKm:5000, lastKm:145000}, asset, '2026-09-11', 7).status, 'ok');
  assert.equal(maintStatus({everyKm:5000, lastKm:145000}, asset, '2026-09-11', 7).kmLeft, 1700);
  // 3 meses desde el 1 de junio → 1 de septiembre: vencido hace 10 días
  const m = maintStatus({everyKm:5000, lastKm:145000, everyMonths:3, lastDate:'2026-06-01'}, asset, '2026-09-11', 7);
  assert.equal(m.status, 'overdue'); assert.equal(m.daysLeft, -10); assert.equal(m.dueDate, '2026-09-01');
  // 12 meses desde nov 2025 → nov 2026: lejos es ok; a 3 días con aviso de 7 es pronto
  assert.equal(maintStatus({everyMonths:12, lastDate:'2025-11-15'}, asset, '2026-09-11', 30).status, 'ok');
  assert.equal(maintStatus({everyMonths:12, lastDate:'2025-11-15'}, asset, '2026-11-12', 7).status, 'soon');
  // Sin último hecho no hay nada que contar
  assert.equal(maintStatus({everyKm:5000}, asset, '2026-09-11', 7).status, 'none');
  assert.equal(maintStatus({everyKm:5000, lastKm:145000}, {}, '2026-09-11', 7).status, 'none');
});
test('quoteTotals: líneas × cantidad, descuento acotado, impuesto sobre lo neto, centavos', () => {
  const q = {lines:[{qty:3, price:200}, {qty:2, price:35.5}, {qty:0, price:99}, {qty:1, price:-5}, {qty:'x', price:10}, null], discount: 50, taxPct: 16};
  const tt = quoteTotals(q);
  assert.equal(tt.subtotal, 671);          // 600 + 71; las líneas inválidas no suman
  assert.equal(tt.discount, 50);
  assert.equal(tt.tax, 99.36);             // (671-50) × 16% = 99.36
  assert.equal(tt.total, 720.36);
  // Descuento mayor que el subtotal se acota; impuesto fuera de rango se ignora.
  assert.deepEqual(quoteTotals({lines:[{qty:1, price:10}], discount: 999, taxPct: 250}), {subtotal:10, discount:10, tax:0, total:0});
  // Basura → ceros, nunca NaN.
  assert.deepEqual(quoteTotals(null), {subtotal:0, discount:0, tax:0, total:0});
  assert.deepEqual(quoteTotals({lines:'nope', discount:'abc', taxPct:null}), {subtotal:0, discount:0, tax:0, total:0});
  // Redondeo a centavos por paso: 3 × 0.1 no arrastra 0.30000000000000004.
  assert.equal(quoteTotals({lines:[{qty:3, price:0.1}]}).total, 0.3);
});
test('normalizeBizProfile: cotizaciones (impuesto, validez, condiciones) y clientes', () => {
  const p = normalizeBizProfile(null);
  assert.equal(p.taxPct, 0); assert.equal(p.quoteValidDays, 15); assert.equal(p.quoteTerms, ''); assert.deepEqual(p.clients, []);
  const q = normalizeBizProfile({taxPct:'16', quoteValidDays:30, quoteTerms:'50% anticipo', clients:[
    {id:'c1', name:'Juan Pérez', phone:'+52 55 1234 5678', email:'JUAN@correo.com ', notes:'Col. Centro'},
    {id:'c2', name:'sin correo', email:'no-es-correo'}, {name:'sin id'}, null, {id:'c4'}
  ]});
  assert.equal(q.taxPct, 16); assert.equal(q.quoteValidDays, 30); assert.equal(q.quoteTerms, '50% anticipo');
  assert.equal(q.clients.length, 2);
  assert.equal(q.clients[0].phone, '+52 55 1234 5678');
  assert.equal(q.clients[0].email, 'juan@correo.com');   // se guarda en minúsculas y sin espacios
  assert.equal(q.clients[1].email, '');                  // un correo inválido no se guarda
  assert.equal(normalizeBizProfile({taxPct: 150}).taxPct, 0);
  assert.equal(normalizeBizProfile({taxPct: -3}).taxPct, 0);
  assert.equal(normalizeBizProfile({quoteValidDays: 45}).quoteValidDays, 15);
});
