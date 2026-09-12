// netlify/functions/send-quote.js
//
// Manda por CORREO una cotización con el PDF adjunto (2026-09-11: "guardar los
// correos de los clientes para que se puedan enviar automáticamente"). La app
// arma el PDF en el teléfono (app-17) y lo manda acá en base64; esta función lo
// entrega por Resend (https://resend.com), el proveedor más simple de configurar:
// una sola variable de entorno en Netlify. Sin RESEND_API_KEY responde 503 con
// código 'email_not_configured' y la app abre la app de correo del teléfono.
//
// Variables de entorno (Netlify → Site settings → Environment variables):
//   RESEND_API_KEY   obligatoria — la clave de Resend.
//   QUOTE_FROM       remitente verificado en Resend, ej. "Dusty <cotizaciones@tudominio.com>".
//                    Sin dominio propio sirve "onboarding@resend.dev" (solo para probar).
//
// Misma protección que el resto de las funciones: origen permitido, sesión
// verificada, acceso a la cuenta, candado de suscripción y límite por IP.
//
// NO es un relé de correo abierto (auditoría de la auditoría 2026-09-12: con una
// sesión anónima y este endpoint se podía mandar phishing con adjunto arbitrario
// a cualquier dirección desde el dominio verificado en Resend):
//   - el trial anónimo no manda correos;
//   - el destino tiene que ser el correo de un CLIENTE GUARDADO de esa cuenta
//     (bizProfile.clients del doc de meta, leído con el Admin SDK — la app ya
//     lo manda desde ahí);
//   - el adjunto tiene que ser un PDF de verdad (%PDF-) y llamarse .pdf;
//   - cupo por cuenta y por día (SEND_QUOTE_PER_DAY) además del tope por IP.
const {
  isAllowedOrigin, verifyCallerInfo, callerCanUseAccount, checkIpRateLimit, getAccessState,
  subscriptionRequiredResponse, withCors
} = require('./lib/patron-admin');
const admin = require('firebase-admin');

const MAX_PDF_BASE64 = 4 * 1024 * 1024; // ~3 MB de PDF; una cotización pesa unos KB
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SEND_QUOTE_PER_DAY = 40; // cotizaciones por correo por cuenta y día

