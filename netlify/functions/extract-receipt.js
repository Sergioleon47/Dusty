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
  checkIpRateLimit
} = require('./lib/patron-admin');

function buildPrompt(inventoryNames, caseTrackedNames, categoryNames, multi) {
  const hasInventory = Array.isArray(inventoryNames) && inventoryNames.length > 0;
  const hasCaseTracked = Array.isArray(caseTrackedNames) && caseTrackedNames.length > 0;
  const hasCategories = Array.isArray(categoryNames) && categoryNames.length > 0;

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
- Si no podés determinar el tamaño de paquete con confianza, usá la cantidad de cajas/cases tal cual viene impresa, unidad "unidad", y marcá "confidence" como "media" o "baja" para esa línea (mejor esto que inventar un tamaño de paquete).
${hasCaseTracked ? `- EXCEPCIÓN: estos productos el usuario eligió llevarlos por caja, no por unidad suelta — para estos NO desarmes el tamaño de paquete, "quantity" tiene que ser la cantidad de cajas tal cual viene impresa en la factura y "unit" tiene que ser "caja":
${caseTrackedNames.map(n => `  - ${n}`).join('\n')}
  (esto aplica solo cuando "matched_inventory_name" sea exactamente uno de estos nombres — para cualquier otro producto, seguí la regla normal de arriba)` : ''}

${hasInventory ? `SOBRE "matched_inventory_name" (emparejar con el inventario existente):
Esta es la lista de ingredientes que el usuario ya tiene cargados en su inventario:
${inventoryNames.map(n => `- ${n}`).join('\n')}

Para cada producto de la factura, fijate si corresponde a alguno de esos ingredientes ya existentes (aunque la descripción de la factura esté abreviada o en otro idioma — usá tu criterio, no comparación literal de texto). Si corresponde, poné en "matched_inventory_name" el nombre EXACTO tal cual aparece en esa lista (copiado letra por letra). Si es un producto distinto que no está en la lista, poné "matched_inventory_name": null.` : `No hay inventario cargado todavía, así que "matched_inventory_name" va a ser null para todos los productos.`}

${hasCategories ? `SOBRE "category" (a qué categoría de inventario pertenece el producto):
Esta es la lista de categorías que el usuario ya tiene creadas en su inventario:
${categoryNames.map(n => `- ${n}`).join('\n')}

Para cada producto de la factura, elegí la categoría de esa lista que mejor le quede (usá tu criterio, no comparación literal — ej. "leche" va en una categoría de comida aunque se llame "Food" o "Alimentos"). Si corresponde, poné en "category" el nombre EXACTO tal cual aparece en esa lista (copiado letra por letra). Si ninguna categoría le queda bien, poné "category": null — mejor sin categoría que una que no corresponde.` : `El usuario no tiene categorías de inventario creadas todavía, así que "category" va a ser null para todos los productos.`}

SOBRE "duplicate_of" (líneas repetidas del mismo producto NUEVO dentro de esta misma factura):
A veces una factura describe el mismo producto en más de una línea (ej. una línea por caja y otra por el reempaque en unidades sueltas, o una columna que se leyó dos veces). Si detectás que dos o más líneas de ESTA factura son en realidad el mismo producto — y ese producto NO tiene "matched_inventory_name" (es nuevo, no está en el inventario existente) — dejá "duplicate_of": null en la PRIMERA aparición, y en las siguientes apariciones poné "duplicate_of" con el índice (empezando en 0) de esa primera línea dentro de este mismo array "items". Si un producto ya tiene "matched_inventory_name" (ya existe en el inventario), nunca uses "duplicate_of" para él — dejalo en null, aunque aparezca más de una vez. Si no estás seguro de que sean el mismo producto, dejá "duplicate_of": null (mejor dos líneas separadas que combinar mal dos productos distintos).

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
  "category": "string exacto de la lista de categorías, o null",
  "quantity": number,
  "unit": "string (lb, oz, gal, unidad, caja, etc)",
  "total_price": number,
  "confidence": "alta" | "media" | "baja",
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
      "category": "string exacto de la lista de categorías, o null",
      "quantity": number,
      "unit": "string (lb, oz, gal, unidad, caja, etc)",
      "total_price": number,
      "confidence": "alta" | "media" | "baja",
      "duplicate_of": number o null
    }
  ]
}`}`;
}

