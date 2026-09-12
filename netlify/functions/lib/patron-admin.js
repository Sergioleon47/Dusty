// netlify/functions/lib/patron-admin.js
//
// Piezas compartidas entre las Netlify Functions de Dusty que necesitan
// privilegios de administrador (Firebase Admin SDK) y verificar quién llama.
// Antes esto vivía duplicado adentro de extract-receipt.js; con delete-account.js
// sumándose, factorizarlo acá evita que las copias se desincronicen con el tiempo
// (por ejemplo, si cambia el allowlist de orígenes, hay que acordarse de tocarlo
// en un solo lugar, no en cada función por separado).
const admin = require('firebase-admin');

function getFirebaseApp() {
  if (admin.apps.length) return admin.apps[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('Falta configurar FIREBASE_SERVICE_ACCOUNT_KEY en Netlify');
  const serviceAccount = JSON.parse(raw);
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // Mismo bucket que storageBucket en el firebaseConfig del cliente (index.html).
    // Sin esto, admin.storage().bucket() (usado por delete-account.js para borrar
    // las fotos de recibos) no sabe a qué bucket apuntar y falla en tiempo de
    // ejecución — extract-receipt.js nunca lo necesitó porque nunca toca Storage,
    // pero queda acá para que cualquier función nueva que sí lo necesite "funcione
    // sola" sin tener que acordarse de este detalle cada vez.
    storageBucket: 'patron-inventory.firebasestorage.app'
  });
}

// Estas funciones son URLs públicas — cualquiera que las encuentre podría
// mandarles pedidos directo (sin pasar por la app). Como freno básico (no es
// seguridad perfecta, un ataque decidido puede falsificar el header Origin,
// pero corta el abuso casual/bots), solo se acepta si el pedido viene
// realmente del sitio de Dusty o de una vista previa/desarrollo local.
// La app publicada en Play Store / App Store entra por acá: Capacitor sirve los
// archivos desde https://localhost (Android) o capacitor://localhost (iOS), y
// ese es el Origin que manda. Sin estos dos patrones, escanear un recibo o
// identificar un producto se rechazaba SIEMPRE desde la app instalada
// (auditoría 2026-09-09). No abre la puerta a nadie: el freno de verdad sigue
// siendo el ID token de Firebase que se verifica abajo (verifyCallerInfo), más
// callerCanUseAccount y el límite por IP. El Origin es solo el freno casual, y
// de por sí ya era falsificable — por eso nunca fue la defensa principal.
const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/([a-z0-9-]+\.)?patronsc\.netlify\.app$/i,
  /^https:\/\/localhost$/i,
  /^capacitor:\/\/localhost$/i,
  /^http:\/\/localhost(:\d+)?$/i,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/i
];
/* CABECERAS CORS. En la web la app y las funciones comparten origen y el
   navegador no pide nada de esto. Desde la app instalada sí: el pedido sale de
   https://localhost (o capacitor://localhost) hacia patronsc.netlify.app, o sea
   cruza origen, y el navegador lo bloquea salvo que la respuesta lo autorice.
   Además, como lleva Content-Type y Authorization, antes del POST manda un
   OPTIONS de sondeo: sin atenderlo, el pedido de verdad nunca sale.
   Solo se responde con permiso a los orígenes de la lista de arriba; a
   cualquier otro no se le devuelve ninguna cabecera y el navegador lo corta,
   igual que antes (auditoría 2026-09-09). */
function corsHeaders(event) {
  const origin = (event.headers.origin || event.headers.Origin || '').replace(/\/$/, '');
  if (!origin || !ALLOWED_ORIGIN_PATTERNS.some(re => re.test(origin))) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}
/* Envuelve un handler para que TODAS sus respuestas lleven las cabeceras (son
   muchos returns y olvidarse en uno rompe justo el caso de error, que es cuando
   el usuario necesita ver el mensaje) y para atender el OPTIONS de sondeo. */
