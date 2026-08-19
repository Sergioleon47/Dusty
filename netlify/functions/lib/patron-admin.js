// netlify/functions/lib/patron-admin.js
//
// Piezas compartidas entre las Netlify Functions de PATRON que necesitan
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
// realmente del sitio de PATRON o de una vista previa/desarrollo local.
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

module.exports = { admin, getFirebaseApp, isAllowedOrigin, verifyCaller, ALLOWED_ORIGIN_PATTERNS };
