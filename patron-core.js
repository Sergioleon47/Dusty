// patron-core.js
//
// Funciones de cálculo puras (precios, fechas, unidades) separadas del resto de la
// app — sin esto, cada cambio a esta lógica solo se podía verificar abriendo la app
// entera a mano. Estas funciones no tocan el DOM ni dependen de variables globales:
// reciben todo lo que necesitan como parámetro, así que se pueden probar solas con
// Node (ver patron-core.test.js), en segundos, sin abrir un navegador.
//
// index.html las carga con <script src="patron-core.js"> antes de su propio script,
// así que quedan disponibles como funciones globales normales para el resto de la
// app — nada cambia en cómo se despliega (siguen siendo archivos estáticos sueltos).

// Antes: '$'+(isNaN(n)?'0.00':n.toFixed(2)). El problema: isNaN('50') es false (JS
// convierte el string a número para el chequeo), pero '50'.toFixed no existe -> tiraba
// un TypeError que reventaba render() ENTERO y mandaba a la pantalla de crash. Y un
// recibo con el total como texto (algo que el parser de IA puede devolver, o un import
// manual) llega igual a todos los del equipo por la nube. Ahora se coacciona a número
// primero y se acepta solo un número finito de verdad; cualquier otra cosa cae a $0.00.
// Formato regional (auditoría de presupuesto 2026-09-07): 'plain' = $1000.00 (lo
// de siempre, y lo que esperan los tests), 'us' = $1,000.00, 'latam' = $1.000,00.
// Preferencia del dispositivo (ver setMoneyStyle en app-03), no viaja por la nube.
let moneyStyle = 'plain';
function setMoneyStyle(s){ moneyStyle = (s==='us' || s==='latam') ? s : 'plain'; }
function formatMoney(n, style){
  const v = typeof n==='number' ? n : Number(n);
  const fixed = Number.isFinite(v) ? v.toFixed(2) : '0.00';
  const st = style || moneyStyle;
  if(st==='plain') return '$'+fixed;
  const neg = fixed.startsWith('-');
  const [int, dec] = (neg ? fixed.slice(1) : fixed).split('.');
  const sep = st==='latam' ? '.' : ',';
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return (neg?'-':'')+'$'+grouped+(st==='latam' ? ',' : '.')+dec;
}
function money(n){ return formatMoney(n, moneyStyle); }

/* ===== PRESUPUESTO: lógica pura (auditoría 2026-09-07) =====
   Sin globales: reciben todo por parámetro para poder probarse con Node. */
// Limpia lo que venga guardado o de la nube; cualquier basura cae al valor por defecto.
function normalizeBudgetMeta(m){
  const src = (m && typeof m==='object') ? m : {};
  const monthMap = (o)=>{ const out={}; Object.keys(o||{}).forEach(k=>{ const v=Number(o[k]); if(/^\d{4}-\d{2}$/.test(k) && Number.isFinite(v) && v>0) out[k]=v; }); return out; };
  const byCategory = {};
  Object.keys(src.byCategory||{}).forEach(k=>{ const v=Number(src.byCategory[k]); if(k && Number.isFinite(v) && v>0) byCategory[k]=v; });
  const ap = Number(src.alertPct);
  const ct = Number(src.cogsTargetPct);
  return {
    byMonth: monthMap(src.byMonth),
    alerted: monthMap(src.alerted),
    byCategory,
    rollover: src.rollover===true,
    alertPct: (Number.isFinite(ap) && ap>=10 && ap<100) ? ap : 80,
    cogsTargetPct: (Number.isFinite(ct) && ct>0 && ct<100) ? ct : null
  };
}
// Al cambiar el monto general: los meses ANTERIORES con actividad que no tenían un
// valor propio se quedan con el viejo; el actual toma el nuevo; los futuros se limpian.
function freezeBudgetHistory(byMonth, monthKeys, oldDefault, newValue, currentKey){
  const out = Object.assign({}, byMonth||{});
  if(oldDefault>0 && newValue!==oldDefault){
    (monthKeys||[]).forEach(k=>{ if(k<currentKey && out[k]===undefined) out[k]=oldDefault; });
  }
  if(newValue>0) out[currentKey]=newValue; else delete out[currentKey];
  Object.keys(out).forEach(k=>{ if(k>currentKey) delete out[k]; });
  return out;
}
// Arrastre: lo que sobró el mes pasado (nunca negativo) se suma al de este mes,
// con tope en el propio presupuesto (a lo sumo se duplica).
function carryFromPrevious(prevBudget, prevExpense, cap){
  if(!(prevBudget>0)) return 0;
  const left = prevBudget - (prevExpense||0);
  if(!(left>0)) return 0;
  return Math.min(left, cap>0 ? cap : left);
}
/* Ritmo del mes: porcentaje, restante, dónde "deberías ir hoy" (trayectoria lineal),
   proyección de cierre (desde el día 3), estado (ok / warn / crit). warn = pasó el
   umbral O va a un ritmo que cierra 5% arriba del presupuesto (desde el día 5). */
