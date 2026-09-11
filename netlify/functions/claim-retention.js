// netlify/functions/claim-retention.js
//
// "Quédate un mes — gratis" (encuesta de salida, ANTES de borrar la cuenta):
// hasta el 2026-09-11 aceptar la oferta solo mostraba un toast; la promesa no
// se cumplía en ningún lado. Ahora suma RETENTION_DAYS al mes gratis de la
// cuenta (bonusMs en users/{uid}/meta/billing, que getAccessState lee), UNA
// sola vez por cuenta (retentionAccepted). Solo el dueño de la cuenta, con
// sesión real: el uid sale del token, nunca del body.
const {
  admin, getFirebaseApp, isAllowedOrigin, verifyCallerInfo, withCors, getAccessState, RETENTION_DAYS, DIA_MS
} = require('./lib/patron-admin');

exports.handler = withCors(async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  }
  if (!isAllowedOrigin(event)) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Origen no permitido' }) };
  }
  const caller = await verifyCallerInfo(event);
  if (!caller) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Inicia sesión de nuevo', code: 'auth_required' }) };
  }
  try {
    getFirebaseApp();
    const db = admin.firestore();
    const ref = db.doc(`users/${caller.uid}/meta/billing`);
    let granted = false;
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() : {};
      if (data.retentionAccepted) return;
      tx.set(ref, { bonusMs: (Number.isFinite(data.bonusMs) ? data.bonusMs : 0) + RETENTION_DAYS * DIA_MS, retentionAccepted: true, retentionAcceptedAt: Date.now() }, { merge: true });
      granted = true;
    });
    const state = await getAccessState(caller.uid, caller);
    return { statusCode: 200, body: JSON.stringify({ ok: true, granted, freeDays: RETENTION_DAYS, state }) };
  } catch (err) {
    console.error('[Dusty] claim-retention failed:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'No se pudo aplicar el mes gratis', code: 'retention_failed' }) };
  }
});