function withCors(handler) {
  return async (event, context) => {
    const cabeceras = corsHeaders(event);
    if ((event.httpMethod || '').toUpperCase() === 'OPTIONS') {
      return { statusCode: 204, headers: cabeceras, body: '' };
    }
    const res = await handler(event, context);
    return Object.assign({}, res, { headers: Object.assign({}, res && res.headers, cabeceras) });
  };
}
function isAllowedOrigin(event) {
  const origin = event.headers.origin || event.headers.Origin || '';
  const referer = event.headers.referer || event.headers.Referer || '';
  const check = (val) => ALLOWED_ORIGIN_PATTERNS.some(re => re.test(val.replace(/\/$/, '')));
  if (origin) return check(origin);
  if (referer) { try { return check(new URL(referer).origin); } catch (e) { return false; } }
  return false;
}

// Decodifica y verifica el ID token de Firebase que manda el navegador en el
// header "Authorization: Bearer <idToken>" — es la única forma real de saber
// quién pide algo, un uid suelto en el body lo podría escribir a mano cualquiera.
// Devuelve el uid si el token es válido, o null si no vino token o no es válido.
async function verifyCaller(event) {
  const info = await verifyCallerInfo(event);
  return info ? info.uid : null;
}

// Versión con detalle: además del uid dice si la sesión es ANÓNIMA (el trial sin
// registro que arranca el cliente con signInAnonymously) — el cupo de esas cuentas
// es chico y de por vida, no mensual (ver checkScanQuota). Se mira el token y no
// un flag del body porque el body lo escribe el cliente y cualquiera podría
// mentir "no soy trial"; el sign_in_provider del token lo firma Firebase.
async function verifyCallerInfo(event) {
  const header = event.headers.authorization || event.headers.Authorization || '';
  const idToken = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!idToken) return null;
  try {
    getFirebaseApp();
    const decoded = await admin.auth().verifyIdToken(idToken);
    return {
      uid: decoded.uid,
      isAnonymous: !!(decoded.firebase && decoded.firebase.sign_in_provider === 'anonymous'),
      // Cuenta "real" pero con email nunca verificado: crear una cuesta lo mismo
      // que una anónima (cero — cualquier email inventado sirve), así que su cupo
      // por defecto es más chico (ver reserveScanQuota). Firma del token, no body.
      emailVerified: !!decoded.email_verified,
      // Para la lista de cuentas sin límite (UNLIMITED_EMAILS, abajo). Sale de la
      // firma del token, no del body.
      email: typeof decoded.email === 'string' ? decoded.email.toLowerCase() : null
    };
  } catch (e) {
    return null;
  }
}

