// netlify/functions/identify-product.js
//
// Hermana de extract-receipt.js, pero en vez de leer una factura entera lee UNA
// foto de un producto físico (la etiqueta, el empaque, o el producto en sí) para
// sugerir con qué completar el formulario de "nuevo producto" — nombre, unidad,
// categoría, costo si se ve un precio, y el código/SKU si hay uno impreso.
//
// Comparte con extract-receipt.js el mismo cupo mensual de escaneos (ver
// reserveScanQuota/refundScanUsage en lib/patron-admin.js): identificar un producto
// le pega a Claude con visión igual que leer un recibo, así que cuesta plata real
// y cuenta contra el mismo límite — separarlo dejaría un hueco para gastar sin
// tope una vez agotado el cupo de recibos.
const {
  isAllowedOrigin, verifyCallerInfo,
  currentBillingPeriod, callerCanUseAccount, reserveScanQuota, refundScanUsage,
  checkIpRateLimit
} = require('./lib/patron-admin');

function buildPrompt(categoryNames, inventoryNames) {
  const hasCategories = Array.isArray(categoryNames) && categoryNames.length > 0;
  const hasInventory = Array.isArray(inventoryNames) && inventoryNames.length > 0;
  return `Eres un sistema experto en identificar productos de insumos de restaurante o comercio a partir de UNA foto del producto físico (su empaque, etiqueta, o el producto en sí — no una factura).

Analiza la imagen y devolvé JSON puro (sin markdown, sin backticks, sin texto extra antes o después) con este formato exacto:
{
  "name": "string (en inglés, nombre claro y natural del producto — ej. 'Chicken Tenders', 'Aluminum Pan (9 in)')",
  "unit": "string: lb, kg, oz, g, ml, l, o unidad (usá 'unidad' para piezas sueltas sin peso)",
  "cost_per_unit": number o null,
  "sku": "string o null",
  "category": "string (de la lista de abajo, o una categoría nueva propuesta), o null",
  "confidence": "alta" | "media" | "baja",
  "matched_inventory_name": "string o null"
}

${hasInventory ? `SOBRE "matched_inventory_name":
Esta es la lista de productos que el usuario YA tiene cargados en su inventario:
${inventoryNames.map(n => `- ${n}`).join('\n')}
Si el producto de la foto ES el mismo que uno de esa lista (usá tu criterio: abreviaturas, marcas, tamaños — no comparación literal), poné el nombre EXACTO tal cual aparece en la lista. Si no corresponde a ninguno, null.` : `El usuario no tiene productos en su inventario todavía, así que "matched_inventory_name" va a ser null.`}

REGLAS:
- "name" es SIEMPRE en inglés, sea cual sea el idioma del empaque (regla fija del negocio: los nombres de producto en el sistema siempre quedan en inglés).
- "cost_per_unit" solo si hay un precio visible en la foto (etiqueta de góndola, sticker de precio, etc — no lo inventes) — es el precio por la unidad elegida, no el total de un paquete grande si se puede calcular el precio por unidad base. Si no hay ningún precio visible, "cost_per_unit": null.
- "sku": el código de producto/artículo si aparece impreso cerca del código de barras o en la etiqueta (no inventes uno). Si no ves ninguno, null.
- Si no podés identificar el producto con confianza razonable, hacé tu mejor estimación pero marcá "confidence": "baja".

${hasCategories ? `SOBRE "category":
Esta es la lista de categorías que el usuario ya tiene creadas en su inventario:
${categoryNames.map(n => `- ${n}`).join('\n')}
Elegí la que mejor le quede (usá tu criterio, no comparación literal). Si corresponde, poné el nombre EXACTO tal cual aparece en esa lista. Si NINGUNA de la lista le queda bien, PROPONÉ una categoría nueva vos: un nombre corto y genérico en inglés (1-2 palabras, tipo de producto, no marca) — ej. "Cables", "Breakers", "Lights", "Cleaning", "Tools". Nunca null si podés reconocer qué tipo de producto es.` : `El usuario no tiene categorías de inventario creadas todavía. PROPONÉ vos la categoría en "category": un nombre corto y genérico en inglés (1-2 palabras, tipo de producto, no marca) — ej. "Cables", "Breakers", "Lights", "Tools". Solo usá null si de verdad no se reconoce qué es.`}`;
}

