// netlify/functions/enhance-photo.js
//
// CÁMARA PRO — "Mejorar con IA": súper-resolución con Real-ESRGAN vía Replicate
// (~$0.0025/imagen): reconstruye detalle y limpia ruido/desenfoque, el salto de
// calidad que una foto de celular apurada no trae de fábrica. Mismo esquema de
// dos pasos start/status que remove-bg.js (timeout de 10s de Netlify) y misma
// llave REPLICATE_API_TOKEN. Cobra 1 escaneo del cupo por mejora.
//
// El cliente manda la foto capada a ~800px: la IA la devuelve al DOBLE (1600px)
// — suficiente para la alta del catálogo — y un PNG de salida más grande que eso
// reventaría el límite de ~6MB de respuesta de la función al volver en base64.
// (Nombre sin sufijo "-background" — ver remove-bg.js.)
const {
  admin, getFirebaseApp, isAllowedOrigin, verifyCallerInfo, callerCanUseAccount,
  reserveScanQuota, refundScanUsage, checkIpRateLimit
} = require('./lib/patron-admin');

const DEFAULT_ESRGAN_VERSION = '42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b'; // nightmareai/real-esrgan
const MAX_IMG_B64 = 2000000; // ~1.5MB reales — un 800px va muy por debajo

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  }
  if (!isAllowedOrigin(event)) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Origen no permitido' }) };
  }
  if (!process.env.REPLICATE_API_TOKEN) {
    return { statusCode: 500, body: JSON.stringify({ error: 'La función Pro no está configurada todavía (falta REPLICATE_API_TOKEN en Netlify)', code: 'pro_not_configured' }) };
  }
  getFirebaseApp();
  const caller = await verifyCallerInfo(event);
  if (!caller) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Sesión inválida — volvé a entrar', code: 'bad_token' }) };
  }
  if (caller.isAnonymous) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Mejorar con IA necesita una cuenta guardada', code: 'needs_account' }) };
  }
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Body inválido' }) };
  }
  const ownerUid = (typeof body.ownerUid === 'string' && body.ownerUid) ? body.ownerUid.slice(0, 128) : caller.uid;
  if (!(await callerCanUseAccount(caller.uid, ownerUid))) {
    return { statusCode: 403, body: JSON.stringify({ error: 'No tenés acceso a esa cuenta' }) };
  }

  const rHeaders = {
    'Authorization': 'Bearer ' + process.env.REPLICATE_API_TOKEN,
    'Content-Type': 'application/json'
  };

  if (body.action === 'status') {
    const id = String(body.id || '').slice(0, 64);
    if (!/^[A-Za-z0-9]+$/.test(id)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Predicción inválida' }) };
    }
    try {
      const res = await fetch('https://api.replicate.com/v1/predictions/' + id, { headers: rHeaders });
      const pred = await res.json();
      if (!res.ok) throw new Error(pred.detail || ('HTTP ' + res.status));
      if (pred.status === 'succeeded') {
        const url = Array.isArray(pred.output) ? pred.output[0] : pred.output;
        if (!url || typeof url !== 'string') throw new Error('sin salida');
        const imgRes = await fetch(url);
        if (!imgRes.ok) throw new Error('descarga HTTP ' + imgRes.status);
        const buf = Buffer.from(await imgRes.arrayBuffer());
        return { statusCode: 200, body: JSON.stringify({ status: 'succeeded', imageBase64: buf.toString('base64'), mediaType: 'image/png' }) };
      }
      if (pred.status === 'failed' || pred.status === 'canceled') {
        return { statusCode: 200, body: JSON.stringify({ status: 'failed', error: String(pred.error || 'La IA no pudo mejorar esta foto') }) };
      }
      return { statusCode: 200, body: JSON.stringify({ status: 'processing' }) };
    } catch (e) {
      console.error('[Dusty] enhance-photo status:', e.message);
      return { statusCode: 500, body: JSON.stringify({ error: 'No se pudo consultar el proceso — probá de nuevo' }) };
    }
  }

  // action: "start"
  const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64 : '';
  if (!imageBase64 || imageBase64.length > MAX_IMG_B64) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Falta la imagen (o es demasiado grande)' }) };
  }
  const mediaType = (typeof body.mediaType === 'string' && /^image\/(jpeg|png|webp)$/.test(body.mediaType)) ? body.mediaType : 'image/jpeg';

  if (!(await checkIpRateLimit(event))) {
    return { statusCode: 429, body: JSON.stringify({ error: 'Demasiados pedidos seguidos desde esta conexión — esperá un rato', code: 'rate_limited' }) };
  }
  let reservation;
  try {
    reservation = await reserveScanQuota(ownerUid, caller);
    if (!reservation.allowed) {
      return { statusCode: 429, body: JSON.stringify({ error: 'Llegaste al límite de escaneos de tu plan este mes', quotaExceeded: true }) };
    }
  } catch (e) {
    console.error('[Dusty] enhance-photo cupo:', e);
    return { statusCode: 500, body: JSON.stringify({ error: 'No se pudo verificar tu cupo, intentá de nuevo', code: 'quota_check_failed' }) };
  }

  try {
    const version = process.env.REPLICATE_ESRGAN_VERSION || DEFAULT_ESRGAN_VERSION;
    const res = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: rHeaders,
      body: JSON.stringify({
        version,
        input: { image: 'data:' + mediaType + ';base64,' + imageBase64, scale: 2, face_enhance: false }
      })
    });
    const pred = await res.json();
    if (!res.ok || !pred.id) {
      console.error('[Dusty] enhance-photo start:', res.status, JSON.stringify(pred).slice(0, 300));
      await refundScanUsage(ownerUid, 1, reservation.period);
      return { statusCode: 502, body: JSON.stringify({ error: 'El servicio de mejora no respondió — revisá el token/modelo de Replicate', code: 'esrgan_start_failed' }) };
    }
    return { statusCode: 200, body: JSON.stringify({ id: pred.id, status: pred.status || 'starting' }) };
  } catch (e) {
    console.error('[Dusty] enhance-photo start:', e.message);
    await refundScanUsage(ownerUid, 1, reservation.period);
    return { statusCode: 500, body: JSON.stringify({ error: 'No se pudo arrancar el proceso — probá de nuevo' }) };
  }
};
