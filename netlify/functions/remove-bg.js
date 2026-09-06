// netlify/functions/remove-bg.js
//
// OJO CON EL NOMBRE: Netlify trata a toda función terminada en "-background"
// como función de segundo plano (devuelve 202 vacío y corre async, sin
// respuesta) — por eso este archivo NO puede llamarse remove-background.js
// (así se llamó primero y el 202 mudo se llevó una hora de depuración).
//
// CÁMARA PRO: quita el fondo de una foto de producto (segmentación con IA vía
// Replicate) — el cliente después la compone sobre el fondo que elija (blanco
// de tienda, crema, gris...). Dos pasos porque el modelo puede tardar más que
// el timeout de una función de Netlify (~10s) con arranque en frío:
//   action:"start"  → crea la predicción y devuelve {id} (acá se cobra el cupo)
//   action:"status" → consulta; al terminar baja el PNG y lo devuelve en base64
//
// Necesita en Netlify la variable REPLICATE_API_TOKEN (cuenta de Replicate del
// dueño de Dusty — pago por uso, centavos por imagen). El modelo por defecto es
// cjwbw/rembg (u2net, licencia permisiva, apto comercial); se puede pinnear otro
// con REPLICATE_REMBG_VERSION sin tocar código.
//
// Cupo: cada quitado de fondo reserva 1 escaneo del MISMO cupo mensual que las
// demás llamadas de IA (reserveScanQuota) — la palanca natural del plan Pro.
const {
  admin, getFirebaseApp, isAllowedOrigin, verifyCallerInfo, callerCanUseAccount,
  reserveScanQuota, refundScanUsage, checkIpRateLimit
} = require('./lib/patron-admin');

const DEFAULT_REMBG_VERSION = 'fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003'; // cjwbw/rembg u2net
const MAX_IMG_B64 = 7000000; // mismo tope por imagen que los otros escáneres

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
  // Sin trial anónimo: es la función Pro y consume dinero real por imagen.
  if (caller.isAnonymous) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Quitar fondo necesita una cuenta guardada', code: 'needs_account' }) };
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
        // El PNG se baja ACÁ (server-side): replicate.delivery no promete CORS
        // para el navegador, y así el cliente recibe base64 listo para el canvas.
        const imgRes = await fetch(url);
        if (!imgRes.ok) throw new Error('descarga HTTP ' + imgRes.status);
        const buf = Buffer.from(await imgRes.arrayBuffer());
        return { statusCode: 200, body: JSON.stringify({ status: 'succeeded', imageBase64: buf.toString('base64'), mediaType: 'image/png' }) };
      }
      if (pred.status === 'failed' || pred.status === 'canceled') {
        return { statusCode: 200, body: JSON.stringify({ status: 'failed', error: String(pred.error || 'La IA no pudo procesar esta foto') }) };
      }
      return { statusCode: 200, body: JSON.stringify({ status: 'processing' }) };
    } catch (e) {
      console.error('[Dusty] remove-background status:', e.message);
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
  // Reserva ANTES de gastar dinero en Replicate — mismo criterio que los escáneres.
  let reservation;
  try {
    reservation = await reserveScanQuota(ownerUid, caller);
    if (!reservation.allowed) {
      return { statusCode: 429, body: JSON.stringify({ error: 'Llegaste al límite de escaneos de tu plan este mes', quotaExceeded: true }) };
    }
  } catch (e) {
    console.error('[Dusty] remove-background cupo:', e);
    return { statusCode: 500, body: JSON.stringify({ error: 'No se pudo verificar tu cupo, intentá de nuevo', code: 'quota_check_failed' }) };
  }

  try {
    const version = process.env.REPLICATE_REMBG_VERSION || DEFAULT_REMBG_VERSION;
    const res = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: rHeaders,
      body: JSON.stringify({
        version,
        input: { image: 'data:' + mediaType + ';base64,' + imageBase64 }
      })
    });
    const pred = await res.json();
    if (!res.ok || !pred.id) {
      console.error('[Dusty] remove-background start:', res.status, JSON.stringify(pred).slice(0, 300));
      // La predicción nunca arrancó: la unidad reservada se devuelve (mismo
      // criterio que los escáneres con fallos de red).
      await refundScanUsage(ownerUid, 1, reservation.period);
      return { statusCode: 502, body: JSON.stringify({ error: 'El servicio de quitar fondo no respondió — revisá el token/modelo de Replicate', code: 'rembg_start_failed' }) };
    }
    return { statusCode: 200, body: JSON.stringify({ id: pred.id, status: pred.status || 'starting' }) };
  } catch (e) {
    console.error('[Dusty] remove-background start:', e.message);
    await refundScanUsage(ownerUid, 1, reservation.period);
    return { statusCode: 500, body: JSON.stringify({ error: 'No se pudo arrancar el proceso — probá de nuevo' }) };
  }
};
