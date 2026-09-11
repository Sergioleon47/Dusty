// netlify/functions/stripe-webhook.js
//
// A esta función la llama STRIPE, no la app: cada vez que una suscripción se
// crea, se renueva, se atrasa o se cancela, Stripe manda el evento acá y esta
// función lo escribe en users/{ownerUid}/meta/billing.subscription (campo que
// solo el Admin SDK puede tocar — ver firestore.rules). La app lo ve llegar en
// vivo por su listener de billing y se destraba sola (ver app-02).
//
// Sin withCors ni chequeo de Origin a propósito: el que llama es Stripe desde
// sus servidores. La autenticidad la da la FIRMA (cabecera Stripe-Signature,
// HMAC-SHA256 con STRIPE_WEBHOOK_SECRET sobre "t.cuerpo") — un pedido sin firma
// válida se rechaza con 400 y no toca nada. Se verifica a mano con crypto (sin
// SDK, igual que el resto de Stripe acá) y con tolerancia de 5 minutos contra
// re-envíos viejos.
//
// Alta en el panel de Stripe: Developers → Webhooks → endpoint
// https://patronsc.netlify.app/.netlify/functions/stripe-webhook con los eventos
// checkout.session.completed, customer.subscription.updated y
// customer.subscription.deleted; el "signing secret" que da ahí va a
// STRIPE_WEBHOOK_SECRET en Netlify.
const crypto = require('crypto');
const { stripeRequest, subscriptionRecord, saveSubscription } = require('./lib/patron-admin');

function verifyStripeSignature(rawBody, header, secret) {
  if (!header || !secret) return false;
  const parts = {};
  header.split(',').forEach(p => { const i = p.indexOf('='); if (i > 0) parts[p.slice(0, i).trim()] = p.slice(i + 1).trim(); });
  const t = parseInt(parts.t, 10), v1 = parts.v1;
  if (!Number.isFinite(t) || !v1) return false;
  if (Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`, 'utf8').digest('hex');
  const a = Buffer.from(expected, 'utf8'), b = Buffer.from(v1, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Método no permitido' };
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.STRIPE_SECRET_KEY) {
    return { statusCode: 503, body: 'Stripe no configurado' };
  }
  // Netlify entrega el cuerpo tal cual (o en base64 si lo marcó así): la firma
  // se calcula sobre los bytes EXACTOS que mandó Stripe, sin re-serializar.
  const rawBody = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
  const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  if (!verifyStripeSignature(rawBody, sig, secret)) {
    return { statusCode: 400, body: 'Firma inválida' };
  }
  let evt;
  try { evt = JSON.parse(rawBody); } catch (e) { return { statusCode: 400, body: 'JSON inválido' }; }
  const obj = evt && evt.data && evt.data.object;
  try {
    if (evt.type === 'checkout.session.completed' && obj && obj.mode === 'subscription' && obj.subscription) {
      const ownerUid = (obj.metadata && obj.metadata.ownerUid) || obj.client_reference_id;
      if (ownerUid) {
        // La sesión trae solo el id: se pide la suscripción entera (estado,
        // fin de período, precio) para escribirla completa desde el primer día.
        const sub = await stripeRequest('GET', '/subscriptions/' + encodeURIComponent(obj.subscription));
        await saveSubscription(ownerUid, subscriptionRecord(sub));
      }
    } else if ((evt.type === 'customer.subscription.updated' || evt.type === 'customer.subscription.deleted' || evt.type === 'customer.subscription.created') && obj) {
      const ownerUid = obj.metadata && obj.metadata.ownerUid;
      if (ownerUid) await saveSubscription(ownerUid, subscriptionRecord(obj));
      else console.warn('[Dusty] stripe-webhook: suscripción sin ownerUid en metadata:', obj.id);
    }
    // Cualquier otro evento: 200 igual, para que Stripe no lo reintente.
    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (err) {
    // 500 → Stripe reintenta más tarde (con backoff), que es lo que queremos si
    // Firestore o la API de Stripe fallaron un instante.
    console.error('[Dusty] stripe-webhook failed:', evt && evt.type, err);
    return { statusCode: 500, body: 'Error procesando el evento' };
  }
};
