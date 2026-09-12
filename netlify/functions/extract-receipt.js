// netlify/functions/extract-receipt.js
//
// Esta función corre en el servidor de Netlify, no en el navegador del usuario.
// Por eso la ANTHROPIC_API_KEY puede vivir aquí de forma segura: nunca se manda
// al cliente, solo el resultado ya procesado (el JSON del recibo).
//
// El navegador le manda la foto en base64 (+ opcionalmente los nombres de su
// inventario actual) -> esta función se lo pasa a Claude con visión -> Claude
// devuelve el JSON del recibo, ya con nombres limpios y emparejados contra el
// inventario -> esta función se lo regresa al navegador.
//
// CUPO POR PLAN: cada escaneo cuesta plata real (la llamada a Claude), así que
// antes de gastarla verificamos quién pide el escaneo (el ID token de Firebase
// que manda el navegador, no un uid suelto que cualquiera podría inventar) y
// cuánto lleva usado ese mes la cuenta "dueña" del inventario contra el límite
// de su plan. El contador se guarda en Firestore (users/{uid}/meta/billing) y
// se suma DESPUÉS de que Claude responde, por la cantidad de recibos que
// realmente salieron — no por foto ni por llamada a la API. Así, subir una
// sola foto con 3 recibos (modo "multi") cuenta como 3, no como 1: si contáramos
// por llamada, agrupar varios recibos en una foto sería una forma gratis de
// esquivar el cupo.
// getFirebaseApp/isAllowedOrigin/verifyCaller/el cupo por plan ahora viven en
// lib/patron-admin.js, compartidas con delete-account.js e identify-product.js —
// ver ese archivo para el porqué.
const {
  isAllowedOrigin, verifyCallerInfo,
  currentBillingPeriod, callerCanUseAccount, reserveScanQuota, refundScanUsage, recordScanUsage,
  checkIpRateLimit, getAccessState, subscriptionRequiredResponse,
  upstreamSignal, isAbortError, upstreamTimeoutResponse,
  withCors
} = require('./lib/patron-admin');

/* ---------- LECTURA EN DOS NIVELES (pedido del usuario 2026-09-11) ----------
   Sonnet lee todos los recibos. Opus, que cuesta ~2,5x, entra SOLO cuando hace
   falta: de entrada si el recibo tiene 3+ páginas, y después de leer si el
   resultado se ve flojo (sin total, líneas sin precio, suma que no cierra con el
   total impreso, confianza baja). En ese caso se relee con Opus y se devuelve la
   mejor de las dos lecturas. Cuenta una sola unidad de cupo igual. */
const SCAN_MODEL = process.env.SCAN_MODEL || 'claude-sonnet-5';
const SCAN_MODEL_BIG = process.env.SCAN_MODEL_BIG || 'claude-opus-5';
/* La relectura con el modelo grande es la SEGUNDA llamada de la misma función:
   si la primera ya tardó, la segunda se pasaba del tiempo que Netlify permite y
   la función moría sin contestar — sin refund y tirando la lectura de Sonnet,
   que era usable (auditoría de datos 2026-09-12). Solo se escala si la primera
   volvió antes de este umbral; si no, se devuelve la lectura rápida con sus
   dudas (reading.doubts) y el cliente sigue con lo que hay. Y la propia llamada
   a Claude lleva señal de aborto con lo que queda del presupuesto (patron-admin). */
