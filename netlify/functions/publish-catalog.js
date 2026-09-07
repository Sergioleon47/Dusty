// netlify/functions/publish-catalog.js
//
// Publica (o actualiza, o despublica) el CATÁLOGO PÚBLICO de un negocio: la
// selección de productos con foto y precio que el dueño quiere mostrarle a SUS
// clientes en una página compartible (catalogo.html / patronsc.netlify.app/c/ID).
//
// Corre con el Admin SDK a propósito: el doc público vive en publicCatalogs/{id},
// una colección que las reglas de Firestore no abren para nadie — solo estas
// funciones la tocan. Así no hubo que abrir NINGUNA regla nueva de cliente
// (lección del hueco de invite-codes de 2026-08-23: cada regla pública es una
// superficie de ataque). Las fotos viajan acá en base64 (son thumbnails chicos,
// ~15-25KB) y esta función las sube a Storage como archivos públicos bajo
// catalogs/{catalogId}/ — el cliente tampoco necesita permisos nuevos de Storage.
const crypto = require('crypto');
const {
  admin, getFirebaseApp, isAllowedOrigin, verifyCaller, callerCanUseAccount
} = require('./lib/patron-admin');

const MAX_ITEMS = 100;
const MAX_PHOTO_B64 = 300000; // ~225KB reales por foto — los thumbnails de la app pesan mucho menos
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
// Solo URLs de fotos que ya viven en el Storage de ESTE proyecto (recetas ya
// subidas, o las ALTAS del catálogo que sube upload-catalog-photo) — nunca una
// URL arbitraria escrita por el cliente, que convertiría el catálogo en un
// rebotador de links ajenos.
const OWN_STORAGE_URL = /^https:\/\/(firebasestorage\.googleapis\.com\/v0\/b\/patron-inventory\.firebasestorage\.app\/|storage\.googleapis\.com\/patron-inventory\.firebasestorage\.app\/)/;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  }
  if (!isAllowedOrigin(event)) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Origen no permitido' }) };
  }
  getFirebaseApp();
  const callerUid = await verifyCaller(event);
  if (!callerUid) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Sesión inválida — volvé a entrar', code: 'bad_token' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Body inválido' }) };
  }
  const ownerUid = str(body.ownerUid, 128) || callerUid;
  if (!(await callerCanUseAccount(callerUid, ownerUid))) {
    return { statusCode: 403, body: JSON.stringify({ error: 'No tenés acceso a esa cuenta' }) };
  }

  const db = admin.firestore();
  const catalogId = str(body.catalogId, 40);

  // Si viene un catalogId, tiene que ser un catálogo DE ESTA cuenta — sin este
  // chequeo, cualquiera con sesión podría pisar el catálogo de otro negocio.
  let existing = null;
  if (catalogId) {
    const snap = await db.doc(`publicCatalogs/${catalogId}`).get();
    if (snap.exists && snap.data().ownerUid !== ownerUid) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Ese catálogo no es de esta cuenta' }) };
    }
    existing = snap.exists ? snap.data() : null;
  }

  // Despublicar: borra el doc (las fotos quedan huérfanas en Storage — costo
  // mínimo, y republicar con el mismo id las reusa/pisa).
  if (body.unpublish === true) {
    if (!catalogId || !existing) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Catálogo no encontrado' }) };
    }
    await db.doc(`publicCatalogs/${catalogId}`).delete();
    return { statusCode: 200, body: JSON.stringify({ ok: true, unpublished: true }) };
  }

  const rawItems = Array.isArray(body.items) ? body.items.slice(0, MAX_ITEMS) : [];
  if (rawItems.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'El catálogo necesita al menos un producto', code: 'no_items' }) };
  }

  // id nuevo: corto, no adivinable (72 bits), apto para URL.
  const finalId = (catalogId && existing !== null) || catalogId
    ? catalogId
    : crypto.randomBytes(9).toString('base64url');

  const bucket = admin.storage().bucket();
  const items = [];
  for (let i = 0; i < rawItems.length; i++) {
    const it = rawItems[i] || {};
    const name = str(it.name, 120).trim();
    if (!name) continue;
    const price = (typeof it.price === 'number' && it.price > 0) ? Math.round(it.price * 100) / 100 : null;
    let photoUrl = null;
    const givenUrl = str(it.photoUrl, 1000);
    if (givenUrl && OWN_STORAGE_URL.test(givenUrl)) {
      photoUrl = givenUrl;
    } else if (typeof it.photoB64 === 'string' && it.photoB64 && it.photoB64.length <= MAX_PHOTO_B64) {
      // La foto se guarda como archivo PÚBLICO bajo el id no adivinable del
      // catálogo — mismo nivel de exposición que la página que la muestra.
      const safeItemId = str(it.id, 60).replace(/[^A-Za-z0-9_-]/g, '') || ('item' + i);
      const file = bucket.file(`catalogs/${finalId}/${safeItemId}.jpg`);
      try {
        await file.save(Buffer.from(it.photoB64, 'base64'), {
          contentType: str(it.photoMediaType, 60) || 'image/jpeg',
          resumable: false
        });
        await file.makePublic();
        photoUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
      } catch (e) {
        console.error('[Dusty] no se pudo subir la foto de catálogo de', name, e.message);
      }
    }
    // Miniatura (480px) para la grilla pública — solo de nuestro Storage, como
    // la foto grande. Sin ella la página usa photoUrl como siempre.
    const givenThumb = str(it.photoThumbUrl, 1000);
    const photoThumbUrl = (photoUrl && givenThumb && OWN_STORAGE_URL.test(givenThumb)) ? givenThumb : null;
    items.push({
      name,
      price,
      unit: str(it.unit, 30) || null,
      category: str(it.category, 80) || null,
      photoUrl,
      photoThumbUrl
    });
  }
  if (items.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'El catálogo necesita al menos un producto', code: 'no_items' }) };
  }

  // El número de WhatsApp viaja ya reducido a dígitos (wa.me no acepta otra cosa).
  const whatsapp = str(body.whatsapp, 20).replace(/\D/g, '');
  // Canales elegidos por el dueño: SMS/llamadas (mismo número) y redes como
  // usuarios saneados — nunca URLs arbitrarias.
  const ch = (body.channels && typeof body.channels === 'object') ? body.channels : {};
  const user = (v, max) => str(v, max).replace(/[^A-Za-z0-9._-]/g, '');
  const channels = {
    sms: ch.sms === true, call: ch.call === true,
    instagram: user(ch.instagram, 40), facebook: user(ch.facebook, 60), tiktok: user(ch.tiktok, 40)
  };
  await db.doc(`publicCatalogs/${finalId}`).set({
    ownerUid,
    businessName: str(body.businessName, 120),
    whatsapp,
    channels,
    lang: body.lang === 'en' ? 'en' : 'es',
    items,
    updatedAt: new Date().toISOString()
  });

  return { statusCode: 200, body: JSON.stringify({ ok: true, catalogId: finalId, itemCount: items.length }) };
};