// Modo LOTE: la misma foto puede tener VARIOS productos distintos a la vista (un
// estante, una mesa con las compras, la alacena) y el objetivo es armar inventario
// de una — un objeto por producto, no un solo "mejor candidato".
function buildMultiPrompt(categoryNames, inventoryNames) {
  const hasCategories = Array.isArray(categoryNames) && categoryNames.length > 0;
  const hasInventory = Array.isArray(inventoryNames) && inventoryNames.length > 0;
  return `Eres un sistema experto en identificar productos de insumos de restaurante o comercio a partir de una foto donde pueden verse VARIOS productos físicos distintos a la vez (un estante, una mesa, una alacena, las compras apoyadas).

Identificá CADA producto DISTINTO que se vea con claridad razonable y devolvé JSON puro (sin markdown, sin backticks, sin texto extra antes o después) con este formato exacto:
{
  "products": [
    {
      "name": "string (en inglés, nombre claro y natural — ej. 'Chicken Tenders', 'Aluminum Pan (9 in)')",
      "unit": "string: lb, kg, oz, g, ml, l, o unidad (usá 'unidad' para piezas sueltas sin peso)",
      "cost_per_unit": number o null,
      "sku": "string o null",
      "category": "string (de la lista de abajo, o una categoría nueva propuesta), o null",
      "confidence": "alta" | "media" | "baja",
      "box": {"x": number, "y": number, "w": number, "h": number} o null,
      "matched_inventory_name": "string o null"
    }
  ]
}

REGLAS:
- UN objeto por producto DISTINTO. Varias unidades idénticas del mismo producto (ej. 6 latas iguales) son UN solo objeto, no seis.
- "box": dónde está ESE producto dentro de la foto, como fracciones de 0 a 1 del ancho/alto totales (x,y = esquina superior izquierda). Es para recortar una miniatura que sirva de ícono, así que un recorte aproximado que encuadre el producto con un poco de aire alrededor es perfecto. Si no podés ubicarlo con seguridad, "box": null.
- "name" es SIEMPRE en inglés, sea cual sea el idioma del empaque (regla fija del negocio).
- "cost_per_unit" solo si ESE producto tiene un precio visible (etiqueta de góndola, sticker) — no lo inventes; si no, null.
- "sku": solo si aparece impreso para ese producto; si no, null.
- Productos parcialmente tapados o borrosos: incluilos con tu mejor estimación y "confidence": "baja" — el usuario confirma cada uno antes de guardar.
- No incluyas cosas que claramente no son inventario (personas, muebles del local, decoración).
- Máximo 25 productos. Si no se reconoce NINGÚN producto, devolvé {"products": []}.

${hasInventory ? `SOBRE "matched_inventory_name":
Esta es la lista de productos que el usuario YA tiene cargados en su inventario:
${inventoryNames.map(n => `- ${n}`).join('\n')}
Si un producto de la foto ES el mismo que uno de esa lista (criterio: abreviaturas, marcas, tamaños — no comparación literal), poné el nombre EXACTO tal cual aparece en la lista. Si no corresponde a ninguno, null.` : `El usuario no tiene productos en su inventario todavía, así que "matched_inventory_name" va a ser null en todos.`}

${hasCategories ? `SOBRE "category":
Esta es la lista de categorías que el usuario ya tiene creadas en su inventario:
${categoryNames.map(n => `- ${n}`).join('\n')}
Elegí para cada producto la que mejor le quede (criterio, no comparación literal), con el nombre EXACTO de esa lista. Si a un producto NINGUNA de la lista le queda bien, PROPONÉ una categoría nueva: nombre corto y genérico en inglés (1-2 palabras, tipo de producto, no marca) — ej. "Cables", "Breakers", "Lights", "Tools". Nunca null si podés reconocer qué tipo de producto es.` : `El usuario no tiene categorías de inventario creadas todavía. PROPONÉ vos la categoría de cada producto en "category": nombre corto y genérico en inglés (1-2 palabras, tipo de producto, no marca) — ej. "Cables", "Breakers", "Lights", "Tools". Solo null si no se reconoce.`}`;
}