// CUPO POR PLAN: cualquier llamada que le pegue a Claude (leer un recibo, identificar
// un producto por foto, lo que sea) cuesta plata real, así que todas cuentan contra
// el MISMO cupo mensual — antes esto vivía solo en extract-receipt.js; con
// identify-product.js sumándose, separarlo acá evita que cada función lleve su
// propio contador (alguien podría agotar el cupo de recibos y seguir escaneando
// productos gratis por el resto del mes, que no es la intención del plan).
const PLAN_SCAN_LIMITS = { starter: 30, pro: 60, negocio: 120, equipo: 300 };
// Cuentas sin "plan" asignado a mano todavía en Firestore (no hay cobro real
// implementado aún) caen acá — un tope razonable en vez de ilimitado, para no
// dejar la puerta abierta mientras se decide/cobra el plan de cada quien.
const DEFAULT_SCAN_LIMIT = 60;
// Trial sin registro (cuenta anónima de Firebase): tope TOTAL de por vida, no
// mensual — la idea es probar la app, no vivir gratis rotando meses. Cuando la
// cuenta se convierte en real (email+PIN), el token deja de ser anónimo y pasa
// al cupo mensual normal de arriba, sin resetear nada.
const TRIAL_SCAN_LIMIT = 5;
// Cuenta con email SIN verificar y sin plan asignado: cupo mensual reducido.
// Crear una cuenta así es gratis e instantáneo con cualquier email inventado —
// con el cupo completo de 60, "una cuenta nueva por mes" era la forma barata de
// quemar la API de Claude a costa nuestra. La app todavía no tiene flujo de
// verificación de email: cuando lo tenga, verificar desbloquea el cupo completo.
const UNVERIFIED_SCAN_LIMIT = 15;
// Tope de llamadas de IA por IP por hora, cruzando TODAS las cuentas — es el freno
// real contra granjas de cuentas (anónimas o con emails inventados): las cuentas
// son gratis, las IPs no. Generoso para un negocio real (hasta un lote de recibos
// grande por hora), asfixiante para un script.
const IP_RATE_LIMIT_PER_HOUR = 30;
// PASE DEL DUEÑO (pedido del usuario 2026-09-08: "me dice que ya usé el límite,
// dame un pase para seguir probando"): cuentas que NO descuentan cupo — la del
// dueño de la app, para probar sin toparse con el tope del plan. Lista de
// correos separados por coma en la variable de entorno DUSTY_UNLIMITED_EMAILS
// de Netlify; sin la variable, queda el correo del dueño. Solo aplica a cuentas
// con email (no al trial anónimo) y el correo sale del token de Firebase, no
// del body. El tope por IP (arriba) sigue aplicando igual.
const UNLIMITED_EMAILS = String(process.env.DUSTY_UNLIMITED_EMAILS || 'sergioleon47@hotmail.com')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
function isUnlimitedCaller(caller) {
  return !!(caller && !caller.isAnonymous && caller.email && UNLIMITED_EMAILS.includes(caller.email));
}
/* EL PASE ES DE LA CUENTA, NO DE QUIEN LLAMA (reporte del usuario 2026-09-09:
   "a un usuario que le compartí mi cuenta no le permite escanear, le dice que
   topó el límite").
   isUnlimitedCaller mira el email del que llama, así que el dueño con pase pasa
   siempre... y como su rama sale ANTES de la transacción, sus escaneos tampoco
   incrementan scansUsed. El contador queda congelado en lo que marcaba el día que
   se topó el límite, y el dueño nunca más lo ve. Pero un MIEMBRO de su equipo no
   tiene el pase: cae al chequeo normal contra users/{ownerUid}/meta/billing, se
   encuentra ese contador agotado y queda bloqueado hasta que cambie el período.
   O sea: el empleado pagaba un límite que el dueño llenó antes de tener el pase y
   que ya nadie puede bajar.
   Si la CUENTA contra la que se escanea es de un dueño con pase, todos los que
   están autorizados en ella escanean sin cupo — que es lo que el pase quiso decir
   siempre. El email del dueño sale de Firebase Auth por su uid, nunca del body.
   Cache en memoria porque la Lambda se reusa entre invocaciones: evita un getUser
   por escaneo sin guardar nada persistente. */
const emailDeCuenta = new Map();
async function accountOwnerEmail(ownerUid) {
  if (emailDeCuenta.has(ownerUid)) return emailDeCuenta.get(ownerUid);
  let email = null;
  try {
    const u = await admin.auth().getUser(ownerUid);
    email = (u && u.email) ? u.email.toLowerCase() : null;
  } catch (e) {
    email = null; // uid inexistente o sin permiso: se trata como cuenta normal
  }
  emailDeCuenta.set(ownerUid, email);
  return email;
}
async function isUnlimitedAccount(ownerUid) {
  if (!ownerUid) return false;
  const email = await accountOwnerEmail(ownerUid);
  return !!(email && UNLIMITED_EMAILS.includes(email));
}

function currentBillingPeriod() {
  const d = new Date();
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
}

// Mismo criterio que firestore.rules: el dueño de la cuenta, o alguien que
// figure como miembro de su equipo (users/{ownerUid}/members/{callerUid}).
async function callerCanUseAccount(callerUid, ownerUid) {
  if (callerUid === ownerUid) return true;
  const db = admin.firestore();
  const memberDoc = await db.doc(`users/${ownerUid}/members/${callerUid}`).get();
  return memberDoc.exists;
}

/* RESERVA de cupo: chequea Y descuenta en la MISMA transacción, ANTES de llamar a
   Claude. La versión anterior (checkScanQuota) era una lectura suelta y el descuento
   llegaba recién después de que Claude respondiera (varios segundos): N pedidos en
   paralelo con 1 escaneo restante pasaban todos el chequeo y todos llegaban a Claude
   — el modo lote del cliente ya dispara 5 a la vez, y un cliente hostil podía abrir
   mucho más. Con la reserva, el cupo es un tope duro: el que no entra en la
   transacción, no llama a Claude. Si Claude después falla sin llegar a cobrar
   (error de red), refundScanUsage() devuelve la unidad. */
