// netlify/functions/exit-feedback.js
//
// La DESPEDIDA (openGoodbye en app-06): la cuenta ya no existe y no hay sesión,
// pero la persona quiere contar por qué se fue a cambio del mes de regalo. Sin
// token no hay a quién creerle, así que esta función:
//   - solo acepta pedidos desde el sitio/app (isAllowedOrigin), con el mismo
//     freno por IP que los escaneos (checkIpRateLimit), y campos acotados;
//   - guarda el motivo en exitFeedback/ (el dueño lo lee en la consola o por el
//     canal de avisos que se defina), y
//   - deja la oferta en retentionOffers/{sha256(email)}: si esa persona vuelve
//     a crear cuenta con el mismo email, getAccessState (patron-admin) le suma
//     RETENTION_DAYS al mes gratis, una sola vez.
// Las dos colecciones son solo del Admin SDK: no tienen regla en firestore.rules,
// así que ningún cliente puede leerlas ni escribirlas por su cuenta.
const {
  admin, getFirebaseApp, isAllowedOrigin, withCors, checkIpRateLimit, retentionKey, RETENTION_DAYS
} = require('./lib/patron-admin');

const MOTIVOS = ['use', 'scan', 'missing', 'hard', 'price', 'other'];

exports.handler = withCors(async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  }
  if (!isAllowedOrigin(event)) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Origen no permitido' }) };
  }
  let parsed;
  try { parsed = JSON.parse(event.body || '{}'); } catch (e) { parsed = null; }
  if (!parsed) return { statusCode: 400, body: JSON.stringify({ error: 'Body inválido', code: 'bad_request' }) };
  const email = typeof parsed.email === 'string' ? parsed.email.trim().toLowerCase().slice(0, 200) : '';
  const reason = MOTIVOS.includes(parsed.reason) ? parsed.reason : 'other';
  const text = typeof parsed.text === 'string' ? parsed.text.trim().slice(0, 600) : '';
  const lang = parsed.lang === 'es' ? 'es' : 'en';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Email inválido', code: 'bad_request' }) };
  }
  try {
    if (!(await checkIpRateLimit(event))) {
      return { statusCode: 429, body: JSON.stringify({ error: 'Demasiados envíos seguidos', code: 'rate_limited' }) };
    }
    getFirebaseApp();
    const db = admin.firestore();
    const now = Date.now();
    await db.collection('exitFeedback').add({ email, reason, text, lang, at: now, createdAt: new Date(now).toISOString() });
    // merge: si ya tenía una oferta canjeada (claimedBy), no se resetea — una
    // oferta por persona, no una por cada cuenta que borre.
    await db.doc(`retentionOffers/${retentionKey(email)}`).set({ email, reason, lang, at: now, freeDays: RETENTION_DAYS }, { merge: true });
    return { statusCode: 200, body: JSON.stringify({ ok: true, freeDays: RETENTION_DAYS }) };
  } catch (err) {
    console.error('[Dusty] exit-feedback failed:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'No se pudo guardar tu respuesta', code: 'feedback_failed' }) };
  }
});