exports.handler = async (event) => {
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
    return { statusCode: 401, body: JSON.stringify({ error: 'Iniciá sesión para escanear recibos' }) };
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
  let images, inventoryNames, caseTrackedNames, categoryNames, multi = false, ownerUid;
  try {
    const parsed = JSON.parse(event.body || '{}');
    if (Array.isArray(parsed.images) && parsed.images.length > 0) {
      images = parsed.images;
    } else if (parsed.imageBase64) {
      images = [{ base64: parsed.imageBase64, mediaType: parsed.mediaType || 'image/jpeg' }];
    }
    if (Array.isArray(parsed.inventoryNames)) {
      inventoryNames = parsed.inventoryNames.filter(n => typeof n === 'string' && n.trim()).slice(0, 300);
    }
    if (Array.isArray(parsed.caseTrackedNames)) {
      caseTrackedNames = parsed.caseTrackedNames.filter(n => typeof n === 'string' && n.trim()).slice(0, 300);
    }
    if (Array.isArray(parsed.categoryNames)) {
      categoryNames = parsed.categoryNames.filter(n => typeof n === 'string' && n.trim()).slice(0, 50);
    }
    multi = parsed.multi === true;
    ownerUid = typeof parsed.ownerUid === 'string' && parsed.ownerUid ? parsed.ownerUid : callerUid;
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Body inválido' }) };
  }

  if (!images || images.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Falta la imagen' }) };
  }

  if (images.length > 5) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Máximo 5 páginas por recibo' }) };
  }
  // Mismo guard de tamaño por imagen que identify-product: cortar acá un payload
  // absurdo antes de viajar megas hasta la API de Claude.
  if (images.some(img => !img || typeof img.base64 !== 'string' || img.base64.length > 7000000)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Una de las imágenes es demasiado grande — volvé a intentar desde la app' }) };
  }
  let reservation;
  try {
    const hasAccess = await callerCanUseAccount(callerUid, ownerUid);
    if (!hasAccess) {
      return { statusCode: 403, body: JSON.stringify({ error: 'No tenés acceso a esa cuenta' }) };
    }
    if (!(await checkIpRateLimit(event))) {
      return { statusCode: 429, body: JSON.stringify({ error: 'Demasiados escaneos seguidos desde esta conexión — esperá un rato y probá de nuevo' }) };
    }
    // Reserva el cupo ANTES de llamar a Claude (chequeo+descuento atómicos) — ver
    // reserveScanQuota en lib/patron-admin.js para el porqué.
    reservation = await reserveScanQuota(ownerUid, caller);
    if (!reservation.allowed) {
      return { statusCode: 429, body: JSON.stringify({ error: 'Llegaste al límite de escaneos de tu plan este mes', quotaExceeded: true }) };
    }
  } catch (e) {
    console.error('[Dusty] error verificando cupo de escaneo:', e);
    return { statusCode: 500, body: JSON.stringify({ error: 'No se pudo verificar tu cupo de escaneos, intentá de nuevo' }) };
  }

  const imageContentBlocks = images.map(img => ({
    type: 'image',
    source: { type: 'base64', media_type: img.mediaType || 'image/jpeg', data: img.base64 }
  }));

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        // Con varios recibos en una misma foto la respuesta puede ser bastante más larga
        // (cada recibo trae su propio encabezado y su propia lista), así que necesita más
        // margen. La app manda una foto por pedido en ese modo, así que cada llamada sigue
        // siendo de un tamaño parecido a la de siempre — no se acumula todo en una.
        max_tokens: multi ? 10000 : 6000,
        // Este modelo piensa "puertas adentro" antes de responder por defecto, y ese
        // pensamiento le resta del mismo límite de tokens que la respuesta final. Con
        // un recibo largo (30+ productos) el pensamiento solo puede agotar los 3000
        // tokens que había antes, dejando la respuesta real vacía — confirmado con un
        // recibo real que fallaba así. Se desactiva explícitamente porque esta tarea
        // es lectura + extracción directa, no necesita razonamiento en varios pasos.
        thinking: { type: 'disabled' },
        messages: [
          {
            role: 'user',
            content: [
              ...imageContentBlocks,
              { type: 'text', text: buildPrompt(inventoryNames, caseTrackedNames, categoryNames, multi) }
            ]
          }
        ]
      })
    });

    const data = await response.json();

    if (data.error) {
      return { statusCode: 502, body: JSON.stringify({ error: data.error.message || 'Error del lector de recibos' }) };
    }

    const textBlock = (data.content || []).find(b => b.type === 'text');
    if (!textBlock || !textBlock.text) {
      // Si esto vuelve a pasar, "stop_reason" dice por qué: "max_tokens" significa
      // que el recibo es tan largo que ni con el límite subido y el pensamiento
      // desactivado alcanzó — en ese caso hay que subir max_tokens de nuevo.
      return { statusCode: 502, body: JSON.stringify({
        error: 'El lector de recibos no devolvió texto',
        stopReason: data.stop_reason || null
      }) };
    }

    let receiptData;
    try {
      const clean = textBlock.text.replace(/```json|```/g, '').trim();
      receiptData = JSON.parse(clean);
    } catch (e) {
      // Antes esto se rendía apenas el texto no era JSON puro. En la práctica, a veces
      // el modelo agrega alguna palabra suelta antes o después del JSON (aunque se le
      // pidió que no lo haga) — como segundo intento, se recorta todo lo que esté antes
      // del primer "{" y después del último "}" y se prueba de nuevo antes de rendirse.
      try {
        const start = textBlock.text.indexOf('{');
        const end = textBlock.text.lastIndexOf('}');
        if (start === -1 || end === -1 || end <= start) throw e;
        receiptData = JSON.parse(textBlock.text.slice(start, end + 1));
      } catch (e2) {
        return { statusCode: 502, body: JSON.stringify({
          error: 'No se pudo interpretar la respuesta del lector de recibos',
          stopReason: data.stop_reason || null,
          debugPreview: textBlock.text.slice(0, 300)
        }) };
      }
    }

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
          stopReason: data.stop_reason || null
        }) };
      }
      // La llamada ya reservó 1 al entrar; se cuenta 1 por cada recibo que realmente
      // salió de la foto (si no, subir varios recibos juntos sería gratis), así que
      // acá se suma solo lo que excede la reserva.
      if (list.length > 1) await recordScanUsage(ownerUid, list.length - 1, reservation.period);
      return { statusCode: 200, body: JSON.stringify({ receipts: list }) };
    }

    return { statusCode: 200, body: JSON.stringify(receiptData) };
  } catch (err) {
    // Si el fetch a Claude reventó por red, lo más probable es que no se haya
    // cobrado nada — se devuelve la unidad reservada. Los 502 de más arriba
    // (Claude contestó pero mal) NO refundan: esa llamada costó plata real.
    await refundScanUsage(ownerUid, 1, reservation.period);
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Error interno' }) };
  }
};