const SCAN_ESCALATE_AFTER_MS = Math.max(1000, parseInt(process.env.DUSTY_SCAN_ESCALATE_AFTER_MS || '9000', 10) || 9000);
function canEscalate(elapsedMs) { return Number.isFinite(elapsedMs) && elapsedMs < SCAN_ESCALATE_AFTER_MS; }
function num(v){ return (typeof v === 'number' && isFinite(v)) ? v : null; }
// Motivos por los que UNA lectura de recibo merece releerse con el modelo grande.
function weakReasonsOne(r) {
  const reasons = [];
  if (!r || typeof r !== 'object') return ['no_json'];
  const items = Array.isArray(r.items) ? r.items : [];
  if (items.length === 0) return ['no_items'];
  const total = num(r.invoice_total);
  if (total === null) reasons.push('no_total');
  const noPrice = items.filter(it => !(num(it && it.total_price) > 0)).length;
  if (noPrice / items.length > 0.34) reasons.push('missing_prices');
  const low = items.filter(it => it && it.confidence === 'baja').length;
  if (low / items.length >= 0.3) reasons.push('low_confidence');
  if (total !== null && total > 0 && items.length >= 2 && noPrice === 0) {
    const sum = items.reduce((a, it) => a + (num(it.total_price) || 0), 0);
    if (Math.abs(sum - total) / total > 0.15) reasons.push('sum_mismatch');
  }
  if (!r.supplier || !String(r.supplier).trim()) reasons.push('no_supplier');
  // Sin proveedor solo, no alcanza para pagar una relectura.
  return reasons.filter(x => x !== 'no_supplier' || reasons.length > 1);
}
function weakReasons(receiptData, multi) {
  if (!multi) return weakReasonsOne(receiptData);
  let list = Array.isArray(receiptData && receiptData.receipts) ? receiptData.receipts
    : Array.isArray(receiptData) ? receiptData
    : (receiptData && Array.isArray(receiptData.items)) ? [receiptData] : [];
  if (list.length === 0) return ['no_receipts'];
  const out = new Set();
  list.forEach(r => weakReasonsOne(r).forEach(x => out.add(x)));
  return [...out];
}