async function reserveScanQuota(ownerUid, caller, count = 1) {
  // Pase del dueño: ni chequea ni descuenta (limit/used en null → el cliente no
  // muestra "quedan N"; period en null → refundScanUsage no devuelve nada).
  // isUnlimitedCaller primero: el dueño escaneando en su propia cuenta se resuelve
  // sin ir a Auth. El miembro sí necesita la consulta (ver isUnlimitedAccount).
  if (isUnlimitedCaller(caller) || await isUnlimitedAccount(ownerUid)) {
    return { allowed: true, limit: null, used: null, period: null, unlimited: true };
  }
  const db = admin.firestore();
  const ref = db.doc(`users/${ownerUid}/meta/billing`);
  const period = currentBillingPeriod();
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : {};
    let limit, used;
    if (caller.isAnonymous) {
      // Trial: cupo TOTAL de por vida contra scansTotal, sin importar el mes. Un
      // anónimo nunca es miembro de un equipo, así que ownerUid es su propio uid.
      limit = TRIAL_SCAN_LIMIT;
      used = data.scansTotal || 0;
    } else {
      // El cupo reducido por email sin verificar solo aplica escaneando contra la
      // PROPIA cuenta: un miembro de equipo ya probó un código de invitación real,
      // y el cupo que gasta es el del dueño (con su propio plan/límite).
      const unverifiedSelf = !caller.emailVerified && caller.uid === ownerUid;
      limit = (data.plan && PLAN_SCAN_LIMITS[data.plan]) || (unverifiedSelf ? UNVERIFIED_SCAN_LIMIT : DEFAULT_SCAN_LIMIT);
      used = data.scansPeriod === period ? (data.scansUsed || 0) : 0;
    }
    if (used + count > limit) return { allowed: false, limit, used, period };
    tx.set(ref, {
      scansUsed: (data.scansPeriod === period ? (data.scansUsed || 0) : 0) + count,
      scansPeriod: period,
      scansTotal: (data.scansTotal || 0) + count,
      plan: data.plan || null
    }, { merge: true });
    return { allowed: true, limit, used: used + count, period };
  });
}

// Devuelve una unidad reservada cuando la llamada a Claude falló sin llegar a
// cobrarse (fetch que revienta por red). Los 502 de "Claude contestó basura" NO se
// refundan a propósito: esa llamada sí costó plata real.
async function refundScanUsage(ownerUid, count, period) {
  // Reserva del pase del dueño (period null): no se descontó nada, nada que devolver.
  if (!period) return;
  try {
    const db = admin.firestore();
    const ref = db.doc(`users/${ownerUid}/meta/billing`);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      const data = snap.data();
      const update = { scansTotal: Math.max(0, (data.scansTotal || 0) - count) };
      // El refund solo toca scansUsed si el doc sigue en el MISMO período de la
      // reserva. Si el mes rodó mientras la llamada a Claude fallaba (reserva a
      // las 23:59, otro escaneo a las 00:00), tocar scansUsed pisaba el contador
      // del mes nuevo con un 0 — cupo gratis para todos.
      if (data.scansPeriod === period) {
        update.scansUsed = Math.max(0, (data.scansUsed || 0) - count);
      }
      tx.set(ref, update, { merge: true });
    });
  } catch (e) {
    console.error('[Dusty] no se pudo devolver la reserva de escaneo:', e);
  }
}

/* Freno por IP: N llamadas de IA por hora por IP, cruzando todas las cuentas.
   Vive en Firestore (colección rateLimits/, sin regla que la matchee — solo el
   Admin SDK llega) porque las instancias de Netlify no comparten memoria. Un doc
   por IP-hora, con expireAt por si algún día se activa TTL en la consola; aún sin
   TTL son docs de dos campos, no pesan. Falla ABIERTO a propósito: si Firestore
   está caído, un negocio real no se queda sin escanear por culpa del freno. */
