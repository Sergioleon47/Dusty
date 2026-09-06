// netlify/functions/get-catalog.js
//
// Lee un catálogo público por su id y devuelve SOLO los campos públicos — es lo
// que consume catalogo.html (la página que el negocio comparte con sus clientes).
// No pide sesión: el cliente final no tiene cuenta ni app. El id es la única
// llave (aleatorio, no adivinable) y publicCatalogs solo se escribe vía
// publish-catalog.js con Admin SDK — las reglas de Firestore siguen cerradas.
const { admin, getFirebaseApp } = require('./lib/patron-admin');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  }
  const id = String((event.queryStringParameters || {}).c || '').slice(0, 40);
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(id)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Catálogo inválido' }) };
  }
  getFirebaseApp();
  try {
    const snap = await admin.firestore().doc(`publicCatalogs/${id}`).get();
    if (!snap.exists) {
      return { statusCode: 404, body: JSON.stringify({ error: 'not_found' }) };
    }
    const d = snap.data();
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        // Cache cortito en el CDN: aguanta que un catálogo se comparta masivamente
        // sin pegarle a Firestore por cada visita, y una republicación se ve en ≤1 min.
        'Cache-Control': 'public, max-age=60'
      },
      // ownerUid NUNCA sale de acá — es interno.
      body: JSON.stringify({
        businessName: d.businessName || '',
        whatsapp: d.whatsapp || '',
        lang: d.lang === 'en' ? 'en' : 'es',
        items: Array.isArray(d.items) ? d.items : [],
        updatedAt: d.updatedAt || null
      })
    };
  } catch (e) {
    console.error('[Dusty] get-catalog error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: 'No se pudo cargar el catálogo' }) };
  }
};