function buildPrompt(inventoryNames, caseTrackedNames, categoryNames, expenseCategoryNames, multi) {
  const hasInventory = Array.isArray(inventoryNames) && inventoryNames.length > 0;
  const hasCaseTracked = Array.isArray(caseTrackedNames) && caseTrackedNames.length > 0;
  const hasCategories = Array.isArray(categoryNames) && categoryNames.length > 0;
  const hasExpCategories = Array.isArray(expenseCategoryNames) && expenseCategoryNames.length > 0;

  return `Eres un sistema experto en extraer datos de compras y gastos de un negocio: facturas impresas de mayorista (Sysco, US Foods, Cintas, proveedores locales de produce, etc), capturas de pantalla de una compra online (Amazon, Walmart, cualquier sitio), o recibos/facturas de servicios (luz, agua, gas, internet, renta, etc) — la imagen puede ser cualquiera de estas tres cosas.

Analiza la(s) imagen(es) de esta factura, captura de compra online, o recibo de servicio, y extrae la información en JSON puro (sin markdown, sin backticks, sin texto extra antes o después).

SI ES UNA CAPTURA DE COMPRA ONLINE (no una factura impresa) — se nota porque es un pantallazo de un sitio o app, con un resumen de "pedido"/"order" en vez de líneas de factura escaneadas:
- "supplier" es el nombre del sitio/tienda (ej. "Amazon"), no el vendedor externo si aparece uno chico debajo del producto.
- "invoice_total" es el total final del pedido ("Order total", "Total"), no el subtotal antes de envío/impuestos.
- Ignora las líneas de "Subtotal", "Shipping"/envío, "Tax"/impuesto, descuentos y promociones aplicadas — no son productos.
- Estos NO son cajas de mayorista: la cantidad que se ve junto a cada producto ("Qty: 2") YA es la cantidad real, nunca la desarmes ni la multipliques por ningún tamaño de paquete — esa lógica de cajas es solo para facturas de mayorista, no aplica acá. "unit" para estos productos va a ser casi siempre "unidad", salvo que el producto en sí se venda por peso o volumen (ej. una bolsa de 5 lb de algo).
- Si el pedido tiene varios productos distintos, cada uno es un item separado, igual que las líneas de una factura normal.

SI ES UN RECIBO O FACTURA DE UN SERVICIO (no una factura de productos) — es una boleta de luz/electricidad, agua, gas, internet, teléfono/celular, cable, renta/alquiler, seguro, u otro servicio recurrente similar, sin una lista de productos comprados:
- Tratá TODO el recibo como un solo item en "items", aunque el documento tenga varias líneas de cargos, cuotas, desglose de consumo o impuestos — no las separes en items distintos, sumalas todas en un solo total.
- "supplier" es el nombre de la empresa que presta el servicio (ej. "CFE", "AT&T", "Con Edison"), y "invoice_total" es el monto total a pagar de la factura.
- Para ese item único: "raw_name" copia el nombre del servicio o tipo de cuenta tal como aparece impreso (ej. "Electric Service", "Agua Potable"); "clean_name" es el tipo de servicio en inglés y en su forma más simple (ej. "Electricity", "Water", "Gas", "Internet", "Phone", "Cable", "Rent", "Insurance"); "quantity" es siempre 1 y "unit" es siempre "servicio" (nunca apliques acá la lógica de cajas/paquetes de la sección de mayoristas más abajo); "total_price" es el mismo monto que "invoice_total".

${multi ? `MUY IMPORTANTE — ESTA IMAGEN PUEDE CONTENER VARIOS RECIBOS DISTINTOS:
La foto puede mostrar UNO o VARIOS recibos separados, puestos uno al lado del otro (por ejemplo varios tickets chicos apoyados sobre una mesa). Tu tarea es identificar cuántos recibos DISTINTOS hay y devolver uno por cada uno, cada uno con su propio proveedor, fecha, total y lista de productos.

Cómo distinguir recibos separados: son hojas o tickets físicamente distintos, normalmente con su propio encabezado (nombre del negocio), su propia fecha y su propio total. NO separes en varios recibos lo que en realidad es un solo recibo largo, ni lo que son dos páginas del mismo documento (mismo negocio, misma fecha, la numeración de productos continúa). Si dudás si son uno o dos, devolvelo como UNO SOLO — es mucho peor partir un recibo en dos que dejar dos juntos.

Si un recibo de la foto quedó cortado, muy borroso o ilegible, NO lo inventes: omitilo de la respuesta.` : `Si recibes más de una imagen, son páginas consecutivas de UNA SOLA factura (por ejemplo página 1 y página 2 del mismo recibo, en ese orden). Combina los productos de todas las páginas en una sola lista "items", sin duplicar información — el encabezado (proveedor, fecha) suele repetirse en cada página, úsalo solo una vez.`}

REGLAS IMPORTANTES:
- Si un precio está tachado y hay uno escrito a mano al lado, usa el escrito a mano (es la corrección final), no el original tachado.
- Ignora líneas de "GROUP TOTAL", subtotales de sección, encabezados de categoría (FROZEN, PRODUCE, DRY, etc), cargos de flete/fuel surcharge, e impuestos — esas NO son productos individuales.
- "total_price" es el precio EXTENDIDO de esa línea (cantidad x precio unitario), no el precio unitario solo.
- Si no puedes leer un campo con confianza razonable, usa tu mejor estimación pero marca "confidence" como "baja".
- Los números son siempre números (usa punto decimal), nunca strings.
- La fecha va en formato YYYY-MM-DD. Si no la puedes determinar, usa null.

SOBRE "raw_name" Y "clean_name":
- "raw_name": copia exacta de la descripción tal como aparece impresa en el recibo (con abreviaturas, códigos de proveedor, mayúsculas, etc — sin traducir ni limpiar nada).
- "clean_name": tu mejor interpretación de qué producto es en realidad, escrito como un nombre de producto claro y natural, SIEMPRE EN INGLÉS aunque el recibo esté en español o mezclado (esto es una regla fija del negocio: los nombres de producto en el sistema siempre quedan en inglés). Interpretá abreviaturas y códigos de proveedor con tu conocimiento general — por ejemplo "SYS CLS CHICKEN TNDR FRTR ORIG FL" es "Chicken Tenders", "PAN ROUND ALUMINUM 9\" 500 CT" es "Aluminum Pan (9 in)", "MILK WHOLE 4/1 GL" es "Whole Milk". No copies códigos de artículo ni números de catálogo en el nombre limpio.

SOBRE "quantity" Y "unit" (tamaño de paquete):
- Muchas facturas de mayorista venden por CAJA/CASE, pero cada caja contiene varias unidades más chicas (ej: "6/10 LB" = 6 piezas de 10 lb cada una; "40 LB DRY" = una caja de 40 lb en total; "4/1 GL" = 4 galones de 1 galón cada uno).
- "quantity" tiene que ser la cantidad TOTAL real en la unidad base más útil para costear (libras, galones, unidades individuales, etc — NO la cantidad de cajas), calculada multiplicando cantidad de cajas × tamaño de cada caja cuando el tamaño de empaque esté indicado en la descripción.
- "unit" es esa unidad base en inglés, corta y simple: "lb", "oz", "gal", "unidad" (usá "unidad" para conteo de piezas sueltas sin peso, ej. servilletas, tortillas, bolsas).
- Si no puedes determinar el tamaño de paquete con confianza, usá la cantidad de cajas/cases tal cual viene impresa, unidad "unidad", y marcá "confidence" como "media" o "baja" para esa línea (mejor esto que inventar un tamaño de paquete).
${hasCaseTracked ? `- EXCEPCIÓN: estos productos el usuario eligió llevarlos por caja, no por unidad suelta — para estos NO desarmes el tamaño de paquete, "quantity" tiene que ser la cantidad de cajas tal cual viene impresa en la factura y "unit" tiene que ser "caja":
${caseTrackedNames.map(n => `  - ${n}`).join('\n')}
  (esto aplica solo cuando "matched_inventory_name" sea exactamente uno de estos nombres — para cualquier otro producto, seguí la regla normal de arriba)` : ''}

${hasInventory ? `SOBRE "matched_inventory_name" (emparejar con el inventario existente):
Esta es la lista de ingredientes que el usuario ya tiene cargados en su inventario:
${inventoryNames.map(n => `- ${n}`).join('\n')}

Para cada producto de la factura, fijate si corresponde a alguno de esos ingredientes ya existentes (aunque la descripción de la factura esté abreviada o en otro idioma — usá tu criterio, no comparación literal de texto). Si corresponde, poné en "matched_inventory_name" el nombre EXACTO tal cual aparece en esa lista (copiado letra por letra). Si es un producto distinto que no está en la lista, poné "matched_inventory_name": null.` : `No hay inventario cargado todavía, así que "matched_inventory_name" va a ser null para todos los productos.`}

SOBRE "category" (a qué categoría pertenece cada item):
- Para PRODUCTOS (mercadería, insumos, empaques — todo lo que NO sea servicio ni eat_out): ${hasCategories ? `esta es la lista de categorías de inventario que el usuario ya tiene creadas:
${categoryNames.map(n => `- ${n}`).join('\n')}
Si alguna le queda bien al producto (usá tu criterio, no comparación literal — ej. "leche" va en una categoría de comida aunque se llame "Food" o "Alimentos"), poné en "category" el nombre EXACTO tal cual aparece en esa lista (copiado letra por letra).` : `el usuario todavía no tiene categorías de inventario creadas.`} Si ninguna categoría de la lista le queda bien (o no hay lista), NO pongas null: PROPONÉ vos una categoría nueva — un nombre corto y genérico de 1-2 palabras (ej. "Carnes", "Lácteos", "Verduras", "Limpieza", "Empaques", "Bebidas"), pensando en el cajón donde iría el producto, nunca una categoría hiper-específica de un solo producto. Escribila en el mismo idioma que las categorías existentes del usuario, o en el idioma del recibo si no tiene ninguna. Usá "category": null solo si de verdad no se puede clasificar. Si varios productos de la factura comparten la misma categoría nueva propuesta, escribe el nombre idéntico en todos (así se crea una sola).
- Para SERVICIOS (el item único con unit "servicio"): la categoría NO sale de la lista de inventario, sale de esta OTRA lista, la de categorías de GASTO del usuario: ${hasExpCategories ? `
${expenseCategoryNames.map(n => `- ${n}`).join('\n')}
Mismo criterio: si alguna calza, copiá el nombre EXACTO de esa lista;` : `(todavía no tiene ninguna creada), así que`} si ninguna calza, proponé una nueva corta y genérica (ej. "Servicios", "Renta", "Seguros").
- Para consumos eat_out el valor de "category" se ignora — puedes dejarlo en null.

SOBRE "duplicate_of" (líneas repetidas del mismo producto NUEVO dentro de esta misma factura):
A veces una factura describe el mismo producto en más de una línea (ej. una línea por caja y otra por el reempaque en unidades sueltas, o una columna que se leyó dos veces). Si detectás que dos o más líneas de ESTA factura son en realidad el mismo producto — y ese producto NO tiene "matched_inventory_name" (es nuevo, no está en el inventario existente) — dejá "duplicate_of": null en la PRIMERA aparición, y en las siguientes apariciones poné "duplicate_of" con el índice (empezando en 0) de esa primera línea dentro de este mismo array "items". Si un producto ya tiene "matched_inventory_name" (ya existe en el inventario), nunca uses "duplicate_of" para él — dejalo en null, aunque aparezca más de una vez. Si no estás seguro de que sean el mismo producto, dejá "duplicate_of": null (mejor dos líneas separadas que combinar mal dos productos distintos).

SOBRE "eat_out" (consumos que NO son mercadería):
Si una línea es comida o bebida preparada para consumir en el momento (un café, un almuerzo, un refresco que se tomó ahí, un snack del food court, propina de restaurante) dentro de una factura que por lo demás es de mercadería/insumos, marcá esa línea con "eat_out": true — es un gasto real del negocio pero NO debe entrar al inventario. Para todo lo demás (mercadería, insumos, empaques, materiales, servicios) usá "eat_out": false. Si la factura ENTERA es de un restaurante o cafetería (todo es consumo del momento), marcá todas sus líneas con "eat_out": true.

Devuelve exactamente este formato:

${multi ? `{
  "receipts": [
    {
      "supplier": "string",
      "date": "YYYY-MM-DD o null",
      "invoice_total": number o null,
      "items": [ ...mismo formato de item que se describe abajo... ]
    }
  ]
}

("receipts" siempre es un array, incluso si en la foto hay un solo recibo. El campo
"duplicate_of" de un item se refiere al índice dentro del array "items" DE SU PROPIO
recibo, nunca a items de otro recibo de la misma foto.)

Formato de cada item:
{
  "raw_name": "string",
  "clean_name": "string (en inglés)",
  "matched_inventory_name": "string exacto de la lista, o null",
  "category": "string (de la lista que corresponda, o una categoría nueva propuesta), o null",
  "quantity": number,
  "unit": "string (lb, oz, gal, unidad, caja, etc)",
  "total_price": number,
  "confidence": "alta" | "media" | "baja",
  "eat_out": true o false,
  "duplicate_of": number o null
}` : `{
  "supplier": "string",
  "date": "YYYY-MM-DD o null",
  "invoice_total": number o null,
  "items": [
    {
      "raw_name": "string",
      "clean_name": "string (en inglés)",
      "matched_inventory_name": "string exacto de la lista, o null",
      "category": "string (de la lista que corresponda, o una categoría nueva propuesta), o null",
      "quantity": number,
      "unit": "string (lb, oz, gal, unidad, caja, etc)",
      "total_price": number,
      "confidence": "alta" | "media" | "baja",
      "eat_out": true o false,
      "duplicate_of": number o null
    }
  ],
  "truncated": true o false
}

SOBRE "truncated": true si el recibo parece CORTADO en la foto — el total final no se ve completo, la última línea queda al borde, o el papel sigue fuera del cuadro. false si se ve entero. (Auditoría 2026-09-07: la app ofrece agregar otra página cuando es true.)`}`;
}