// ¿"to" es el correo de un cliente guardado de la cuenta? Se lee el doc de meta
// del dueño con el Admin SDK (las reglas no aplican al servidor).
async function isSavedClientEmail(ownerUid, to) {
  const snap = await admin.firestore().doc(`users/${ownerUid}/meta/settings`).get();
  const clients = snap.exists && snap.data().bizProfile && Array.isArray(snap.data().bizProfile.clients) ? snap.data().bizProfile.clients : [];
  return clients.some(c => c && typeof c.email === 'string' && c.email.trim().toLowerCase() === to);
}
// Cupo diario por cuenta (documento por día, se limpia solo con expireAt como rateLimits).
async function reserveDailyQuota(ownerUid) {
  const db = admin.firestore();
  const day = new Date().toISOString().slice(0, 10);
  const ref = db.doc(`rateLimits/sendquote-${ownerUid}-${day}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const n = snap.exists ? (snap.data().n || 0) : 0;
    if (n >= SEND_QUOTE_PER_DAY) return false;
    tx.set(ref, { n: n + 1, expireAt: admin.firestore.Timestamp.fromMillis(Date.now() + 2 * 24 * 3600000) }, { merge: true });
    return true;
  });
}

function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

exports.handler = withCors(async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  if (!isAllowedOrigin(event)) return { statusCode: 403, body: JSON.stringify({ error: 'Origen no permitido' }) };

  const caller = await verifyCallerInfo(event);
  if (!caller) return { statusCode: 401, body: JSON.stringify({ error: 'Iniciá sesión para mandar correos', code: 'auth_required' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return { statusCode: 400, body: JSON.stringify({ error: 'Body inválido', code: 'bad_request' }) }; }
  const ownerUid = typeof body.ownerUid === 'string' && body.ownerUid ? body.ownerUid : caller.uid;
  const to = String(body.to || '').trim().toLowerCase();
  const subject = String(body.subject || '').trim().slice(0, 150);
  const text = String(body.text || '').trim().slice(0, 4000);
  const pdfBase64 = typeof body.pdfBase64 === 'string' ? body.pdfBase64 : '';
  let fileName = String(body.fileName || 'cotizacion.pdf').replace(/[^\w.\- ]+/g, '').slice(0, 80) || 'cotizacion.pdf';
  if (!/\.pdf$/i.test(fileName)) fileName = fileName.replace(/\.[^.]*$/, '') + '.pdf';
  const lang = body.lang === 'es' ? 'es' : 'en';
  // El trial anónimo no manda correos: una sesión anónima se crea sin credenciales.
  if (caller.isAnonymous) return { statusCode: 403, body: JSON.stringify({ error: lang === 'es' ? 'Creá tu cuenta para mandar cotizaciones por correo.' : 'Create your account to email quotes.', code: 'auth_required' }) };
  if (!EMAIL_RE.test(to)) return { statusCode: 400, body: JSON.stringify({ error: lang === 'es' ? 'El correo del cliente no es válido' : 'The client email is not valid', code: 'bad_email' }) };
  if (!subject || !text) return { statusCode: 400, body: JSON.stringify({ error: 'Falta asunto o texto', code: 'bad_request' }) };
  if (!pdfBase64 || pdfBase64.length > MAX_PDF_BASE64 || !/^[A-Za-z0-9+/=]+$/.test(pdfBase64)) return { statusCode: 400, body: JSON.stringify({ error: 'PDF inválido', code: 'bad_pdf' }) };
  // Un PDF de verdad empieza con "%PDF-" (en base64: JVBERi0).
  if (!pdfBase64.startsWith('JVBERi0')) return { statusCode: 400, body: JSON.stringify({ error: 'PDF inválido', code: 'bad_pdf' }) };

  try {
    if (!(await callerCanUseAccount(caller.uid, ownerUid))) return { statusCode: 403, body: JSON.stringify({ error: 'No tienes acceso a esa cuenta', code: 'no_access' }) };
    if ((await getAccessState(ownerUid, caller)).locked) return subscriptionRequiredResponse();
    if (!(await isSavedClientEmail(ownerUid, to))) return { statusCode: 403, body: JSON.stringify({ error: lang === 'es' ? 'Ese correo no es de un cliente guardado. Guardalo en la ficha del cliente y volvé a mandar.' : 'That email is not a saved client. Save it on the client card and send again.', code: 'not_a_client' }) };
    if (!(await checkIpRateLimit(event))) return { statusCode: 429, body: JSON.stringify({ error: 'Demasiados envíos seguidos — espera un rato', code: 'rate_limited' }) };
    if (!(await reserveDailyQuota(ownerUid))) return { statusCode: 429, body: JSON.stringify({ error: lang === 'es' ? 'Llegaste al máximo de cotizaciones por correo de hoy.' : 'You reached today\'s limit of emailed quotes.', code: 'rate_limited' }) };
  } catch (e) {
    console.error('[Dusty] send-quote: error verificando acceso:', e);
    return { statusCode: 500, body: JSON.stringify({ error: 'No se pudo verificar tu cuenta, intenta de nuevo', code: 'access_check_failed' }) };
  }

  if (!process.env.RESEND_API_KEY) {
    return { statusCode: 503, body: JSON.stringify({ error: lang === 'es' ? 'El envío por correo no está configurado todavía en el servidor.' : 'Email sending is not configured on the server yet.', code: 'email_not_configured' }) };
  }
  const from = process.env.QUOTE_FROM || 'Dusty <onboarding@resend.dev>';
  const businessName = String(body.businessName || '').trim().slice(0, 60);
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1c1e21;">${esc(text).replace(/\n/g, '<br>')}</div>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY },
      body: JSON.stringify({
        from: businessName ? `${businessName.replace(/[<>"]/g, '')} <${from.replace(/^.*<([^>]+)>.*$/, '$1')}>` : from,
        to: [to],
        subject,
        text,
        html,
        attachments: [{ filename: fileName, content: pdfBase64 }]
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('[Dusty] send-quote: Resend respondió', res.status, data);
      return { statusCode: 502, body: JSON.stringify({ error: lang === 'es' ? 'El proveedor de correo rechazó el envío.' : 'The email provider rejected the message.', code: 'email_rejected', detail: data && data.message ? String(data.message).slice(0, 200) : null }) };
    }
    return { statusCode: 200, body: JSON.stringify({ ok: true, id: data.id || null, to }) };
  } catch (err) {
    console.error('[Dusty] send-quote: fallo de red:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Error interno', code: 'internal' }) };
  }
});