// opts.scope: contador aparte (misma IP, otra clave) con su propio tope opts.limit —
// las vueltas de herramientas del asistente usan uno más alto que las llamadas
// que arrancan un pedido, sin quedar sin freno (auditoría de la auditoría 2026-09-12).
async function checkIpRateLimit(event, opts) {
  try {
    const ip = event.headers['x-nf-client-connection-ip']
      || ((event.headers['x-forwarded-for'] || '').split(',')[0] || '').trim();
    if (!ip) return true;
    const crypto = require('crypto');
    const hour = Math.floor(Date.now() / 3600000);
    const scope = opts && opts.scope ? '-' + String(opts.scope).replace(/[^\w]/g, '') : '';
    const limit = opts && Number.isFinite(opts.limit) && opts.limit > 0 ? opts.limit : IP_RATE_LIMIT_PER_HOUR;
    // Se guarda un hash, no la IP en claro — para frenar abuso no hace falta
    // retener el dato personal.
    const key = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 24) + scope + '-' + hour;
    const db = admin.firestore();
    const ref = db.doc(`rateLimits/${key}`);
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const n = snap.exists ? (snap.data().n || 0) : 0;
      if (n >= limit) return false;
      tx.set(ref, {
        n: n + 1,
        expireAt: admin.firestore.Timestamp.fromMillis((hour + 2) * 3600000)
      }, { merge: true });
      return true;
    });
  } catch (e) {
    console.error('[Dusty] fallo el chequeo de rate limit por IP:', e);
    return true;
  }
}

// Se llama recién después de que Claude ya contestó bien — count es la cantidad real
// de "cosas" que salieron (recibos, o 1 por identificación de producto). Si esto
// falla no tumbamos el pedido: el usuario ya recibió su resultado y ya se gastó la
// plata en la llamada a Claude, perder el conteo de UN uso no vale la pena comparado
// con mostrarle un error después de que todo salió bien.
async function recordScanUsage(ownerUid, count, period) {
  // Reserva del pase del dueño (period null): tampoco se cuentan los extras del lote.
  if (!period) return;
  try {
    const db = admin.firestore();
    const ref = db.doc(`users/${ownerUid}/meta/billing`);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() : {};
      const update = {
        // Acumulado de por vida: es contra lo que se mide el cupo del trial
        // (cuentas anónimas), y de paso sirve como métrica de uso real.
        scansTotal: (data.scansTotal || 0) + count,
        plan: data.plan || null
      };
      if (!data.scansPeriod || data.scansPeriod === period) {
        // Período de la reserva vigente (o doc nuevo): registro normal.
        update.scansUsed = (data.scansPeriod === period ? (data.scansUsed || 0) : 0) + count;
        update.scansPeriod = period;
      }
      // Si el doc YA rodó a un período más nuevo mientras esta llamada volaba,
      // solo se suma al total de por vida — antes esto RETROCEDÍA scansPeriod al
      // mes viejo y descartaba el contador del mes nuevo.
      tx.set(ref, update, { merge: true });
    });
  } catch (e) {
    console.error('[Dusty] no se pudo registrar el uso de escaneo:', e);
  }
}

/* ===== SUSCRIPCIÓN: "primer mes por nuestra cuenta" y después se paga (2026-09-11) =====
   La cuenta tiene TRIAL_DAYS gratis desde que se creó en Firebase Auth — la
   fecha sale de admin.auth().getUser(uid).metadata.creationTime, que ni el
   cliente ni una reinstalación pueden tocar (localStorage se borra; esto no).
   Una cuenta anónima que después se convierte en real (linkWithCredential)
   conserva el uid y la fecha, así que el mes no se reinicia guardando la
   cuenta. Vencido el mes, la cuenta queda CERRADA (locked) salvo que tenga una
   suscripción vigente (users/{uid}/meta/billing.subscription, la escribe el
   webhook de Stripe) o sea una cuenta con pase (UNLIMITED_EMAILS).
   INTERRUPTOR: nada de esto muerde hasta que DUSTY_BILLING_ENABLED=1 en Netlify.
   Sin la variable, getAccessState siempre devuelve locked:false — así el código
   entero se despliega apagado y se prende el día que haya precios y Stripe; si
   se prendiera antes, toda cuenta con más de un mes quedaría en solo lectura
   sin forma de pagar.
   Lo que se persiste en meta/billing (billingEnabled, unlimited, trialEndsAt,
   subscriptionUntil) es para firestore.rules: las reglas no ven variables de
   entorno ni Auth, solo documentos, y con esos cuatro campos deciden si la
   cuenta puede ESCRIBIR (solo lectura de verdad, no solo en la UI). */