exports.weakReasons = weakReasons;
exports.canEscalate = canEscalate;
exports.handler = withCors(async (event) => {
  const startedAt = Date.now();
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  if (!isAllowedOrigin(event)) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Origen no permitido' }) };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Falta configurar ANTHROPIC_API_KEY en Netlify' }) };
  }

  // El navegador ya exige haber iniciado sesión antes de llegar a esta función
  // (ver openScanModal() en index.html), pero eso solo vive del lado del cliente.
  // Acá verificamos el ID token de Firebase que mandó -> es la única forma real
  // de saber quién es, porque un uid suelto en el body cualquiera lo podría
  // escribir a mano.
  const caller = await verifyCallerInfo(event);
  if (!caller) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Iniciá sesión para escanear recibos', code: 'auth_required' }) };
  }
  const callerUid = caller.uid;

  // Acepta tanto el formato nuevo ("images": [{base64, mediaType}, ...], una o
  // varias páginas) como el formato viejo de una sola imagen, por compatibilidad.
  // "inventoryNames" es opcional: nombres de los ingredientes que el usuario ya
  // tiene cargados, para que Claude pueda emparejar los productos de la factura
  // contra el inventario real en vez de que el cliente compare texto literal.
  // "multi" (opcional): si viene en true, la foto puede contener VARIOS recibos
  // distintos y la respuesta trae un array "receipts" en vez de un solo recibo. Sin
  // ese campo se comporta exactamente como siempre, así que las versiones viejas de
  // la app (o un cliente que no lo mande) siguen funcionando igual.
  // "ownerUid": la cuenta dueña del inventario contra la que se cuenta el cupo —
  // la propia si el que escanea es el dueño, o la del equipo si se unió a uno
  // (ver syncUid() en index.html).
  let images, inventoryNames, caseTrackedNames, categoryNames, expenseCategoryNames, multi = false, ownerUid;
  try {
    const parsed = JSON.parse(event.body || '{}');
    if (Array.isArray(parsed.images) && parsed.images.length > 0) {
      images = parsed.images;
    } else if (parsed.imageBase64) {
      images = [{ base64: parsed.imageBase64, mediaType: parsed.mediaType || 'image/jpeg' }];
    }
    // slice(0,120) por string: la lista ya venía capada en cantidad, pero un nombre
    // individual sin tope inflaba los tokens de entrada del prompt gratis.
    if (Array.isArray(parsed.inventoryNames)) {
      inventoryNames = parsed.inventoryNames.filter(n => typeof n === 'string' && n.trim()).slice(0, 300).map(n => n.slice(0, 120));
    }
    if (Array.isArray(parsed.caseTrackedNames)) {
      caseTrackedNames = parsed.caseTrackedNames.filter(n => typeof n === 'string' && n.trim()).slice(0, 300).map(n => n.slice(0, 120));
    }
    if (Array.isArray(parsed.categoryNames)) {
      categoryNames = parsed.categoryNames.filter(n => typeof n === 'string' && n.trim()).slice(0, 50).map(n => n.slice(0, 120));
    }
    // Categorías de GASTO (universo aparte del inventario): para que la IA les
    // asigne categoría a las boletas de servicio — clientes viejos que no las
    // mandan siguen funcionando igual (la IA propone nombres nuevos).
    if (Array.isArray(parsed.expenseCategoryNames)) {
      expenseCategoryNames = parsed.expenseCategoryNames.filter(n => typeof n === 'string' && n.trim()).slice(0, 50).map(n => n.slice(0, 120));
    }
    multi = parsed.multi === true;
    ownerUid = typeof parsed.ownerUid === 'string' && parsed.ownerUid ? parsed.ownerUid : callerUid;
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Body inválido', code: 'bad_request' }) };
  }

  if (!images || images.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Falta la imagen', code: 'bad_request' }) };
  }

  if (images.length > 5) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Máximo 5 páginas por recibo', code: 'too_many_pages' }) };
  }
  // Mismo guard de tamaño por imagen que identify-product: cortar acá un payload
  // absurdo antes de viajar megas hasta la API de Claude.
  if (images.some(img => !img || typeof img.base64 !== 'string' || img.base64.length > 7000000)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Una de las imágenes es demasiado grande — vuelve a intentar desde la app', code: 'image_too_big' }) };
  }
  let reservation;
  // Resumen del cupo que viaja con el resultado (extra = recibos de más contados
  // en modo mesa). Solo números; si la reserva no trajo datos, null.
  const scanQuotaInfo = (res, extra) => (res && Number.isFinite(res.limit) && Number.isFinite(res.used))
    ? { limit: res.limit, used: res.used + (extra || 0) }
    : null;
  try {
    const hasAccess = await callerCanUseAccount(callerUid, ownerUid);
    if (!hasAccess) {
      return { statusCode: 403, body: JSON.stringify({ error: 'No tienes acceso a esa cuenta', code: 'no_access' }) };
    }
    // Primer mes vencido y sin suscripción: 402 antes de gastar cupo ni Claude
    // (ver getAccessState — apagado hasta DUSTY_BILLING_ENABLED=1).
    if ((await getAccessState(ownerUid, caller)).locked) return subscriptionRequiredResponse();
    if (!(await checkIpRateLimit(event))) {
      return { statusCode: 429, body: JSON.stringify({ error: 'Demasiados escaneos seguidos desde esta conexión — espera un rato y prueba de nuevo', code: 'rate_limited' }) };
    }
    // Reserva el cupo ANTES de llamar a Claude (chequeo+descuento atómicos) — ver
    // reserveScanQuota en lib/patron-admin.js para el porqué.
    reservation = await reserveScanQuota(ownerUid, caller);
    if (!reservation.allowed) {
      // Un MIEMBRO del equipo no puede hacer nada con este error: el cupo es del
      // dueño de la cuenta, no suyo. Decirle "tu plan" lo manda a buscar un ajuste
      // que no existe en su pantalla (reporte del usuario 2026-09-09).
      const esMiembro = callerUid !== ownerUid;
      return { statusCode: 429, body: JSON.stringify({
        error: esMiembro
          ? 'La cuenta llegó a su límite de escaneos del mes. Avisa al dueño de la cuenta para que amplíe el plan.'
          : 'Llegaste al límite de escaneos de tu plan este mes',
        quotaExceeded: true }) };
    }
  } catch (e) {
    console.error('[Dusty] error verificando cupo de escaneo:', e);
    return { statusCode: 500, body: JSON.stringify({ error: 'No se pudo verificar tu cupo de escaneos, intenta de nuevo', code: 'quota_check_failed' }) };
  }

  const imageContentBlocks = images.map(img => ({
    type: 'image',
    source: { type: 'base64', media_type: img.mediaType || 'image/jpeg', data: img.base64 }
  }));

  /* Una lectura con el modelo pedido. Devuelve {ok:true, receiptData, data} o
     {ok:false, status, body, refund} con la respuesta de error ya armada. */
  const readOnce = async (model) => {
    const deep = model === SCAN_MODEL_BIG;
    let response, data;
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      // Se aborta con lo que queda del presupuesto de la función: mejor un
      // upstream_timeout claro (con refund) que el corte mudo del gateway.
      signal: upstreamSignal(startedAt),
      body: JSON.stringify(Object.assign({
        model,
        // Con varios recibos en una misma foto la respuesta puede ser bastante más larga
        // (cada recibo trae su propio encabezado y su propia lista), así que necesita más
        // margen. El modelo grande además razona antes de responder y eso consume del
        // mismo límite: se le da el doble.
        max_tokens: deep ? (multi ? 16000 : 12000) : (multi ? 10000 : 6000),
        // Sonnet: este modelo piensa "puertas adentro" antes de responder por defecto, y
        // ese pensamiento le resta del mismo límite de tokens que la respuesta final. Con
        // un recibo largo (30+ productos) el pensamiento solo podía agotar el límite —
        // confirmado con un recibo real. Se desactiva: es lectura + extracción directa.
        // Opus: pensar es justamente lo que se le pide (recibo difícil), con esfuerzo
        // medio para que tarde segundos y no medio minuto; apagarlo en este modelo
        // además puede filtrar etiquetas de razonamiento en la respuesta.
        thinking: deep ? { type: 'adaptive' } : { type: 'disabled' },
        messages: [
          {
            role: 'user',
            content: [
              ...imageContentBlocks,
              { type: 'text', text: buildPrompt(inventoryNames, caseTrackedNames, categoryNames, expenseCategoryNames, multi) }
            ]
          }
        ]
      }, deep ? { output_config: { effort: 'medium' } } : {}))
      });
      data = await response.json();
    } catch (e) {
      if (!isAbortError(e)) throw e;
      // Se abortó por tiempo: Anthropic no cobra una llamada que no terminó.
      const r = upstreamTimeoutResponse();
      return { ok: false, refund: true, status: r.statusCode, body: r.body };
    }
    if (data.error) {
      // Error a nivel de API (sobrecarga, rate limit, pedido rechazado): Anthropic
      // NO cobra estas llamadas, así que la unidad reservada se devuelve — sin
      // esto, durante un outage de la API cada reintento del usuario quemaba cupo.
      // Los 502 de más abajo (Claude SÍ contestó, pero mal) no refundan: esos
      // tokens sí se facturaron.
      return { ok: false, refund: true, status: 502, body: JSON.stringify({ error: data.error.message || 'Error del lector de recibos', code: 'upstream_error' }) };
    }
    const textBlock = (data.content || []).find(b => b.type === 'text');
    if (!textBlock || !textBlock.text) {
      // Si esto vuelve a pasar, "stop_reason" dice por qué: "max_tokens" significa
      // que el recibo es tan largo que ni con el límite subido alcanzó.
      return { ok: false, status: 502, body: JSON.stringify({ error: 'El lector de recibos no devolvió texto', stopReason: data.stop_reason || null }) };
    }
    let receiptData;
    try {
      const clean = textBlock.text.replace(/```json|```/g, '').trim();
      receiptData = JSON.parse(clean);
    } catch (e) {
      // A veces el modelo agrega alguna palabra suelta antes o después del JSON: se
      // recorta todo lo que esté antes del primer "{" y después del último "}".
      try {
        const st = textBlock.text.indexOf('{');
        const en = textBlock.text.lastIndexOf('}');
        if (st === -1 || en === -1 || en <= st) throw e;
        receiptData = JSON.parse(textBlock.text.slice(st, en + 1));
      } catch (e2) {
        return { ok: false, status: 502, body: JSON.stringify({ error: 'No se pudo interpretar la respuesta del lector de recibos', stopReason: data.stop_reason || null, debugPreview: textBlock.text.slice(0, 300) }) };
      }
    }
    return { ok: true, receiptData, data };
  };

  try {
    // 3+ páginas: directo al modelo grande. Si no, Sonnet primero y Opus solo si
    // la lectura salió floja (ver weakReasons). Cuenta UNA unidad de cupo igual.
    let deep = images.length >= 3;
    let first = await readOnce(deep ? SCAN_MODEL_BIG : SCAN_MODEL);
    if (!first.ok) {
      if (first.refund) await refundScanUsage(ownerUid, 1, reservation.period);
      return { statusCode: first.status, body: first.body };
    }
    let receiptData = first.receiptData;
    let reasons = deep ? [] : weakReasons(receiptData, multi);
    let escalated = false;
    if (reasons.length && !canEscalate(Date.now() - startedAt)) {
      console.log('[Dusty] recibo flojo con ' + SCAN_MODEL + ' (' + reasons.join(',') + ') pero sin tiempo para releer: se devuelve la lectura rápida');
    } else if (reasons.length) {
      console.log('[Dusty] recibo flojo con ' + SCAN_MODEL + ' (' + reasons.join(',') + '): releyendo con ' + SCAN_MODEL_BIG);
      try {
        const second = await readOnce(SCAN_MODEL_BIG);
        if (second.ok) {
          const r2 = weakReasons(second.receiptData, multi);
          // Se queda la lectura con menos motivos de duda; en empate, la del modelo grande.
          if (r2.length <= reasons.length) { receiptData = second.receiptData; reasons = r2; deep = true; escalated = true; }
        }
      } catch (e) {
        console.error('[Dusty] relectura con el modelo grande falló, se devuelve la primera:', e);
      }
    }
    const readerInfo = { reader: deep ? 'deep' : 'fast', escalated, doubts: reasons };
    /* En modo "varios recibos" se normaliza la respuesta antes de devolverla, para que el
       cliente reciba siempre un array "receipts" y no tenga que adivinar la forma. El
       modelo puede contestar de tres maneras razonables aunque se le pidió una sola:
       el array pedido, un recibo suelto (cuando en la foto había uno), o un array pelado.
       Las tres se aceptan acá en vez de fallar por una diferencia de forma. */
    if (multi) {
      let list;
      if (Array.isArray(receiptData && receiptData.receipts)) list = receiptData.receipts;
      else if (Array.isArray(receiptData)) list = receiptData;
      else if (receiptData && Array.isArray(receiptData.items)) list = [receiptData];
      else list = [];
      list = list.filter(r => r && Array.isArray(r.items) && r.items.length > 0);
      if (list.length === 0) {
        return { statusCode: 502, body: JSON.stringify({
          error: 'El lector de recibos no encontró ningún recibo legible en esta foto',
          stopReason: null
        }) };
      }
      // La llamada ya reservó 1 al entrar; se cuenta 1 por cada recibo que realmente
      // salió de la foto (si no, subir varios recibos juntos sería gratis), así que
      // acá se suma solo lo que excede la reserva.
      if (list.length > 1) await recordScanUsage(ownerUid, list.length - 1, reservation.period);
      return { statusCode: 200, body: JSON.stringify({ receipts: list, quota: scanQuotaInfo(reservation, list.length - 1), reading: readerInfo }) };
    }

    // quota: {limit, used} para que la app le diga al trial cuántos escaneos
    // gratis le quedan (festejo del primer escaneo) en vez de dejarlo chocar el tope.
    return { statusCode: 200, body: JSON.stringify(Object.assign({}, receiptData, { quota: scanQuotaInfo(reservation, 0), reading: readerInfo })) };
  } catch (err) {
    // Si el fetch a Claude reventó por red, lo más probable es que no se haya
    // cobrado nada — se devuelve la unidad reservada. Los 502 de más arriba
    // (Claude contestó pero mal) NO refundan: esa llamada costó plata real.
    await refundScanUsage(ownerUid, 1, reservation.period);
    // Genérico a propósito: err.message crudo filtraba detalles internos al cliente.
    return { statusCode: 500, body: JSON.stringify({ error: 'Error interno', code: 'internal' }) };
  }
});