function computeBudgetPace(o){
  const budget = Number(o.budget), expense = Number(o.expense)||0;
  if(!(budget>0)) return null;
  const daysIn = Number(o.daysInMonth)||30;
  const day = Math.min(daysIn, Math.max(1, Number(o.dayOfMonth)||daysIn));
  const isCurrent = o.isCurrent!==false;
  const pct = expense/budget*100;
  const expectedPct = Math.min(100, (isCurrent ? day : daysIn)/daysIn*100);
  const projected = (isCurrent && day>=3) ? Math.round(expense/day*daysIn) : null;
  const threshold = (o.threshold>=10 && o.threshold<100) ? o.threshold : 80;
  const fast = projected!==null && day>=5 && projected>budget*1.05;
  const status = pct>=100 ? 'crit' : (pct>=threshold || fast) ? 'warn' : 'ok';
  return { budget, expense, pct, left: budget-expense, day, daysIn, expectedPct, projected, threshold, fast, status, isCurrent,
    committed: Number(o.committed)||0, carry: Number(o.carry)||0 };
}

// Escapa texto para meterlo dentro de HTML sin que rompa la etiqueta ni inyecte código.
// Vive acá (y no en index.html) para poder testearla: es la defensa central contra el
// XSS entre miembros de un equipo (un compañero puede escribir nombres de producto,
// notas, o datos que la IA leyó de un recibo, y todo eso se sincroniza y se renderiza en
// la sesión de los demás). Escapar " y ' además de <>& es lo que cierra el vector de
// "romper el atributo" (ej. src="..." onerror=...) — no solo el de inyectar una etiqueta.
function escapeHtml(str){
  if(str===null || str===undefined) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

// ¿Es una fecha con forma YYYY-MM-DD válida (y un día/mes reales, no 2026-13-40)? La
// fecha de un recibo la puede devolver la IA leyendo la foto (o venir de un compañero de
// equipo), así que no se confía a ciegas: una fecha basura no solo se vería en pantalla,
// también rompe monthKey()/el orden por fecha (new Date('basura') -> NaN). Los llamadores
// caen a la fecha de hoy cuando esto da false.
function isValidDateStr(d){
  if(typeof d!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const [y,m,day] = d.split('-').map(Number);
  if(m<1 || m>12 || day<1 || day>31) return false;
  const dt = new Date(y, m-1, day);
  return dt.getFullYear()===y && dt.getMonth()===m-1 && dt.getDate()===day;
}

/* Fecha/mes de "hoy" en hora LOCAL — a diferencia de toISOString() (que da la fecha en UTC),
   esto evita que a alguien en América se le adelante un día al escanear o registrar de noche. */
function localDateStr(d){ d=d||new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function localMonthStr(d){ d=d||new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
function addDaysStr(dateStr, days){
  const d = new Date(dateStr+'T00:00:00');
  d.setDate(d.getDate()+days);
  return localDateStr(d);
}
function daysBetweenStr(fromStr, toStr){
  const a = new Date(fromStr+'T00:00:00'), b = new Date(toStr+'T00:00:00');
  return Math.round((b-a)/86400000);
}

/* Las fotos de un recibo, en el formato nuevo (varias páginas, desde que se migró a
   Claude API) o el viejo (una sola foto, recibos guardados antes de esa migración) —
   siempre devuelve un array, aunque sea de un solo elemento, para no repetir este
   if/else en cada lugar que necesita mostrar/imprimir/compartir la foto de un recibo. */
function receiptImages(r){
  if(Array.isArray(r.images) && r.images.length>0) return r.images;
  if(r.imageBase64) return [{base64:r.imageBase64, mediaType:r.mediaType}];
  return [];
}

/* Una página de recibo puede tener el base64 local (el dispositivo que la escaneó
   la sigue viendo al instante, sin red), la URL de Storage (la subió otro dispositivo
   o llegó sincronizada de un compañero de equipo), o las dos cosas a la vez una vez
   que este mismo dispositivo terminó de subirla. El base64 local siempre gana si
   está — es instantáneo y no depende de la red. */
function receiptImageSrc(img){
  if(!img) return '';
  if(img.base64) return `data:${img.mediaType};base64,${img.base64}`;
  return img.url || '';
}

function monthKey(dateStr){ return dateStr ? dateStr.slice(0,7) : ''; }
const MONTH_NAMES = {
  es: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'],
  // "Sept" y no "Sep": la abreviatura inglesa convencional lleva la t (el único
  // mes de 4 letras) — reporte del usuario 2026-09-05, "le falta una letra".
  en: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sept','Oct','Nov','Dec']
};
// "lang" se pasa explícito (en vez de leer uiLang directo) para que esta función
// se pueda probar sola sin necesitar el resto de la app cargado.
function monthLabel(key, lang){
  const [y,m] = key.split('-');
  return MONTH_NAMES[lang||'en'][parseInt(m,10)-1]+' '+y;
}
const WEEKDAY_NAMES = { es:['D','L','M','M','J','V','S'], en:['S','M','T','W','T','F','S'] };
function shiftMonthStr(key, delta){
  const [y,m] = key.split('-').map(Number);
  const d = new Date(y, (m-1)+delta, 1);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
}

/* Compara el costo por unidad de las últimas dos compras del mismo producto. Si esas
   dos compras no vinieron en la misma unidad (una en lb, la otra en caja, por ejemplo),
   el número no significa nada — devuelve 'unit-mismatch' en vez de un % inventado.
   Las compras guardadas antes de este cambio no tienen "unit" (undefined); comparar
   undefined contra una unidad real también cuenta como "distinta" a propósito, para no
   confiar a ciegas en datos viejos sin esa información.
   "purchases" se recibe como parámetro (en vez de leer la lista global) para que esto
   se pueda probar con datos de prueba, sin depender del estado real de la app.
   Empate de fecha (dos compras el MISMO día — las fechas son solo YYYY-MM-DD):
   gana la que entró DESPUÉS a la lista. Sin este desempate, el sort estable dejaba
   primero la compra más vieja del día y el % de cambio salía con el signo al revés. */
function lastPriceChangePct(ingId, purchases){
  const relevant = purchases
    .map((p,idx)=>({p, idx}))
    .filter(x=>x.p.ingId===ingId && x.p.qty>0)
    .sort((a,b)=>(new Date(b.p.date)-new Date(a.p.date)) || (b.idx-a.idx))
    .map(x=>x.p);
  if(relevant.length<2) return null;
  if(relevant[0].unit!==relevant[1].unit) return 'unit-mismatch';
  const latest = relevant[0].totalPrice/relevant[0].qty;
  const prev = relevant[1].totalPrice/relevant[1].qty;
  if(prev<=0) return null;
  return ((latest-prev)/prev)*100;
}

/* % de ganancia sobre el precio de venta (margen, no markup): cuánto de lo que
   cobrás es ganancia neta. Ej. comprás a $10, vendés a $15 -> 33%, no 50%. */
function profitMarginPct(costPerUnit, salePrice){
  const cost = parseFloat(costPerUnit)||0;
  const sale = parseFloat(salePrice)||0;
  if(sale<=0) return null;
  return ((sale-cost)/sale)*100;
}

/* ---------- Producción (recetas/modelos que descuentan inventario) ---------- */
// Redondeo estándar de cantidades de stock a 2 decimales — evita que restas
// encadenadas de floats (0.1+0.2...) vayan acumulando colas tipo 4.999999999.
function roundQty(n){ return Math.round(n*100)/100; }

/* Costo de producir UNA pieza de una receta: suma de (cantidad × costo actual) de
   cada insumo. "missing" cuenta componentes cuyo producto ya no existe en el
   inventario (se borró después de armar la receta) O cuyo costo no es un número
   usable (dato viejo/sincronizado tipo "1,50") — antes ese costo basura sumaba $0
   en silencio y el costo de la receta quedaba subestimado sin ningún aviso. El
   costo devuelto es parcial en esos casos y el llamador decide cómo avisarlo. */
function recipeCostTotal(components, inventory){
  let total = 0, missing = 0;
  (components||[]).forEach(c=>{
    const ing = inventory.find(i=>i.id===c.ingId);
    const qty = Number(c.qty);
    if(!ing || !Number.isFinite(qty) || qty<0){ missing++; return; }
    const cost = Number(ing.costPerUnit);
    if(!Number.isFinite(cost)){ missing++; return; }
    total += qty * cost;
  });
  return {total: roundQty(total), missing};
}

/* Qué le pasa al stock al producir "count" piezas de una receta: cuánto se
   descuenta de cada insumo, cuánto queda, y cuánto FALTA si el stock registrado
   no alcanza ("short" — el descuento real se frena en 0, nunca queda negativo).
   Puro a propósito: no muta el inventario, devuelve el plan para que el llamador
   lo muestre en la pantalla de confirmación y recién al confirmar lo aplique. */
function productionPlan(components, count, inventory){
  const n = Number(count);
  if(!Number.isFinite(n) || n<=0) return [];
  return (components||[]).map(c=>{
    const ing = inventory.find(i=>i.id===c.ingId);
    const qty = Number(c.qty)||0;
    const deduct = roundQty(qty*n);
    const current = ing ? (Number(ing.qtyOnHand)||0) : 0;
    return {
      ingId: c.ingId,
      name: ing ? ing.name : null,
      unit: ing ? ing.unit : '',
      deduct,
      current: roundQty(current),
      after: roundQty(Math.max(0, current - deduct)),
      short: ing ? roundQty(Math.max(0, deduct - current)) : 0,
      missing: !ing
    };
  });
}

/* LA TABLA DE COMPOSICIÓN de una pieza (Bill of Materials), fila por fila:
   insumo · cantidad requerida · costo unitario aplicado · subtotal. Es la misma
   cuenta que hace recipeCostTotal, pero abierta — la pantalla necesita mostrar de
   dónde sale cada peso, no solo el total.
   `count` multiplica las cantidades (1 = costo de UNA pieza). Un insumo borrado
   del inventario, o con un costo que no es número usable, sale con cost:null y
   subtotal:0 y marcado missing: cuenta parcial y a la vista, nunca un $0 en
   silencio que subestime lo que cuesta producir. */
function bomRows(components, inventory, count){
  const n = Number(count);
  const mult = (Number.isFinite(n) && n > 0) ? n : 1;
  return (components||[]).map(c=>{
    const ing = (inventory||[]).find(i=>i && i.id===c.ingId);
    const perPiece = Number(c.qty);
    const qtyOk = Number.isFinite(perPiece) && perPiece >= 0;
    const cost = ing ? Number(ing.costPerUnit) : NaN;
    const costOk = Number.isFinite(cost) && cost >= 0;
    const missing = !ing || !qtyOk || !costOk;
    const qty = qtyOk ? roundQty(perPiece*mult) : 0;
    return {
      ingId: c.ingId,
      name: ing ? ing.name : null,
      unit: ing ? ing.unit : '',
      qtyPerPiece: qtyOk ? perPiece : 0,
      qty,
      cost: costOk ? cost : null,
      subtotal: missing ? 0 : roundQty(qty*cost),
      missing
    };
  });
}
function bomTotal(rows){
  return roundQty((rows||[]).reduce((s,r)=>s+(r.subtotal||0), 0));
}

/* COSTO PROMEDIO PONDERADO al entrar stock nuevo:
     (lo que ya tenías × su costo  +  lo que entra) / (cantidad total)
   Es el método de costeo de cualquier PYME y el correcto para el producto
   terminado, que se fabrica en tandas a costos distintos: 100 piezas a $4 en
   enero y 50 a $6 en febrero no dejan "un" costo, dejan un promedio.
   (El "último precio" —lo que Dusty hace hoy con la materia prima— no es un
   método de costeo: una compra chica a precio alto revalúa todo el stock.)
   Sin nada que entrar devuelve el costo que ya había: no se inventa ni se pisa.
   Cuatro decimales porque es un costo UNITARIO — redondearlo a centavos pierde
   plata de verdad cuando la pieza vale centavos y el stock son miles. */
function weightedAvgCost(qtyOnHand, costPerUnit, addQty, addTotalCost){
  const q0 = Math.max(0, Number(qtyOnHand)||0);
  const c0 = Math.max(0, Number(costPerUnit)||0);
  const qn = Number(addQty)||0;
  const cn = Number(addTotalCost)||0;
  if(!(qn > 0)) return c0;
  const qty = q0 + qn;
  if(!(qty > 0)) return 0;
  return Math.round(((q0*c0 + cn)/qty)*10000)/10000;
}

/* Convierte lo que el escáner de estante leyó de UN producto en una cantidad
   concreta, según la forma de lectura que aplicó:
   - conteo directo (objetos discretos visibles) → esa cantidad tal cual;
   - nivel/porcentaje del envase → fracción × capacidad del envase lleno
     (capacityFull, declarada una vez por producto o heredada del recibo).
   Devuelve null si no hay forma de convertir (ej. la IA solo pudo estimar un %
   pero el producto no tiene capacidad declarada) — el llamador pide el dato o
   deja la fila para completar a mano, nunca inventa un número. */
function detectedQtyFromReading(reading, capacityFull){
  if(!reading || typeof reading!=='object') return null;
  // Ojo con Number(null)===0: un campo AUSENTE (null/undefined/'') tiene que leerse
  // como "no hay dato", nunca como un 0 real — por eso el guard va antes de coaccionar.
  const present = v => v!==null && v!==undefined && v!=='';
  if(present(reading.count)){
    const count = Number(reading.count);
    if(Number.isFinite(count) && count>=0) return roundQty(count);
  }
  if(present(reading.fill_percent)){
    const pct = Number(reading.fill_percent);
    const cap = Number(capacityFull);
    if(Number.isFinite(pct) && pct>=0 && Number.isFinite(cap) && cap>0){
      return roundQty(cap * Math.min(pct, 100) / 100);
    }
  }
  return null;
}

/* JSON.stringify(x) por sí solo NO sirve para comparar "¿cambió de verdad?": el orden
   de las propiedades importa para stringify aunque el contenido sea idéntico, y
   Firestore no garantiza devolver los campos de un doc en el mismo orden en que se
   escribieron (googlear "firestore field order data()" confirma que reordena). Cada
   vez que llega un snapshot de recibos/inventario/compras al reconectar, esto hacía
   que un objeto con los mismos datos pero propiedades en otro orden se viera como
   "distinto" -> se reemplazaba el array entero y se redibujaba TODO #app de cero
   (fotos incluidas) sin que hubiera cambiado nada real. Eso es lo que se sentía como
   que el calendario de recibos "tiembla" o que un recibo de una fecha puntual
   desaparecía un instante al refrescar: no se perdía el dato, se perdía (por un
   instante, a veces más si se repetía con cada listener) su lugar en un redibujado
   que nunca debió pasar. Ordenar las claves antes de comparar arregla esto para
   objetos y arrays anidados también (fotos de recibos, items aplicados, etc). */
function stableStringify(x){
  if(x===null || typeof x!=='object') return JSON.stringify(x);
  // Mismas reglas que JSON.stringify para undefined — clave para el sync por hash:
  // un doc local con {path: undefined} viaja a Firestore SIN esa clave (el
  // JSON.parse(JSON.stringify()) del upload la elimina), así que hashear el texto
  // "undefined" hacía que local y nube nunca coincidieran → el doc quedaba "sucio"
  // para siempre: se re-subía en cada guardado y rechazaba eternamente las
  // ediciones de los compañeros. Claves con undefined se saltan; en arrays,
  // undefined se vuelve null.
  if(Array.isArray(x)) return '['+x.map(v=>v===undefined ? 'null' : stableStringify(v)).join(',')+']';
  const keys = Object.keys(x).filter(k=>x[k]!==undefined).sort();
  return '{'+keys.map(k=>JSON.stringify(k)+':'+stableStringify(x[k])).join(',')+'}';
}
function sameJSON(a, b){ return stableStringify(a)===stableStringify(b); }

/* Hash de 53 bits (cyrb53) sobre la forma canónica de un valor — la base de la
   detección de cambios del sync por-doc (PLAN-SYNC B): guardar el hash de "lo último
   que la nube tiene" por documento pesa unos bytes por doc en localStorage, contra
   guardar el JSON completo (que con cientos de docs no entra). 53 bits porque es lo
   máximo que cabe exacto en un Number de JS; la probabilidad de que una edición real
   colisione con el hash guardado es ~1 en 9·10^15 — despreciable frente a cualquier
   otra fuente de error. */
function hash53(str){
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for(let i=0; i<str.length; i++){
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1>>>16), 2246822507) ^ Math.imul(h2 ^ (h2>>>13), 3266489909);
  h2 = Math.imul(h2 ^ (h2>>>16), 2246822507) ^ Math.imul(h1 ^ (h1>>>13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1>>>0);
}
function valueHash(x){ return hash53(stableStringify(x)); }

/* UNIÓN DE PÁGINAS de un mismo recibo leídas por SEPARADO (2026-09-08). Una
   factura de 4 páginas y 80 renglones mandada entera en un solo pedido tardaba
   más de lo que Netlify le permite a una función (26 s) y volvía como error
   genérico ("no se pudo conectar con el lector"). Ahora la app lee cada página
   en su propio pedido, en paralelo, y acá se juntan:
   - supplier y date: los primeros no vacíos, en orden de página;
   - items: concatenados en orden, corrigiendo "duplicate_of" (índice relativo a
     la página) al índice global;
   - invoice_total: la IA de cada página devuelve o el subtotal de su página o el
     total general (si está impreso ahí, casi siempre en la última). Se toma el
     mayor de los totales devueltos si alcanza a la suma de todos los renglones
     (≥97%: es el total general, con flete/impuestos si los hay); si no, ninguna
     página vio el total general y se usa la suma de los renglones;
   - truncated: solo cuenta el de la última página (el papel que sigue). */
function mergeReceiptPages(pages){
  const merged = { supplier: null, date: null, invoice_total: null, items: [], truncated: false };
  const totals = [];
  let offset = 0;
  const list = Array.isArray(pages) ? pages : [];
  list.forEach((p, idx)=>{
    if(!p || typeof p!=='object') return;
    if(!merged.supplier && typeof p.supplier==='string' && p.supplier.trim()) merged.supplier = p.supplier;
    if(!merged.date && p.date) merged.date = p.date;
    if(typeof p.invoice_total==='number' && Number.isFinite(p.invoice_total) && p.invoice_total>0) totals.push(p.invoice_total);
    const items = Array.isArray(p.items) ? p.items : [];
    items.forEach(it=>{
      const copy = Object.assign({}, it);
      if(typeof copy.duplicate_of==='number' && Number.isFinite(copy.duplicate_of)) copy.duplicate_of += offset;
      merged.items.push(copy);
    });
    offset += items.length;
    if(idx===list.length-1 && p.truncated===true) merged.truncated = true;
  });
  const itemsSum = merged.items.reduce((s, it)=> s + (Number(it && it.total_price) || 0), 0);
  const maxTotal = totals.length ? Math.max.apply(null, totals) : 0;
  if(maxTotal>0 && maxTotal >= itemsSum*0.97) merged.invoice_total = maxTotal;
  else if(itemsSum>0) merged.invoice_total = Math.round(itemsSum*100)/100;
  else merged.invoice_total = maxTotal>0 ? maxTotal : null;
  return merged;
}

// Solo se ejecuta bajo Node (para los tests) — en el navegador "module" no existe,
// así que esto no hace nada ahí y las funciones quedan como globales normales.
if(typeof module!=='undefined' && module.exports){
  module.exports = {
    money, escapeHtml, isValidDateStr, localDateStr, localMonthStr, addDaysStr, daysBetweenStr,
    receiptImages, receiptImageSrc, monthKey, monthLabel, shiftMonthStr, lastPriceChangePct,
    profitMarginPct, MONTH_NAMES, WEEKDAY_NAMES, sameJSON, hash53, valueHash,
    roundQty, recipeCostTotal, productionPlan, detectedQtyFromReading,
    bomRows, bomTotal, weightedAvgCost,
    formatMoney, setMoneyStyle, normalizeBudgetMeta, freezeBudgetHistory, carryFromPrevious, computeBudgetPace,
    mergeReceiptPages
  };
}
