// netlify/functions/upload-catalog-photo.js
//
// SÚPER CALIDAD para el catálogo (caso del usuario: un restaurante con fotos de
// platillos): las fotos de producto viven en 300px dentro de la app (localStorage
// y sync livianos), pero eso se queda corto en la ficha grande del catálogo
// público. Esta función recibe la versión en ALTA (1200px, ya editada y con su
// filtro) al momento de asignar la foto, la guarda pública en Storage y devuelve
// la URL — el ítem solo carga con un string (photoHiUrl) y publish-catalog la
// prefiere sobre el thumbnail. Sin IA: no gasta cupo de escaneos.
// (Nombre sin sufijo "-background" a propósito — ver remove-bg.js.)
const {
  admin, getFirebaseApp, isAllowedOrigin, verifyCallerInfo, callerCanUseAccount,
  checkIpRateLimit
} = require('./lib/patron-admin');

const MAX_IMG_B64 = 2500000; // ~1.8MB reales — un JPEG de 1200px anda muy por debajo

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  }
  if (!isAllowedOrigin(event)) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Origen no permitido' }) };
  }
  getFirebaseApp();
  const caller = await verifyCallerInfo(event);
  if (!caller) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Sesión inválida', code: 'bad_token' }) };
  }
  if (caller.isAnonymous) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Necesita cuenta guardada', code: 'needs_account' }) };
  }
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Body inválido' }) };
  }
  const ownerUid = (typeof body.ownerUid === 'string' && body.ownerUid) ? body.ownerUid.slice(0, 128) : caller.uid;
  if (!(await callerCanUseAccount(caller.uid, ownerUid))) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Sin acceso a esa cuenta' }) };
  }
  if (!(await checkIpRateLimit(event))) {
    return { statusCode: 429, body: JSON.stringify({ error: 'Demasiadas subidas seguidas — espera un rato', code: 'rate_limited' }) };
  }
  const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64 : '';
  if (!imageBase64 || imageBase64.length > MAX_IMG_B64) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Falta la imagen o es demasiado grande' }) };
  }
  // El id del ítem forma el nombre del archivo: solo caracteres seguros.
  const itemId = String(body.itemId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);
  if (!itemId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Falta el producto' }) };
  }
  // Miniatura para la GRILLA de la página pública (auditoría 2026-09-07: cada
  // cuadradito de 170px descargaba la foto de 1440px). Opcional: la app la
  // manda ya horneada a 480px; sin ella, el catálogo sigue usando la alta.
  const thumbBase64 = typeof body.thumbBase64 === 'string' && body.thumbBase64.length <= 400000 ? body.thumbBase64 : '';
  try {
    const bucket = admin.storage().bucket();
    // Por uid del dueño: republicar la foto de un ítem PISA la anterior (sin
    // huérfanas por cada retoque) y borrar la cuenta puede barrer el prefijo.
    const file = bucket.file(`catalogHires/${ownerUid}/${itemId}.jpg`);
    // Cache-buster por versión: la URL cambia con cada subida para que el CDN y
    // los navegadores no sigan mostrando la foto vieja tras un retoque — y por
    // eso mismo cada versión puede ser INMUTABLE para el navegador (un año):
    // sin este header GCS servía max-age=3600 y la foto se re-pedía cada hora.
    const v = Date.now();
    const meta = { contentType: 'image/jpeg', resumable: false, metadata: { cacheControl: 'public, max-age=31536000, immutable' } };
    await file.save(Buffer.from(imageBase64, 'base64'), meta);
    await file.makePublic();
    const url = `https://storage.googleapis.com/${bucket.name}/${file.name}?v=${v}`;
    let thumbUrl = null;
    if (thumbBase64) {
      try {
        const tfile = bucket.file(`catalogHires/${ownerUid}/${itemId}_t.jpg`);
        await tfile.save(Buffer.from(thumbBase64, 'base64'), meta);
        await tfile.makePublic();
        thumbUrl = `https://storage.googleapis.com/${bucket.name}/${tfile.name}?v=${v}`;
      } catch (e) {
        console.warn('[Dusty] upload-catalog-photo: sin miniatura —', e.message);
      }
    }
    return { statusCode: 200, body: JSON.stringify({ ok: true, url, thumbUrl }) };
  } catch (e) {
    console.error('[Dusty] upload-catalog-photo:', e.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'No se pudo subir la foto en alta — se usará la normal' }) };
  }
};
