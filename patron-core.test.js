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
  profitMarginPct, sameJSON
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
  assert.equal(monthLabel('2026-01', 'es'), 'Ene 2026'); // sin "lang" no debe reventar
  assert.equal(monthLabel('2026-01'), 'Ene 2026');
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
