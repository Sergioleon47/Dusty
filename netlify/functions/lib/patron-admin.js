// netlify/functions/lib/patron-admin.js
//
// Piezas compartidas entre las Netlify Functions de Dusty que necesitan
// privilegios de administrador (Firebase Admin SDK) y verificar quién llama.
// Antes esto vivía duplicado adentro de extract-receipt.js; con delete-account.js
// sumándose, factorizarlo acá evita que las copias se desincronicen con el tiempo
// (por ejemplo, si cambia el allowlist de orígenes, hay que acordarse de tocarlo
// en un solo lugar, no en cada función por separado).
/* firebase-admin 14 sacó los servicios del objeto por defecto: admin.firestore(),
   admin.auth() y admin.storage() YA NO EXISTEN — el paquete ahora exporta solo lo
   de la app (initializeApp, getApps, cert) y cada servicio vive en su propio
   subcamino. Es un fallo en tiempo de EJECUCIÓN, no de build: con la 12 el deploy
   pasaba igual y el error habría aparecido recién al escanear un recibo.
   Las 8 funciones de esta carpeta llaman a esos tres servicios a través del objeto
   `admin` que esta biblioteca re-exporta. En vez de tocar 16 llamadas repartidas
   en 6 archivos que hoy no cubre ninguna prueba, el adaptador se arma UNA vez acá
   y todas siguen andando igual. No esconde la API modular: cada método resuelve al
   subcamino que le corresponde, en una sola línea legible. Migrar los llamadores a
   getFirestore()/getAuth()/getStorage() directo es un cambio aparte y mecánico,
   que conviene hacer cuando esas funciones tengan pruebas propias. */
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

const admin = {
  get apps() { return getApps(); },
  initializeApp,
  credential: { cert },
  auth: () => getAuth(),
  storage: () => getStorage(),
  // admin.firestore() y admin.firestore.Timestamp: función y espacio de nombres a
  // la vez, igual que en la 12 (checkIpRateLimit usa el Timestamp).
  firestore: Object.assign(() => getFirestore(), { Timestamp })
};

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
const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/([a-z0-9-]+\.)?patronsc\.netlify\.app$/i,
  /^http:\/\/localhost(:\d+)?$/i,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/i
];
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
async function checkIpRateLimit(event) {
  try {
    const ip = event.headers['x-nf-client-connection-ip']
      || ((event.headers['x-forwarded-for'] || '').split(',')[0] || '').trim();
    if (!ip) return true;
    const crypto = require('crypto');
    const hour = Math.floor(Date.now() / 3600000);
    // Se guarda un hash, no la IP en claro — para frenar abuso no hace falta
    // retener el dato personal.
    const key = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 24) + '-' + hour;
    const db = admin.firestore();
    const ref = db.doc(`rateLimits/${key}`);
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const n = snap.exists ? (snap.data().n || 0) : 0;
      if (n >= IP_RATE_LIMIT_PER_HOUR) return false;
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

module.exports = {
  admin, getFirebaseApp, isAllowedOrigin, verifyCaller, verifyCallerInfo, ALLOWED_ORIGIN_PATTERNS,
  isUnlimitedAccount,
  currentBillingPeriod, callerCanUseAccount, reserveScanQuota, refundScanUsage, recordScanUsage,
  checkIpRateLimit
};
