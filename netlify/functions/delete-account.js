// netlify/functions/delete-account.js
//
// Borra en cascada TODO lo que esta cuenta tiene en Firebase: su árbol completo
// en Firestore (inventario, compras, recibos, ajustes, actividad, y si es dueña
// de un equipo, la lista de miembros), las fotos de recibos en Storage, el
// código de invitación que haya generado, su lugar como miembro en el equipo de
// otra cuenta si se había unido a uno, y finalmente la cuenta de Firebase Auth
// en sí. Es irreversible — no hay "deshacer" ni de un lado ni del otro.
//
// callerUid sale SIEMPRE del ID token verificado (ver verifyCaller en
// lib/patron-admin.js), nunca del body del pedido — nadie puede pedir borrar la
// cuenta de otra persona, ni siquiera el dueño de un equipo sobre sus miembros.
//
// Nota sobre miembros de un equipo que ESTA cuenta borra (si era dueña de uno):
// no hace falta avisarles nada desde acá. handleSyncPermissionDenied() en
// index.html ya detecta un "permission-denied" en cualquiera de sus listeners
// de Firestore (que van a empezar a fallar apenas este árbol desaparezca) y
// devuelve a cada miembro a su propia cuenta vacía automáticamente.
const { admin, getFirebaseApp, isAllowedOrigin, verifyCaller } = require('./lib/patron-admin');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  if (!isAllowedOrigin(event)) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Origen no permitido' }) };
  }

  const callerUid = await verifyCaller(event);
  if (!callerUid) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Iniciá sesión de nuevo para poder borrar tu cuenta' }) };
  }

  try {
    getFirebaseApp();
    const db = admin.firestore();
    const userRef = db.collection('users').doc(callerUid);

    // 1. Si esta cuenta generó un código de invitación (es o fue dueña de un
    //    equipo), hay que borrarlo aparte: inviteCodes/{code} vive en una
    //    colección de nivel raíz, no bajo users/{uid} — el recursiveDelete()
    //    del paso 3 no lo alcanza.
    let inviteCodeToDelete = null;
    const teamDoc = await userRef.collection('meta').doc('team').get();
    if (teamDoc.exists && teamDoc.data().inviteCode) {
      inviteCodeToDelete = teamDoc.data().inviteCode;
    }

    // 2. Si esta cuenta se había unido al equipo de otra persona, su doc de
    //    membresía vive bajo el árbol del DUEÑO (users/{ownerUid}/members/{callerUid}),
    //    no bajo el propio — tampoco lo alcanza el recursiveDelete() del paso 3.
    let joinedOwnerUidToClean = null;
    const joinedDoc = await userRef.collection('meta').doc('joined').get();
    if (joinedDoc.exists && joinedDoc.data().ownerUid) {
      joinedOwnerUidToClean = joinedDoc.data().ownerUid;
    }

    // 3. Borra TODO el árbol propio de un saque: inventory, purchases, receipts,
    //    meta/* (settings/team/joined/billing), activity, y members/* si esta
    //    cuenta es dueña de un equipo — todas subcolecciones de users/{callerUid},
    //    así que quedan cubiertas automáticamente sin listarlas una por una.
    await db.recursiveDelete(userRef);

    // 4. Limpieza de lo que vive FUERA del árbol propio. No es bloqueante: si un
    //    paso falla, seguimos con el resto en vez de dejar a mitad de camino algo
    //    que sí se puede terminar — los datos importantes (el árbol de esta
    //    cuenta) ya se borraron en el paso 3.
    const cleanupResults = await Promise.allSettled([
      inviteCodeToDelete ? db.collection('inviteCodes').doc(inviteCodeToDelete).delete() : Promise.resolve(),
      joinedOwnerUidToClean ? db.doc(`users/${joinedOwnerUidToClean}/members/${callerUid}`).delete() : Promise.resolve()
    ]);
    cleanupResults.forEach((r, i) => {
      if (r.status === 'rejected') console.error('[PATRON] delete-account: falló limpieza extra #' + i + ':', r.reason);
    });

    // 5. Fotos de recibos en Storage — no son parte de Firestore, hay que
    //    borrarlas aparte. Best-effort: un archivo huérfano no es grave (nadie
    //    puede leerlo sin ser este uid, que ya no existe), así que no aborta el
    //    borrado de la cuenta si esto falla.
    try {
      const bucket = admin.storage().bucket();
      await bucket.deleteFiles({ prefix: `users/${callerUid}/receipts/` });
    } catch (storageErr) {
      console.error('[PATRON] delete-account: no se pudieron borrar las fotos de Storage:', storageErr);
    }

    // 6. Recién al final, con los datos ya borrados, se borra la cuenta de
    //    Firebase Auth en sí — si esto fuera primero y algo de arriba fallara,
    //    quedaría un árbol de datos huérfano sin ningún dueño que lo pueda
    //    volver a borrar ni intentar de nuevo.
    await admin.auth().deleteUser(callerUid);

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('[PATRON] delete-account failed:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'No se pudo borrar la cuenta, intentá de nuevo' }) };
  }
};