/* Modo STOCK: la foto es del estante/las piezas del propio negocio y el objetivo no
   es dar de alta productos sino LEER CANTIDADES para ajustar el inventario (escáner
   de estante) o prellenar la composición de una receta (foto de la pieza armada).
   Es el único modo con thinking activado: contar se beneficia de recorrer la imagen
   con método, pero con presupuesto MODERADO (~2k tokens) — el objetivo es 5-10 s,
   no una meditación. Las reglas anti-trampa de abajo salieron de pruebas reales:
   la cinta de embalar duplicaba conteos de cajas (16 contadas vs 8 reales) hasta
   que se agregó la regla de la sombra/desalineación. */
function buildStockPrompt(inventoryNames, lang){
  const hasInventory = Array.isArray(inventoryNames) && inventoryNames.length > 0;
  // Los textos que el USUARIO ve (visible_note, sticker_color) salen en el idioma
  // de SU app — inglés por defecto (es el idioma principal de Dusty); español solo
  // si su app está en español. El prompt en sí puede seguir en español: la IA lo
  // entiende igual, lo que importa es el idioma del OUTPUT visible.
  const noteLang = lang === 'es' ? 'en español' : 'EN INGLÉS (el usuario usa la app en inglés)';
  const colorEj = lang === 'es' ? '"amarillo"' : '"yellow"';
  return `Eres un sistema experto en leer CANTIDADES de inventario a partir de una foto del estante, la mesa o las piezas de un negocio. No estás dando de alta productos: estás contando/estimando cuánto hay de cada uno.

CASO ESPECIAL — LISTA ESCRITA (detectalo ANTES que nada):
Si la foto NO muestra productos físicos sino una LISTA escrita (a mano o impresa)
de nombres de productos con cantidades o ajustes (ej. "Encanto slim Yarn  -1",
"Brown Glitter macrame  -1"), NO estás contando un estante: estás transcribiendo
una nota de SALIDAS. Este escáner SOLO DESCUENTA inventario: cada renglón legible
es un producto con reading "ajuste" y "delta" SIEMPRE NEGATIVO — el número es la
cantidad que salió, esté escrito "-1", "1" o "+1" (los tres → delta -1). Si un
renglón parece querer SUMAR stock, transcribilo igual con delta negativo y
anotá la duda en visible_note. Los nombres van tal como están
escritos (matched_inventory_name los empareja contra el inventario abajo, con el
mismo criterio flexible de siempre — mayúsculas, espacios y abreviaturas no
importan). Un renglón ilegible se omite; si dudás de un número, confidence "baja".
En este caso count, fill_percent y box van null en todos.

MÉTODO OBLIGATORIO para fotos de productos físicos (en este orden, antes de dar ningún número):
1. CLASIFICÁ cada producto según su forma de lectura:
   - "unidades": objetos discretos, separados y visibles (frascos en fila, botellas, latas, piezas sueltas) → se cuentan.
   - "nivel": contenido dentro de un envase (líquido, granos, chips, polvo en frasco/botella transparente) → se estima el % de llenado, NO se cuenta.
   - "pila": objetos apilados en grilla regular (cajas) → se cuentan caras visibles y se infiere el patrón.
   - "incontable": montón suelto e irregular (chips amontonados, objetos enredados) → count null; si están en un envase, estimá fill_percent; si no, ambos null.
2. CONTÁ con método, no a ojo: recorré zona por zona. En pilas, contá por camadas (alto × ancho × fondo).
3. VERIFICÁ por un segundo camino SOLO si hay ambigüedad (objetos cruzados, divisiones dudosas, encuadre justo). Si los dos caminos no coinciden, reportá el número más conservador y bajá la confianza.

REGLAS ANTI-TRAMPA (aprendidas de errores reales):
- CINTA vs. DIVISIÓN: la cinta de embalar sobre la unión de tapas de una caja parece una división entre dos cajas. Una división REAL tiene hendidura con sombra y bordes desalineados entre camadas (patrón de ladrillo); una línea plana, brillante y perfectamente alineada de arriba a abajo es cinta — es UNA caja, no dos.
- ENCUADRE: si la pila/el grupo toca el borde de la foto, no ves sus límites — confidence "baja" y anotalo en visible_note.
- VISTO vs. INFERIDO: en pilas solo ves las caras del frente; el interior es inferencia. Si inferiste profundidad, decilo en visible_note ("2 de fondo inferido").
- MARCAS DE COLOR: si unidades por lo demás idénticas se distinguen con stickers/marcas de color, devolvé UN objeto por color con "sticker_color" (nombre del color ${noteLang}, ej. ${colorEj}), y otro para las que no tienen marca (sticker_color null).
- Nunca des un número con confianza alta si fue inferencia o estimación — la confianza honesta vale más que el número redondo.

Devolvé JSON puro (sin markdown, sin backticks, sin texto extra) con este formato exacto:
{
  "products": [
    {
      "name": "string (en inglés, nombre claro del producto)",
      "matched_inventory_name": "string o null",
      "reading": "unidades" | "nivel" | "pila" | "incontable" | "ajuste",
      "count": number entero o null,
      "delta": number NEGATIVO o null (SOLO para reading "ajuste": cantidad que salió, ej. -1),
      "fill_percent": number 0-100 o null,
      "sticker_color": "string o null",
      "confidence": "alta" | "media" | "baja",
      "visible_note": "string corta o null (qué fue inferido/qué falta ver — escrita ${noteLang})",
      "box": {"x": number, "y": number, "w": number, "h": number} o null
    }
  ]
}

- "count" solo para reading "unidades" o "pila" (entero ≥ 0). Para "nivel"/"incontable": null.
- "fill_percent" solo cuando se ve el nivel dentro de un envase. Si no aplica: null.
- "box": fracciones 0-1 del ancho/alto (x,y = esquina superior izquierda), para recortar miniatura. Si no podés ubicarlo: null.
- Máximo 25 productos. Sin productos reconocibles: {"products": []}.

${hasInventory ? `SOBRE "matched_inventory_name":
Esta es la lista de productos que el usuario YA tiene en su inventario:
${inventoryNames.map(n => `- ${n}`).join('\n')}
Si un producto de la foto ES uno de esa lista (criterio: abreviaturas, marcas, tamaños — no comparación literal), poné el nombre EXACTO tal cual aparece. Si no, null.` : `El usuario no tiene productos en su inventario todavía — "matched_inventory_name" va a ser null en todos.`}`;
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

  const caller = await verifyCallerInfo(event);
  if (!caller) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Iniciá sesión para escanear un producto', code: 'auth_required' }) };
  }
  const callerUid = caller.uid;

  let image, categoryNames, inventoryNames, ownerUid, multi = false, stock = false, lang = 'en';
  try {
    const parsed = JSON.parse(event.body || '{}');
    if (parsed.image && typeof parsed.image.base64 === 'string') image = parsed.image;
    if (parsed.lang === 'es') lang = 'es'; // inglés por defecto — idioma principal
    if (Array.isArray(parsed.categoryNames)) {
      categoryNames = parsed.categoryNames.filter(n => typeof n === 'string' && n.trim()).slice(0, 50);
    }
    // Nombres del inventario actual: para que el modo individual pueda decir "este
    // producto ES el que ya tenés cargado como X" (matched_inventory_name) — mismo
    // criterio que extract-receipt.js usa para emparejar líneas de factura.
    if (Array.isArray(parsed.inventoryNames)) {
      inventoryNames = parsed.inventoryNames.filter(n => typeof n === 'string' && n.trim()).slice(0, 300);
    }
    // multi=true: la foto puede tener varios productos y la respuesta es
    // {products:[...]}. Sin el flag se comporta exactamente como siempre (un solo
    // objeto), así que los clientes viejos siguen funcionando igual.
    multi = parsed.multi === true;
    // stock=true: modo lectura de cantidades (escáner de estante / composición de
    // receta) — respuesta {products:[...]} con count/fill_percent en vez de datos de
    // alta. Es incompatible con multi (formatos distintos); stock gana si vienen ambos.
    stock = parsed.stock === true;
    ownerUid = typeof parsed.ownerUid === 'string' && parsed.ownerUid ? parsed.ownerUid : callerUid;
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Body inválido', code: 'bad_request' }) };
  }

  if (!image) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Falta la imagen', code: 'bad_request' }) };
  }
  // El cliente ya reduce la foto antes de mandarla (~1400px); si llega algo mucho
  // más grande es un cliente roto o alguien pegándole a mano a la función. Cortarlo
  // acá da un error claro en vez de viajar megas hasta la API de Claude para que
  // falle allá con un 502 confuso (el límite real de la API es 5MB por imagen).
  if (image.base64.length > 7000000) {
    return { statusCode: 400, body: JSON.stringify({ error: 'La imagen es demasiado grande — volvé a intentar desde la app', code: 'image_too_big' }) };
  }

  let reservation;
  try {
    const hasAccess = await callerCanUseAccount(callerUid, ownerUid);
    if (!hasAccess) {
      return { statusCode: 403, body: JSON.stringify({ error: 'No tenés acceso a esa cuenta', code: 'no_access' }) };
    }
    if (!(await checkIpRateLimit(event))) {
      return { statusCode: 429, body: JSON.stringify({ error: 'Demasiados escaneos seguidos desde esta conexión — esperá un rato y probá de nuevo', code: 'rate_limited' }) };
    }
    // Reserva el cupo ANTES de llamar a Claude (chequeo+descuento atómicos) — ver
    // reserveScanQuota en lib/patron-admin.js para el porqué.
    reservation = await reserveScanQuota(ownerUid, caller);
    if (!reservation.allowed) {
      return { statusCode: 429, body: JSON.stringify({ error: 'Llegaste al límite de escaneos de tu plan este mes', quotaExceeded: true }) };
    }
  } catch (e) {
    console.error('[Dusty] error verificando cupo de escaneo:', e);
    return { statusCode: 500, body: JSON.stringify({ error: 'No se pudo verificar tu cupo de escaneos, intentá de nuevo', code: 'quota_check_failed' }) };
  }

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
        // El modo lote puede devolver hasta 25 productos con su box — necesita más
        // espacio de salida que el objeto único de siempre. El modo stock además
        // reserva espacio para el razonamiento del conteo.
        max_tokens: stock ? 6000 : (multi ? 4000 : 1000),
        // Solo el modo stock piensa antes de responder: contar con método (clasificar
        // la forma de lectura, recorrer por zonas, verificar ambigüedades) rinde más
        // que responder de un tirón. OJO: claude-sonnet-5 eliminó el formato viejo
        // {type:'enabled', budget_tokens: N} — devolvía 400 ("not supported for this
        // model") y el escáner de estante fallaba SIEMPRE con ese error en pantalla.
        // El control actual es thinking adaptive + output_config.effort: "medium"
        // reemplaza al presupuesto moderado de antes (los ~5-10s aceptables, no
        // medio minuto). {type:'disabled'} sigue siendo válido para los modos que
        // no necesitan razonar.
        thinking: stock ? { type: 'adaptive' } : { type: 'disabled' },
        ...(stock ? { output_config: { effort: 'medium' } } : {}),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: image.mediaType || 'image/jpeg', data: image.base64 } },
              { type: 'text', text: stock ? buildStockPrompt(inventoryNames, lang) : (multi ? buildMultiPrompt(categoryNames, inventoryNames) : buildPrompt(categoryNames, inventoryNames)) }
            ]
          }
        ]
      })
    });

    const data = await response.json();

    if (data.error) {
      // Mismo criterio que extract-receipt: un error a nivel de API no se factura,
      // la unidad reservada se devuelve.
      await refundScanUsage(ownerUid, 1, reservation.period);
      return { statusCode: 502, body: JSON.stringify({ error: data.error.message || 'Error del identificador de productos', code: 'upstream_error' }) };
    }

    const textBlock = (data.content || []).find(b => b.type === 'text');
    if (!textBlock || !textBlock.text) {
      return { statusCode: 502, body: JSON.stringify({
        error: 'El identificador de productos no devolvió texto',
        stopReason: data.stop_reason || null
      }) };
    }

    let productData;
    try {
      const clean = textBlock.text.replace(/```json|```/g, '').trim();
      productData = JSON.parse(clean);
    } catch (e) {
      try {
        const start = textBlock.text.indexOf('{');
        const end = textBlock.text.lastIndexOf('}');
        if (start === -1 || end === -1 || end <= start) throw e;
        productData = JSON.parse(textBlock.text.slice(start, end + 1));
      } catch (e2) {
        return { statusCode: 502, body: JSON.stringify({
          error: 'No se pudo interpretar la respuesta del identificador de productos',
          debugPreview: textBlock.text.slice(0, 300)
        }) };
      }
    }

    if (stock) {
      // Normalizar el modo stock: siempre {products:[...]}, cada campo validado —
      // un número basura acá se convierte en un ajuste de inventario equivocado,
      // así que se descarta a null antes que dejarlo pasar.
      let products = Array.isArray(productData.products) ? productData.products : [];
      products = products
        .filter(p => p && typeof p.name === 'string' && p.name.trim())
        .slice(0, 25)
        .map(p => {
          const b = p.box;
          const boxOk = b && ['x','y','w','h'].every(k => typeof b[k] === 'number' && isFinite(b[k]))
            && b.w > 0.01 && b.h > 0.01 && b.x >= 0 && b.y >= 0 && b.x + b.w <= 1.05 && b.y + b.h <= 1.05;
          const count = (typeof p.count === 'number' && isFinite(p.count) && p.count >= 0) ? Math.round(p.count) : null;
          const fill = (typeof p.fill_percent === 'number' && isFinite(p.fill_percent) && p.fill_percent >= 0)
            ? Math.min(Math.round(p.fill_percent), 100) : null;
          // "ajuste": el modo lista-escrita (una nota de salidas fotografiada). El
          // escáner de estante SOLO descuenta — el delta se fuerza negativo acá
          // (aunque el modelo mande +2, sale -2) y con tope sano (10000) para que
          // un número basura no vacíe un inventario de un plumazo.
          const delta = (p.reading === 'ajuste' && typeof p.delta === 'number' && isFinite(p.delta) && p.delta !== 0 && Math.abs(p.delta) <= 10000)
            ? -Math.abs(Math.round(p.delta)) : null;
          return {
            name: p.name.trim(),
            matched_inventory_name: typeof p.matched_inventory_name === 'string' && p.matched_inventory_name.trim() ? p.matched_inventory_name : null,
            reading: ['unidades','nivel','pila','incontable','ajuste'].includes(p.reading) ? p.reading : 'incontable',
            delta,
            count,
            fill_percent: fill,
            sticker_color: typeof p.sticker_color === 'string' && p.sticker_color.trim() ? p.sticker_color.trim() : null,
            confidence: ['alta','media','baja'].includes(p.confidence) ? p.confidence : 'baja',
            visible_note: typeof p.visible_note === 'string' && p.visible_note.trim() ? p.visible_note.trim().slice(0, 200) : null,
            box: boxOk ? { x: b.x, y: b.y, w: b.w, h: b.h } : null
          };
        });
      return { statusCode: 200, body: JSON.stringify({ products }) };
    }

    if (multi) {
      // Normalizar: siempre {products:[...]} con como mucho 25 entradas válidas,
      // aunque el modelo se desvíe un poco del formato (objeto suelto, box rota).
      let products = Array.isArray(productData.products) ? productData.products
        : (productData.name ? [productData] : []);
      products = products
        .filter(p => p && typeof p.name === 'string' && p.name.trim())
        .slice(0, 25)
        .map(p => {
          const b = p.box;
          const boxOk = b && ['x','y','w','h'].every(k => typeof b[k] === 'number' && isFinite(b[k]))
            && b.w > 0.01 && b.h > 0.01 && b.x >= 0 && b.y >= 0 && b.x + b.w <= 1.05 && b.y + b.h <= 1.05;
          return {
            name: p.name.trim(),
            unit: typeof p.unit === 'string' ? p.unit : 'unidad',
            cost_per_unit: typeof p.cost_per_unit === 'number' && isFinite(p.cost_per_unit) ? p.cost_per_unit : null,
            sku: typeof p.sku === 'string' && p.sku.trim() ? p.sku.trim() : null,
            category: typeof p.category === 'string' && p.category.trim() ? p.category : null,
            confidence: ['alta','media','baja'].includes(p.confidence) ? p.confidence : 'baja',
            box: boxOk ? { x: b.x, y: b.y, w: b.w, h: b.h } : null,
            matched_inventory_name: typeof p.matched_inventory_name === 'string' && p.matched_inventory_name.trim() ? p.matched_inventory_name : null
          };
        });
      return { statusCode: 200, body: JSON.stringify({ products }) };
    }

    return { statusCode: 200, body: JSON.stringify(productData) };
  } catch (err) {
    // Fetch a Claude reventó por red: lo más probable es que no se haya cobrado —
    // se devuelve la unidad reservada. Los 502 (Claude contestó mal) no refundan.
    await refundScanUsage(ownerUid, 1, reservation.period);
    // Genérico a propósito: err.message crudo filtraba detalles internos al cliente.
    return { statusCode: 500, body: JSON.stringify({ error: 'Error interno', code: 'internal' }) };
  }
};
