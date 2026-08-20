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
  const header = event.headers.authorization || event.headers.Authorization || '';
  const idToken = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!idToken) return null;
  try {
    getFirebaseApp();
    const decoded = await admin.auth().verifyIdToken(idToken);
    return decoded.uid;
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

async function checkScanQuota(ownerUid) {
  const db = admin.firestore();
  const ref = db.doc(`users/${ownerUid}/meta/billing`);
  const period = currentBillingPeriod();
  const snap = await ref.get();
  const data = snap.exists ? snap.data() : {};
  const limit = (data.plan && PLAN_SCAN_LIMITS[data.plan]) || DEFAULT_SCAN_LIMIT;
  const used = data.scansPeriod === period ? (data.scansUsed || 0) : 0;
  return { allowed: used < limit, limit, used, period };
}

// Se llama recién después de que Claude ya contestó bien — count es la cantidad real
// de "cosas" que salieron (recibos, o 1 por identificación de producto). Si esto
// falla no tumbamos el pedido: el usuario ya recibió su resultado y ya se gastó la
// plata en la llamada a Claude, perder el conteo de UN uso no vale la pena comparado
// con mostrarle un error después de que todo salió bien.
async function recordScanUsage(ownerUid, count, period) {
  try {
    const db = admin.firestore();
    const ref = db.doc(`users/${ownerUid}/meta/billing`);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() : {};
      const prevUsed = data.scansPeriod === period ? (data.scansUsed || 0) : 0;
      tx.set(ref, {
        scansUsed: prevUsed + count,
        scansPeriod: period,
        plan: data.plan || null
      }, { merge: true });
    });
  } catch (e) {
    console.error('[Dusty] no se pudo registrar el uso de escaneo:', e);
  }
}

module.exports = {
  admin, getFirebaseApp, isAllowedOrigin, verifyCaller, ALLOWED_ORIGIN_PATTERNS,
  currentBillingPeriod, callerCanUseAccount, checkScanQuota, recordScanUsage
};