const BILLING_ENABLED = process.env.DUSTY_BILLING_ENABLED === '1';
const TRIAL_DAYS = Math.max(1, parseInt(process.env.DUSTY_TRIAL_DAYS || '30', 10) || 30);
// Días de regalo por contar por qué se va (encuesta de salida / despedida).
const RETENTION_DAYS = Math.max(1, parseInt(process.env.DUSTY_RETENTION_DAYS || '30', 10) || 30);
const DIA_MS = 86400000;
// Clave de una oferta de retención: hash del email, nunca el email en la ruta.
function retentionKey(email) {
  return require('crypto').createHash('sha256').update(String(email || '').trim().toLowerCase()).digest('hex').slice(0, 40);
}
const creadaEn = new Map();
async function accountCreatedAt(ownerUid) {
  if (creadaEn.has(ownerUid)) return creadaEn.get(ownerUid);
  let ms = null;
  try {
    const u = await admin.auth().getUser(ownerUid);
    const t = u && u.metadata && Date.parse(u.metadata.creationTime);
    if (Number.isFinite(t)) ms = t;
  } catch (e) { ms = null; }
  creadaEn.set(ownerUid, ms);
  return ms;
}
// Una suscripción cuenta como vigente mientras Stripe la tenga activa, en
// prueba, o con un pago atrasado dentro del período ya pagado (past_due: Stripe
// reintenta el cobro unos días; cortarle el acceso el primer día castiga una
// tarjeta vencida, no un impago real). Cancelada o impaga de verdad: hasta el
// fin del período que ya pagó, y ahí se cierra sola por la fecha.
function subscriptionUntilMs(sub) {
  if (!sub || !Number.isFinite(sub.currentPeriodEnd)) return 0;
  const vivos = ['active', 'trialing', 'past_due'];
  return vivos.includes(sub.status) ? sub.currentPeriodEnd : Math.min(sub.currentPeriodEnd, Date.now() - 1);
}
async function getAccessState(ownerUid, caller) {
  getFirebaseApp();
  const unlimited = isUnlimitedCaller(caller) || await isUnlimitedAccount(ownerUid);
  const db = admin.firestore();
  const ref = db.doc(`users/${ownerUid}/meta/billing`);
  const snap = await ref.get();
  const data = snap.exists ? snap.data() : {};
  const now = Date.now();
  // Sin fecha de creación (uid raro, Auth caído): no se inventa una — la cuenta
  // queda abierta. Cerrar por un error nuestro es peor que un mes gratis de más.
  const createdAt = Number.isFinite(data.accountCreatedAt) ? data.accountCreatedAt : await accountCreatedAt(ownerUid);
  // Se escribe solo si algo cambió: el arranque de cada sesión llama a esto y
  // no vale una escritura por apertura de app.
  const persist = { billingEnabled: BILLING_ENABLED, unlimited };
  if (Number.isFinite(createdAt)) persist.accountCreatedAt = createdAt;
  /* MES DE REGALO (retención, 2026-09-11). bonusMs se suma al mes gratis y sale
     de dos caminos: (a) aceptó "quédate un mes gratis" antes de borrar
     (claim-retention.js), (b) borró la cuenta, en la despedida contó por qué se
     iba (exit-feedback.js deja retentionOffers/{sha256(email)}) y VOLVIÓ con el
     mismo email: la primera vez que esta cuenta nueva pregunta por su acceso,
     canjea la oferta — una sola vez por oferta y por cuenta (retentionChecked). */
  let bonusMs = Number.isFinite(data.bonusMs) ? data.bonusMs : 0;
  if (!data.retentionChecked) {
    persist.retentionChecked = true;
    try {
      const u = await admin.auth().getUser(ownerUid);
      const email = u && u.email ? u.email.toLowerCase() : null;
      if (email) {
        const offRef = db.doc(`retentionOffers/${retentionKey(email)}`);
        const off = await offRef.get();
        if (off.exists && !off.data().claimedBy) {
          bonusMs += RETENTION_DAYS * DIA_MS;
          persist.bonusMs = bonusMs;
          await offRef.set({ claimedBy: ownerUid, claimedAt: now }, { merge: true });
        }
      }
    } catch (e) { console.error('[Dusty] no se pudo revisar la oferta de retención:', e); }
  }
  const trialEndsAt = Number.isFinite(createdAt) ? createdAt + TRIAL_DAYS * DIA_MS + bonusMs : null;
  const sub = data.subscription && typeof data.subscription === 'object' ? data.subscription : null;
  const subscriptionUntil = subscriptionUntilMs(sub);
  const locked = BILLING_ENABLED && !unlimited && trialEndsAt !== null && now > trialEndsAt && !(subscriptionUntil > now);
  persist.trialEndsAt = trialEndsAt || 0;
  persist.subscriptionUntil = subscriptionUntil;
  if (Object.keys(persist).some(k => data[k] !== persist[k])) {
    try { await ref.set(persist, { merge: true }); } catch (e) { console.error('[Dusty] no se pudo guardar el estado de acceso:', e); }
  }
  return {
    billingEnabled: BILLING_ENABLED, unlimited, locked, now, trialEndsAt, subscriptionUntil,
    subscription: sub ? { status: sub.status || null, plan: sub.plan || null, currentPeriodEnd: sub.currentPeriodEnd || null, cancelAtPeriodEnd: !!sub.cancelAtPeriodEnd } : null
  };
}
/* ===== PRESUPUESTO DE TIEMPO de una función (auditoría de datos 2026-09-12) =====
   Netlify corta una función síncrona a los 26 s (10 s en el plan gratis) y no
   avisa: el cliente recibe un 502/504 del gateway, el catch de la función nunca
   corre y la unidad de cupo reservada NO se devuelve — el usuario pagaba un
   escaneo por un error, y al reintentar pagaba otro. Con un tope propio, más
   corto que el de Netlify, la llamada a Claude se aborta a tiempo, la función
   contesta un JSON claro (upstream_timeout) y devuelve el cupo. Cada función
   toma su startedAt al entrar y pide la señal con lo que le queda.
   DUSTY_FUNCTION_BUDGET_MS lo ajusta por entorno (plan con 10 s: bajarlo a ~8000). */
