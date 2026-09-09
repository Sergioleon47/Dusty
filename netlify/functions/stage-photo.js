// netlify/functions/stage-photo.js
//
// CÁMARA PRO — "Escenario IA" (idea del usuario 2026-09-06: los vendedores usan
// maniquíes y fondos físicos; esto es el estudio virtual): FLUX Kontext recibe la
// foto del producto y una instrucción ("sobre una mesa rústica de madera...") y
// genera el ambiente alrededor, con luz y sombras coherentes. Modelo OFICIAL de
// Replicate — se llama por nombre (sin hash de versión), override con
// REPLICATE_KONTEXT_MODEL. Mismo esquema start/status y misma llave que
// remove-bg/enhance-photo; cobra 1 escaneo del cupo (~$0.04 de costo real).
// (Nombre sin sufijo "-background" — ver remove-bg.js.)
const {
  admin, getFirebaseApp, isAllowedOrigin, verifyCallerInfo, callerCanUseAccount,
  reserveScanQuota, refundScanUsage, checkIpRateLimit
} = require('./lib/patron-admin');

const DEFAULT_KONTEXT_MODEL = 'black-forest-labs/flux-kontext-pro';
const MAX_IMG_B64 = 3500000;
const MAX_PROMPT = 600;

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
    return { statusCode: 401, body: JSON.stringify({ error: 'Sesión inválida — vuelve a entrar', code: 'bad_token' }) };
  }
  if (caller.isAnonymous) {
    return { statusCode: 403, body: JSON.stringify({ error: 'El escenario IA necesita una cuenta guardada', code: 'needs_account' }) };
  }
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Body inválido' }) };
  }
  const ownerUid = (typeof body.ownerUid === 'string' && body.ownerUid) ? body.ownerUid.slice(0, 128) : caller.uid;
  if (!(await callerCanUseAccount(caller.uid, ownerUid))) {
    return { statusCode: 403, body: JSON.stringify({ error: 'No tienes acceso a esa cuenta' }) };
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
        const mt = String(imgRes.headers.get('content-type') || 'image/jpeg').split(';')[0];
        return { statusCode: 200, body: JSON.stringify({ status: 'succeeded', imageBase64: buf.toString('base64'), mediaType: /^image\//.test(mt) ? mt : 'image/jpeg' }) };
      }
      if (pred.status === 'failed' || pred.status === 'canceled') {
        return { statusCode: 200, body: JSON.stringify({ status: 'failed', error: String(pred.error || 'La IA no pudo generar el escenario') }) };
      }
      return { statusCode: 200, body: JSON.stringify({ status: 'processing' }) };
    } catch (e) {
      console.error('[Dusty] stage-photo status:', e.message);
      return { statusCode: 500, body: JSON.stringify({ error: 'No se pudo consultar el proceso — prueba de nuevo' }) };
    }
  }

  // action: "start"
  const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64 : '';
  if (!imageBase64 || imageBase64.length > MAX_IMG_B64) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Falta la imagen (o es demasiado grande)' }) };
  }
  const mediaType = (typeof body.mediaType === 'string' && /^image\/(jpeg|png|webp)$/.test(body.mediaType)) ? body.mediaType : 'image/jpeg';
  const prompt = String(body.prompt || '').slice(0, MAX_PROMPT).trim();
  if (!prompt) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Falta el escenario' }) };
  }

  if (!(await checkIpRateLimit(event))) {
    return { statusCode: 429, body: JSON.stringify({ error: 'Demasiados pedidos seguidos desde esta conexión — espera un rato', code: 'rate_limited' }) };
  }
  let reservation;
  try {
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
    console.error('[Dusty] stage-photo cupo:', e);
    return { statusCode: 500, body: JSON.stringify({ error: 'No se pudo verificar tu cupo, intenta de nuevo', code: 'quota_check_failed' }) };
  }

  try {
    const model = process.env.REPLICATE_KONTEXT_MODEL || DEFAULT_KONTEXT_MODEL;
    const res = await fetch('https://api.replicate.com/v1/models/' + model + '/predictions', {
      method: 'POST',
      headers: rHeaders,
      body: JSON.stringify({
        input: {
          prompt,
          input_image: 'data:' + mediaType + ';base64,' + imageBase64,
          aspect_ratio: 'match_input_image',
          output_format: 'jpg',
          safety_tolerance: 2
        }
      })
    });
    const pred = await res.json();
    if (!res.ok || !pred.id) {
      console.error('[Dusty] stage-photo start:', res.status, JSON.stringify(pred).slice(0, 300));
      await refundScanUsage(ownerUid, 1, reservation.period);
      return { statusCode: 502, body: JSON.stringify({ error: 'El servicio de escenarios no respondió — revisa el token/modelo de Replicate', code: 'stage_start_failed' }) };
    }
    return { statusCode: 200, body: JSON.stringify({ id: pred.id, status: pred.status || 'starting' }) };
  } catch (e) {
    console.error('[Dusty] stage-photo start:', e.message);
    await refundScanUsage(ownerUid, 1, reservation.period);
    return { statusCode: 500, body: JSON.stringify({ error: 'No se pudo arrancar el proceso — prueba de nuevo' }) };
  }
};
