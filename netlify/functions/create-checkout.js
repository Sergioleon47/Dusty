// netlify/functions/create-checkout.js
//
// Abre una sesión de pago de Stripe Checkout (página alojada por Stripe) para
// suscribir la cuenta del que llama. Dusty nunca ve la tarjeta: el usuario la
// escribe en la página de Stripe, y el resultado vuelve por stripe-webhook.js.
// Reglas:
//   - Solo cuentas REALES (email): una anónima primero tiene que guardarse
//     (paso 1 de la página de suscripción) — si no, el uid al que se le cobra
//     podría perderse con una reinstalación.
//   - Solo el DUEÑO paga su cuenta: un miembro de equipo no puede suscribir la
//     cuenta de otro (ownerUid del body tiene que ser el propio uid).
//   - Sin STRIPE_* configuradas contesta billing_not_configured: la página de
//     suscripción existe antes que la cuenta de Stripe (ver DUSTY_BILLING_ENABLED).
// Devuelve {url}: el cliente navega ahí; success_url/cancel_url vuelven a la
// app con ?billing=ok|cancel (ver el arranque en app-07).
const {
  isAllowedOrigin, verifyCallerInfo, withCors, admin, getFirebaseApp,
  stripeConfigured, stripeRequest, ALLOWED_ORIGIN_PATTERNS
} = require('./lib/patron-admin');

const APP_ORIGIN = 'https://patronsc.netlify.app';

exports.handler = withCors(async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  }
  if (!isAllowedOrigin(event)) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Origen no permitido' }) };
  }
  if (!stripeConfigured()) {
    return { statusCode: 503, body: JSON.stringify({ error: 'El pago todavía no está habilitado', code: 'billing_not_configured' }) };
  }
  const caller = await verifyCallerInfo(event);
  if (!caller) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Inicia sesión de nuevo', code: 'auth_required' }) };
  }
  if (caller.isAnonymous || !caller.email) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Guarda tu cuenta antes de suscribirte', code: 'account_required' }) };
  }
  let plan = 'month', lang = 'en', ownerUid = caller.uid;
  try {
    const parsed = JSON.parse(event.body || '{}');
    if (parsed.plan === 'year') plan = 'year';
    if (parsed.lang === 'es') lang = 'es';
    if (typeof parsed.ownerUid === 'string' && parsed.ownerUid) ownerUid = parsed.ownerUid;
  } catch (e) { /* defaults */ }
  if (ownerUid !== caller.uid) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Solo el dueño de la cuenta puede suscribirla', code: 'owner_only' }) };
  }
  // A dónde vuelve después de pagar: al mismo origen desde el que abrió (una
  // vista previa de Netlify vuelve a la vista previa); la app instalada
  // (https://localhost / capacitor://) no es una URL a la que Stripe pueda
  // volver, así que va a la web publicada.
  const origin = (event.headers.origin || event.headers.Origin || '').replace(/\/$/, '');
  const back = /^https:\/\/([a-z0-9-]+\.)?patronsc\.netlify\.app$/i.test(origin) && ALLOWED_ORIGIN_PATTERNS.some(re => re.test(origin)) ? origin : APP_ORIGIN;
  try {
    getFirebaseApp();
    // Si ya fue cliente de Stripe (renovó, canceló y vuelve), se reusa el
    // customer: un solo historial en Stripe por cuenta de Dusty.
    let customerId = null;
    try {
      const bill = await admin.firestore().doc(`users/${ownerUid}/meta/billing`).get();
      const sub = bill.exists && bill.data().subscription;
      if (sub && typeof sub.customerId === 'string') customerId = sub.customerId;
    } catch (e) { customerId = null; }
    const params = {
      mode: 'subscription',
      line_items: { 0: { price: plan === 'year' ? process.env.STRIPE_PRICE_YEAR : process.env.STRIPE_PRICE_MONTH, quantity: 1 } },
      client_reference_id: ownerUid,
      success_url: back + '/?billing=ok',
      cancel_url: back + '/?billing=cancel',
      locale: lang,
      allow_promotion_codes: 'true',
      metadata: { ownerUid },
      subscription_data: { metadata: { ownerUid } }
    };
    if (customerId) params.customer = customerId; else params.customer_email = caller.email;
    const session = await stripeRequest('POST', '/checkout/sessions', params);
    if (!session || !session.url) throw new Error('Stripe no devolvió la URL de pago');
    return { statusCode: 200, body: JSON.stringify({ url: session.url }) };
  } catch (err) {
    console.error('[Dusty] create-checkout failed:', err);
    return { statusCode: 502, body: JSON.stringify({ error: 'No se pudo abrir la página de pago, intenta de nuevo', code: 'checkout_failed' }) };
  }
});
