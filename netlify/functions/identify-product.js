// netlify/functions/identify-product.js
//
// Hermana de extract-receipt.js, pero en vez de leer una factura entera lee UNA
// foto de un producto físico (la etiqueta, el empaque, o el producto en sí) para
// sugerir con qué completar el formulario de "nuevo producto" — nombre, unidad,
// categoría, costo si se ve un precio, y el código/SKU si hay uno impreso.
//
// Comparte con extract-receipt.js el mismo cupo mensual de escaneos (ver
// checkScanQuota/recordScanUsage en lib/patron-admin.js): identificar un producto
// le pega a Claude con visión igual que leer un recibo, así que cuesta plata real
// y cuenta contra el mismo límite — separarlo dejaría un hueco para gastar sin
// tope una vez agotado el cupo de recibos.
const {
  isAllowedOrigin, verifyCaller,
  currentBillingPeriod, callerCanUseAccount, checkScanQuota, recordScanUsage
} = require('./lib/patron-admin');

function buildPrompt(categoryNames) {
  const hasCategories = Array.isArray(categoryNames) && categoryNames.length > 0;
  return `Eres un sistema experto en identificar productos de insumos de restaurante o comercio a partir de UNA foto del producto físico (su empaque, etiqueta, o el producto en sí — no una factura).

Analiza la imagen y devolvé JSON puro (sin markdown, sin backticks, sin texto extra antes o después) con este formato exacto:
{
  "name": "string (en inglés, nombre claro y natural del producto — ej. 'Chicken Tenders', 'Aluminum Pan (9 in)')",
  "unit": "string: lb, kg, oz, g, ml, l, o unidad (usá 'unidad' para piezas sueltas sin peso)",
  "cost_per_unit": number o null,
  "sku": "string o null",
  "category": "string exacto de la lista de abajo, o null",
  "confidence": "alta" | "media" | "baja"
}

REGLAS:
- "name" es SIEMPRE en inglés, sea cual sea el idioma del empaque (regla fija del negocio: los nombres de producto en el sistema siempre quedan en inglés).
- "cost_per_unit" solo si hay un precio visible en la foto (etiqueta de góndola, sticker de precio, etc — no lo inventes) — es el precio por la unidad elegida, no el total de un paquete grande si se puede calcular el precio por unidad base. Si no hay ningún precio visible, "cost_per_unit": null.
- "sku": el código de producto/artículo si aparece impreso cerca del código de barras o en la etiqueta (no inventes uno). Si no ves ninguno, null.
- Si no podés identificar el producto con confianza razonable, hacé tu mejor estimación pero marcá "confidence": "baja".

${hasCategories ? `SOBRE "category":
Esta es la lista de categorías que el usuario ya tiene creadas en su inventario:
${categoryNames.map(n => `- ${n}`).join('\n')}
Elegí la que mejor le quede (usá tu criterio, no comparación literal). Si corresponde, poné el nombre EXACTO tal cual aparece en esa lista. Si ninguna le queda bien, poné "category": null.` : `El usuario no tiene categorías de inventario creadas todavía, así que "category" va a ser null.`}`;
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

  const callerUid = await verifyCaller(event);
  if (!callerUid) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Iniciá sesión para escanear un producto' }) };
  }

  let image, categoryNames, ownerUid;
  try {
    const parsed = JSON.parse(event.body || '{}');
    if (parsed.image && typeof parsed.image.base64 === 'string') image = parsed.image;
    if (Array.isArray(parsed.categoryNames)) {
      categoryNames = parsed.categoryNames.filter(n => typeof n === 'string' && n.trim()).slice(0, 50);
    }
    ownerUid = typeof parsed.ownerUid === 'string' && parsed.ownerUid ? parsed.ownerUid : callerUid;
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Body inválido' }) };
  }

  if (!image) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Falta la imagen' }) };
  }

  try {
    const hasAccess = await callerCanUseAccount(callerUid, ownerUid);
    if (!hasAccess) {
      return { statusCode: 403, body: JSON.stringify({ error: 'No tenés acceso a esa cuenta' }) };
    }
    const quota = await checkScanQuota(ownerUid);
    if (!quota.allowed) {
      return { statusCode: 429, body: JSON.stringify({ error: 'Llegaste al límite de escaneos de tu plan este mes', quotaExceeded: true }) };
    }
  } catch (e) {
    console.error('[Dusty] error verificando cupo de escaneo:', e);
    return { statusCode: 500, body: JSON.stringify({ error: 'No se pudo verificar tu cupo de escaneos, intentá de nuevo' }) };
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
        max_tokens: 1000,
        thinking: { type: 'disabled' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: image.mediaType || 'image/jpeg', data: image.base64 } },
              { type: 'text', text: buildPrompt(categoryNames) }
            ]
          }
        ]
      })
    });

    const data = await response.json();

    if (data.error) {
      return { statusCode: 502, body: JSON.stringify({ error: data.error.message || 'Error del identificador de productos' }) };
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

    await recordScanUsage(ownerUid, 1, currentBillingPeriod());
    return { statusCode: 200, body: JSON.stringify(productData) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Error interno' }) };
  }
};
