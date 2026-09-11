// netlify/functions/access-state.js
//
// "¿Esta cuenta puede seguir usando Dusty?" — la respuesta que manda el
// servidor y que el cliente NO puede fabricar. La app la pide al arrancar cada
// sesión (fetchAccessState en app-02) y cuando vuelve de pagar. Devuelve:
//   billingEnabled  el interruptor DUSTY_BILLING_ENABLED (apagado = todo abierto)
//   locked          vencido el mes y sin suscripción vigente → solo lectura
//   trialEndsAt     cuándo vence / venció el mes gratis (ms)
//   subscription    {status, plan, currentPeriodEnd, cancelAtPeriodEnd} o null
//   unlimited       cuenta con pase (dueño)
// Además deja en users/{uid}/meta/billing los campos que firestore.rules usa
// para cerrar las ESCRITURAS de una cuenta vencida (ver getAccessState).
// Un miembro de equipo pregunta por la cuenta del dueño (ownerUid): el candado
// es de la cuenta, no de quien la usa.
const { isAllowedOrigin, verifyCallerInfo, callerCanUseAccount, getAccessState, withCors } = require('./lib/patron-admin');

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
  let ownerUid = caller.uid;
  try {
    const parsed = JSON.parse(event.body || '{}');
    if (typeof parsed.ownerUid === 'string' && parsed.ownerUid) ownerUid = parsed.ownerUid;
  } catch (e) { /* body vacío: la propia cuenta */ }
  try {
    if (!(await callerCanUseAccount(caller.uid, ownerUid))) {
      return { statusCode: 403, body: JSON.stringify({ error: 'No tienes acceso a esa cuenta', code: 'no_access' }) };
    }
    const state = await getAccessState(ownerUid, caller);
    return { statusCode: 200, body: JSON.stringify(state) };
  } catch (err) {
    console.error('[Dusty] access-state failed:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'No se pudo verificar el estado de la cuenta', code: 'access_check_failed' }) };
  }
});