const FUNCTION_BUDGET_MS = Math.max(3000, parseInt(process.env.DUSTY_FUNCTION_BUDGET_MS || '24000', 10) || 24000);
function remainingBudgetMs(startedAt, budgetMs, now) {
  const total = Number.isFinite(budgetMs) ? budgetMs : FUNCTION_BUDGET_MS;
  const t = Number.isFinite(now) ? now : Date.now();
  const from = Number.isFinite(startedAt) ? startedAt : t;
  return Math.max(0, total - (t - from));
}
// Señal de aborto para el fetch a Claude con lo que queda del presupuesto.
// Sin AbortSignal.timeout (Node viejo) devuelve undefined y el fetch sigue como antes.
function upstreamSignal(startedAt, budgetMs) {
  const ms = remainingBudgetMs(startedAt, budgetMs);
  return (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') ? AbortSignal.timeout(Math.max(1, ms)) : undefined;
}
// fetch abortado por la señal: Node lo reporta como AbortError o TimeoutError.
function isAbortError(e) { return !!(e && (e.name === 'AbortError' || e.name === 'TimeoutError')); }
// El cliente (callDustyAI) traduce el código a srv_upstream_timeout.
function upstreamTimeoutResponse() {
  return { statusCode: 504, body: JSON.stringify({ error: 'La IA tardó demasiado en responder — tu cupo no se descontó, prueba de nuevo', code: 'upstream_timeout' }) };
}

// Respuesta única para "vencido y sin suscripción": el cliente (callDustyAI)
// reconoce subscriptionRequired y abre la página de suscripción.
function subscriptionRequiredResponse() {
  return { statusCode: 402, body: JSON.stringify({ error: 'Tu primer mes gratis terminó — suscríbete para seguir escaneando', code: 'subscription_required', subscriptionRequired: true }) };
}

/* ===== STRIPE por REST, sin SDK =====
   La API de Stripe es HTTP + form-urlencoded; para crear una sesión de pago y
   leer una suscripción no hace falta el paquete `stripe` (y sumar una
   dependencia a netlify/functions/package.json es otra cosa que mantener).
   Claves: STRIPE_SECRET_KEY (sk_live_/sk_test_), STRIPE_PRICE_MONTH y
   STRIPE_PRICE_YEAR (ids price_… de los dos planes), STRIPE_WEBHOOK_SECRET
   (whsec_… del endpoint stripe-webhook). Sin la clave, stripeConfigured() es
   false y create-checkout contesta billing_not_configured. */
function stripeConfigured() {
  return !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_MONTH && process.env.STRIPE_PRICE_YEAR);
}
// Codifica objetos anidados como los quiere Stripe: a[b][c]=v.
function stripeForm(obj, prefix, out) {
  out = out || [];
  Object.keys(obj).forEach(k => {
    const key = prefix ? `${prefix}[${k}]` : k;
    const v = obj[k];
    if (v === undefined || v === null) return;
    if (typeof v === 'object') stripeForm(v, key, out);
    else out.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(v)));
  });
  return out.join('&');
}
async function stripeRequest(method, path, params) {
  const res = await fetch('https://api.stripe.com/v1' + path, {
    method,
    headers: {
      'Authorization': 'Bearer ' + process.env.STRIPE_SECRET_KEY,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: method === 'GET' ? undefined : stripeForm(params || {})
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json && json.error && json.error.message ? json.error.message : ('Stripe ' + res.status);
    const err = new Error(msg); err.stripe = json && json.error; throw err;
  }
  return json;
}
// Traduce el objeto Subscription de Stripe a lo que guarda meta/billing.
function subscriptionRecord(sub) {
  const item = sub && sub.items && sub.items.data && sub.items.data[0];
  const priceId = item && item.price && item.price.id;
  const plan = priceId === process.env.STRIPE_PRICE_YEAR ? 'year' : (priceId === process.env.STRIPE_PRICE_MONTH ? 'month' : (priceId || null));
  return {
    status: sub.status || null,
    plan,
    currentPeriodEnd: Number.isFinite(sub.current_period_end) ? sub.current_period_end * 1000 : null,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    customerId: typeof sub.customer === 'string' ? sub.customer : (sub.customer && sub.customer.id) || null,
    subscriptionId: sub.id || null,
    updatedAt: Date.now()
  };
}
// Escribe la suscripción en la cuenta y deja subscriptionUntil listo para las
// reglas de Firestore (ver getAccessState).
async function saveSubscription(ownerUid, record) {
  getFirebaseApp();
  const ref = admin.firestore().doc(`users/${ownerUid}/meta/billing`);
  await ref.set({ subscription: record, subscriptionUntil: subscriptionUntilMs(record) }, { merge: true });
}

module.exports = {
  admin, getFirebaseApp, isAllowedOrigin, corsHeaders, withCors, verifyCaller, verifyCallerInfo, ALLOWED_ORIGIN_PATTERNS,
  isUnlimitedAccount,
  currentBillingPeriod, callerCanUseAccount, reserveScanQuota, refundScanUsage, recordScanUsage,
  checkIpRateLimit,
  BILLING_ENABLED, TRIAL_DAYS, RETENTION_DAYS, DIA_MS, retentionKey, getAccessState, subscriptionRequiredResponse,
  FUNCTION_BUDGET_MS, remainingBudgetMs, upstreamSignal, isAbortError, upstreamTimeoutResponse,
  stripeConfigured, stripeRequest, subscriptionRecord, saveSubscription
};
