/* ================= SINCRONIZACIÓN EN LA NUBE (Firebase) =================
   Opcional: sin iniciar sesión, la app funciona exactamente igual que
   siempre (100% localStorage). Mismo patrón ya probado en Nudgy. Por ahora
   (fase 1 del plan) esto solo maneja login/logout — todavía no sincroniza
   datos, eso se agrega en una fase siguiente. */
var firebaseConfig = {
  apiKey: "AIzaSyC0nZzkr-k43_SIYQnr7vpYyaraTcZUupY",
  authDomain: "patron-inventory.firebaseapp.com",
  projectId: "patron-inventory",
  storageBucket: "patron-inventory.firebasestorage.app",
  messagingSenderId: "496327327860",
  appId: "1:496327327860:web:50af127dcaa332d0cd1121"
};
let currentUser = null;
// Si esta cuenta se unió al inventario compartido de otra (ver sección de equipo
// más abajo), joinedOwnerUid apunta al uid dueño de esos datos — todas las
// referencias de Firestore usan syncUid() en vez de currentUser.uid directo, para
// que leer/escribir vaya siempre al lugar correcto sin repetir este chequeo en
// cada punto de la app.
let joinedOwnerUid = null, joinedOwnerEmail = '';
function syncUid(){ return joinedOwnerUid || (currentUser && currentUser.uid) || null; }
let showTeamModal = false, teamInviteCode = '', teamMembers = [], teamLoading = false, teamError = '', teamJoinCode = '';
let unsubTeamMembers = null;
// Qué uid produjo el estado local que hay cargado ahora mismo (memoria/localStorage).
// Sirve para detectar el caso "se cerró sesión de una cuenta y se inició sesión con
// OTRA, distinta, en la misma pestaña sin recargar la página" — sin esto, los datos
// que quedan cargados de la cuenta anterior se tratarían como "datos locales sin
// subir" de la cuenta nueva, y terminarían subidos/mezclados en el uid equivocado.
let lastSyncedUid = null;
let firebaseLoadPromise = null;
function loadExternalScript(src){
  return new Promise((resolve, reject)=>{
    const s = document.createElement('script');
    s.src = src;
    s.onload = ()=>resolve();
    s.onerror = ()=>reject(new Error('load failed: '+src));
    document.head.appendChild(s);
  });
}
// Carga los SDKs de Firebase solo la primera vez que hace falta (recién al
// tocar el botón de sincronizar) — así nadie que no use esta función paga
// el costo de descargarlos.
function ensurePatronFirebaseReady(){
  if (firebaseLoadPromise) return firebaseLoadPromise;
  firebaseLoadPromise = loadExternalScript('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
    .then(()=>loadExternalScript('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js'))
    .then(()=>loadExternalScript('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js'))
    .then(()=>loadExternalScript('https://www.gstatic.com/firebasejs/10.14.1/firebase-storage-compat.js'))
    .then(()=>{
      firebase.initializeApp(firebaseConfig);
      firebase.auth().getRedirectResult().catch(err=>{
        console.error('[Dusty] sign-in redirect result failed:', err);
      });
      firebase.auth().onAuthStateChanged(user=>{
        currentUser = user;
        if(user){
          try{
            localStorage.setItem('patron_had_session','1');
            // Ver everHadRealAccount(): solo cuentas REALES dejan la marca permanente.
            if(!user.isAnonymous) localStorage.setItem('patron_ever_real_account','1');
          }catch(e){}
          showAuthModal = false; authError=''; authLoading=false;
          // Antes de reconciliar hay que saber si esta cuenta se unió al inventario
          // compartido de otra persona (ver sección de equipo más abajo) — si es así,
          // todo lo de acá abajo opera sobre el uid del DUEÑO del inventario, no sobre
          // el propio. joinedRef() vive bajo el uid de ESTA cuenta (sus propias reglas
          // de siempre aplican, nada especial).
          const proceedWithJoinedDoc = (joinedDoc)=>{
            joinedOwnerUid = joinedDoc.exists ? joinedDoc.data().ownerUid : null;
            joinedOwnerEmail = joinedDoc.exists ? (joinedDoc.data().ownerEmail||'') : '';
            const targetUid = syncUid();
            // Si lo que hay cargado en memoria/localStorage pertenece a OTRA cuenta
            // (alguien cerró sesión y otra persona inició sesión en el mismo dispositivo
            // sin recargar la página), se descarta ANTES de armar la foto de "datos
            // locales" — si no, reconcileLocalOnlyData subiría el inventario de la
            // cuenta anterior como si fuera de la cuenta nueva.
            if(lastSyncedUid && lastSyncedUid !== targetUid){
              applyingRemoteSnapshot = true;
              inventory=[]; purchases=[]; receipts=[]; deletedInventoryIds=[]; deletedReceiptIds=[]; deletedPurchaseIds=[]; aliasMap={}; calNotes=[]; deletedCalNoteIds=[]; recipes=[]; outflows=[]; deletedRecipeIds=[]; resetSyncedHashes();
              saveState();
              applyingRemoteSnapshot = false;
            }
            lastSyncedUid = targetUid;
            // Se guarda una foto de cómo estaba todo ANTES de conectar los listeners
            // de Firestore, porque apenas se conectan pueden pisar estos arrays con
            // lo que haya (o no haya) en la nube — sin esta foto, no habría de dónde
            // sacar qué subir.
            const localSnapshot = {
              inventory: inventory.slice(), purchases: purchases.slice(), receipts: receipts.slice(),
              aliasMap: Object.assign({}, aliasMap), priceAlertThreshold, cycleCountPct,
              cycleCountIntervalDays, cycleCountLastDate, cycleCountCursor, businessName, monthlyBudget,
              profitsVisibleToMembers,
              categories: categories ? categories.slice() : categories,
              calNotes: calNotes.slice(),
              recipes: recipes.slice(), outflows: outflows.slice()
            };
            // Importante: los listeners en tiempo real recién se conectan DESPUÉS de que
            // termine (o falle) la reconciliación — así el primer snapshot que llega ya
            // incluye todo lo local, y nunca pisa con una versión incompleta de la nube
            // algo que este dispositivo tenía y todavía no había subido.
            return reconcileLocalOnlyData(targetUid, localSnapshot).catch(err=>{
              console.error('[Dusty] reconcile failed:', err);
              // Si el reconcile falla no hay forma de saber si la nube tenía algo más
              // que lo local -- no vale la pena seguir esperando un snapshot que a lo
              // mejor nunca llega por este error.
              cloudSyncPending = false;
            }).then(()=>{
              // Carrera con submitQuickJoin/applyJoinedTeam (satélite del PLAN-SYNC):
              // si mientras esperábamos el reconcile la cuenta se unió a un equipo
              // (o salió de uno), syncUid() ya no es el targetUid de esta pasada —
              // attachear acá pisaría los listeners correctos que esa transición ya
              // conectó, apuntando a un árbol de datos que ya no es el vigente.
              if(syncUid() !== targetUid) return;
              attachFirestoreListeners(targetUid);
              attachTeamListener();
              if(joinedOwnerUid) startPresenceHeartbeat(); else stopPresenceHeartbeat();
              // cloudSyncPending NO se apaga acá todavía a propósito: recién ahora es
              // que attachFirestoreListeners() dispara el primer snapshot real de
              // Firestore (de forma asíncrona) -- lo apaga applyRemoteInventorySnapshot()
              // cuando ese primer snapshot efectivamente llega. Apagarlo acá dejaría
              // la ventana de riesgo (entre "se pidió" y "llegó") completamente
              // desprotegida, que es justo la ventana que causaba el problema.
              render();
            });
          };
          /* Satélite del PLAN-SYNC: si el lookup de equipo falla (red móvil flaky —
             pasa seguido), antes se conectaban los listeners al uid PROPIO "a
             ciegas": para una cuenta que en realidad era miembro de un equipo, el
             primer snapshot (vacío, de su árbol propio) pisaba la copia local del
             inventario compartido — y encima sin reconcile, así que también podía
             subir datos a donde no era. Ahora se reintenta con backoff y, mientras
             tanto, la app sigue funcionando con los datos locales intactos. */
          const attemptTeamLookup = (delayMs)=>{
            joinedRef(user.uid).get().then(proceedWithJoinedDoc).catch(err=>{
              console.error('[Dusty] joined-team lookup failed (se reintenta en '+delayMs+'ms):', err);
              cloudSyncPending = false;
              render();
              setTimeout(()=>{
                // La sesión pudo cambiar mientras esperábamos (logout, otra cuenta).
                if(!currentUser || currentUser.uid !== user.uid) return;
                attemptTeamLookup(Math.min(delayMs*2, 60000));
              }, delayMs);
            });
          };
          attemptTeamLookup(3000);
        } else {
          cloudSyncPending = false;
          try{ localStorage.removeItem('patron_had_session'); }catch(e){}
          detachFirestoreListeners();
          detachTeamListener();
          stopPresenceHeartbeat();
          joinedOwnerUid = null; joinedOwnerEmail = '';
          // ensureInviteCode() solo pide uno nuevo si teamInviteCode está vacío — sin
          // este reset, en un dispositivo compartido la próxima cuenta que abra el
          // panel de Equipo vería el código de invitación de la cuenta ANTERIOR
          // mostrado como si fuera el suyo (invitando gente al inventario equivocado).
          teamInviteCode = '';
          // Sin esto, un reintento de sync pendiente de la cuenta que se acaba de ir
          // (por ej. un guardado que había fallado sin red) podía disparase más tarde
          // — si para entonces ya había otra cuenta logueada en el mismo dispositivo,
          // syncAllToFirestore() corría con currentUser de la cuenta nueva pero
          // inventory/purchases/receipts en memoria todavía de la cuenta vieja
          // (la limpia recién el chequeo de lastSyncedUid, que es async), escribiendo
          // datos de una cuenta bajo el uid de otra.
          clearTimeout(cloudSyncDebounceTimer);
          clearTimeout(cloudSyncRetryTimer);
          cloudSyncDirty = false;
          cloudSyncRetryDelayMs = 2000;
        }
        render();
      });
    })
    // Si la carga de los SDK falla (ej. la app se abrió sin red), la promesa
    // rechazada NO puede quedar cacheada: cada llamada posterior devolvería el
    // mismo rechazo aunque la conexión ya haya vuelto, y el login/escaneo
    // quedarían muertos hasta recargar la página. Se resetea para que el
    // próximo intento vuelva a cargar los scripts desde cero.
    .catch(err=>{
      firebaseLoadPromise = null;
      throw err;
    });
  return firebaseLoadPromise;
}

/* ---- Trial sin cuenta: sesión anónima de Firebase ---- */
// Escanear le pega a la API de Claude (cuesta plata), así que necesita SÍ o SÍ un
// uid contra el que contar el cupo — pero pedirle a alguien que recién conoce la
// app que se registre ANTES de ver el valor mataba la primera impresión. Solución:
// una cuenta anónima de Firebase, invisible para el usuario (cero formularios),
// contra la que el servidor cuenta un cupo de prueba (ver TRIAL_SCAN_LIMIT en
// netlify/functions/lib/patron-admin.js). Cuando el trial se acaba, la cuenta se
// CONVIERTE en una real con email+PIN vía linkWithCredential — mismo uid, así que
// todo lo que escaneó/cargó durante la prueba se conserva sin migrar nada.
// patron_ever_real_account: marca PERMANENTE de que este dispositivo alguna vez
// entró con una cuenta real (no anónima). A diferencia de patron_had_session (que
// se borra al cerrar sesión), esta nunca se borra — salvo al eliminar la cuenta.
// Es la que evita el peor accidente del trial: alguien con cuenta real que quedó
// desconectado tocaba "Escanear" y la app le creaba EN SILENCIO una cuenta anónima
// vacía — de golpe "desaparecían" sus recibos e inventario (seguían en la nube,
// pero el dispositivo estaba mirando otra cuenta). Con la marca, ese caso vuelve
// al login de siempre; el trial anónimo queda solo para dispositivos que jamás
// tuvieron cuenta.
function everHadRealAccount(){
  try{ return !!localStorage.getItem('patron_ever_real_account'); }catch(e){ return false; }
}
// isTrialUser(): con cuenta anónima, o sin cuenta EN UN DISPOSITIVO QUE NUNCA TUVO
// una real — a alguien con cuenta real desconectado no le aplican los límites del
// trial ni sus mensajes de "guardá tu cuenta" (ya la tiene: le toca "iniciá sesión").
const TRIAL_INVENTORY_LIMIT = 30;
function isTrialUser(){
  if(currentUser) return currentUser.isAnonymous;
  return !everHadRealAccount();
}
let trialSigninPromise = null;
function ensureTrialAccount(){
  if(currentUser) return Promise.resolve(currentUser);
  // Red de seguridad (los call sites ya chequean antes de llamar): jamás crear una
  // cuenta anónima en un dispositivo que tuvo cuenta real.
  if(everHadRealAccount()){
    const e = new Error('real account exists on this device');
    e.code = 'trial/real-account-exists';
    return Promise.reject(e);
  }
  if(trialSigninPromise) return trialSigninPromise;
  trialSigninPromise = ensurePatronFirebaseReady()
    .then(()=>firebase.auth().signInAnonymously())
    .then(cred=>cred.user)
    // No se cachea un intento fallido (ej. sin red): el próximo tap reintenta.
    .catch(err=>{ trialSigninPromise=null; throw err; });
  return trialSigninPromise;
}

/* ---- Referencias a las colecciones de Firestore de este usuario ---- */
function inventoryRef(uid){ return firebase.firestore().collection('users').doc(uid).collection('inventory'); }
function purchasesRef(uid){ return firebase.firestore().collection('users').doc(uid).collection('purchases'); }
function receiptsRef(uid){ return firebase.firestore().collection('users').doc(uid).collection('receipts'); }
function metaRef(uid){ return firebase.firestore().collection('users').doc(uid).collection('meta').doc('settings'); }
// Ruta en Storage de una página de recibo — bajo el uid del DUEÑO del inventario
// (mismo criterio que las referencias de arriba), así que cualquier miembro del
// equipo puede leerla/escribirla igual que el resto de los datos.
function receiptPageStorageRef(uid, receiptId, pageIdx){
  return firebase.storage().ref(`users/${uid}/receipts/${receiptId}/page${pageIdx}.jpg`);
}
function recipePhotoStorageRef(uid, recipeId){
  return firebase.storage().ref(`users/${uid}/recipes/${recipeId}/photo.jpg`);
}
/* ---- Referencias para compartir un inventario entre varias cuentas (equipo) ---- */
// joinedRef vive bajo el uid de CADA cuenta (sus propias reglas de siempre aplican) y
// dice, si existe, a qué otro uid hay que mirar en vez del propio.
function joinedRef(uid){ return firebase.firestore().collection('users').doc(uid).collection('meta').doc('joined'); }
// teamRef guarda el código de invitación del dueño (solo el dueño puede leer/escribir
// esto, mismas reglas de siempre — es un doc más dentro de su propio árbol).
function teamRef(uid){ return firebase.firestore().collection('users').doc(uid).collection('meta').doc('team'); }
// membersRef vive bajo el uid del DUEÑO — cada miembro solo puede crear/borrar su
// propio documento ahí (reglas nuevas en firestore.rules), nunca el de otro.
function membersRef(ownerUid){ return firebase.firestore().collection('users').doc(ownerUid).collection('members'); }
// inviteCodes es una colección aparte a nivel raíz: el único lugar donde, dado un
// código, cualquiera logueado puede averiguar a qué uid pertenece (para poder unirse).
function inviteCodeRef(code){ return firebase.firestore().collection('inviteCodes').doc(code); }
// Historial de "quién hizo qué" en el inventario — vive bajo el mismo árbol que el
// resto de los datos del equipo, así que las reglas de siempre (dueño o miembro
// reconocido) ya la cubren sin agregar nada nuevo a firestore.rules.
function activityRef(uid){ return firebase.firestore().collection('users').doc(uid).collection('activity'); }
// Se llama desde cada punto que cambia el inventario de verdad (guardar producto,
// borrar, aplicar un recibo) — nunca bloquea ni revierte la acción principal si
// falla, es solo un registro para que el equipo vea qué pasó.
function logActivity(type, itemName, detail){
  const targetUid = syncUid();
  if(!currentUser || !targetUid) return;
  activityRef(targetUid).doc(uid('act')).set({
    type, itemName: itemName||'', detail: detail||'',
    by: currentUser.uid, byLabel: currentUserLabel(),
    at: new Date().toISOString()
  }).catch(err=>console.error('[Dusty] activity log failed:', err));
}
// Nunca cuenta los cambios que hiciste vos mismo — el numerito es para avisarte de
// lo que hizo el RESTO del equipo mientras no mirabas, no un contador de tus propias
// acciones.
function unreadActivityCount(){
  if(!currentUser || activityLog.length===0) return 0;
  return activityLog.filter(a=> a.by!==currentUser.uid && (!lastSeenActivityAt || a.at>lastSeenActivityAt)).length;
}
function openActivityModal(){
  showActivityModal = true;
  lastSeenActivityAt = new Date().toISOString();
  try{ localStorage.setItem('patron_activity_seen', lastSeenActivityAt); }catch(e){}
  render();
}
function closeActivityModal(){ showActivityModal=false; render(); }
function timeAgo(iso){
  if(!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs/60000);
  if(mins<1) return t('time_just_now');
  if(mins<60) return t('time_minutes_ago').replace('{n}', mins);
  const hours = Math.floor(mins/60);
  if(hours<24) return t('time_hours_ago').replace('{n}', hours);
  const days = Math.floor(hours/24);
  if(days<30) return t('time_days_ago').replace('{n}', days);
  return new Date(iso).toLocaleDateString(uiLang==='es'?'es-ES':'en-US', {day:'numeric', month:'short', year:'numeric'});
}
function activityVerb(entry){
  if(entry.type==='item_created') return `${t('activity_item_created')} "${escapeHtml(entry.itemName)}"`;
  if(entry.type==='item_edited') return `${t('activity_item_edited')} "${escapeHtml(entry.itemName)}"`;
  if(entry.type==='item_deleted') return `${t('activity_item_deleted')} "${escapeHtml(entry.itemName)}"`;
  // entry.detail viene de logActivity y se sincroniza desde cualquier miembro del equipo,
  // así que se escapa también en la rama scan_applied (antes solo se escapaba en las otras).
  if(entry.type==='scan_applied') return t('activity_scan_applied').replace('{n}', escapeHtml(entry.detail||''));
  if(entry.type==='note_created') return `${t('activity_note_created')} "${escapeHtml(entry.itemName)}"`;
  if(entry.type==='note_deleted') return `${t('activity_note_deleted')} "${escapeHtml(entry.itemName)}"`;
  // Producción y salidas (app-08) — itemName es la receta; detail, la cantidad.
  if(entry.type==='production') return `${t('activity_production').replace('{n}', escapeHtml(entry.detail||''))} "${escapeHtml(entry.itemName)}"`;
  if(entry.type==='stock_adjust') return t('activity_stock_adjust').replace('{n}', escapeHtml(entry.detail||''));
  if(entry.type==='recipe_created') return `${t('activity_recipe_created')} "${escapeHtml(entry.itemName)}"`;
  if(entry.type==='recipe_edited') return `${t('activity_recipe_edited')} "${escapeHtml(entry.itemName)}"`;
  if(entry.type==='recipe_deleted') return `${t('activity_recipe_deleted')} "${escapeHtml(entry.itemName)}"`;
  return escapeHtml(entry.detail||'');
}

/* El base64 de las fotos NUNCA se manda a Firestore — un recibo de varias páginas
   puede pesar más que el límite de 1MB por documento. Las fotos se suben aparte a
   Firebase Storage (ver uploadReceiptImages) y acá solo viajan las referencias ya
   subidas ({url, mediaType, path} — nunca base64). Una página que todavía no
   terminó de subirse (o que este dispositivo no pudo subir por estar offline)
   simplemente no viaja todavía — no bloquea guardar el resto del recibo, y la
   subida se reintenta sola en la próxima conexión (ver catchUpReceiptPhotoUploads). */
function receiptForCloud(r){
  const copy = Object.assign({}, r);
  const uploaded = (Array.isArray(r.images) ? r.images : []).filter(img=>img.url).map(img=>({url:img.url, mediaType:img.mediaType, path:img.path}));
  copy.images = uploaded;
  delete copy.imageBase64;
  delete copy.mediaType;
  return copy;
}

/* Sube cada página en base64 de un recibo a Storage y, cuando TODAS terminaron,
   guarda las referencias en el doc de Firestore de ese recibo (nunca antes de que
   terminen todas juntas — evita que el doc quede con solo la mitad de las páginas
   si el usuario cierra la app a mitad de la subida). Se llama sin esperar su
   resultado (fire-and-forget) — si falla, el recibo sigue funcionando perfecto en
   este dispositivo (tiene el base64 local) y la próxima conexión reintenta subir
   lo que falte, ver catchUpReceiptPhotoUploads(). */
async function uploadReceiptImages(receipt){
  const uid = syncUid();
  if(!uid || !currentUser) return;
  const pages = receiptImages(receipt);
  if(pages.length===0) return;
  try{
    const uploadedImages = await Promise.all(pages.map(async (img, idx)=>{
      if(img.url) return {url:img.url, mediaType:img.mediaType, path:img.path}; // ya estaba subida
      if(!img.base64) return null; // página sin base64 ni url todavía (no debería pasar, pero no rompe nada)
      const ref = receiptPageStorageRef(uid, receipt.id, idx);
      await ref.putString(img.base64, 'base64', {contentType: img.mediaType || 'image/jpeg'});
      const url = await ref.getDownloadURL();
      img.url = url; img.path = ref.fullPath; // el objeto local también gana la referencia, sin perder el base64
      return {url, mediaType: img.mediaType, path: ref.fullPath};
    }));
    if(uploadedImages.some(u=>!u)) return; // alguna página no se pudo subir todavía, no guardamos a medias
    // Clave para recibos del formato viejo (una sola imageBase64, sin array "images"):
    // receiptImages(receipt) les arma un array TEMPORAL nuevo (no una referencia a
    // receipt.images, que no existe), así que mutar sus items de arriba no alcanza.
    // Sin esta línea, el objeto local "receipt" seguía sin campo "images", y el próximo
    // syncAllToFirestore() (disparado por cualquier cambio no relacionado) volvía a
    // calcular "images: []" para este mismo recibo vía receiptForCloud() y lo pisaba
    // con un .set() sin merge — borrando la URL recién subida en la nube.
    //
    // Se asigna "pages" (los objetos originales, que conservan su base64 y ganaron
    // url/path en el map de arriba) y NO "uploadedImages" (las copias limpias que
    // van a Firestore): asignar las copias limpias tiraba el base64 local apenas
    // terminaba la subida, y las fotos que este mismo dispositivo escaneó pasaban
    // a depender de la red — justo lo que receiptImageSrc() ("el base64 local
    // siempre gana") promete evitar. A Firestore sigue viajando solo la versión
    // sin base64 (receiptForCloud y el set de abajo usan uploadedImages).
    receipt.images = pages;
    // Con el array "images" ya armado, la foto suelta del formato viejo queda
    // redundante — borrarla evita guardar el mismo base64 DOS veces en localStorage
    // (con fotos de varios MB, es la diferencia entre entrar o no en la cuota).
    delete receipt.imageBase64;
    delete receipt.mediaType;
    // Si el usuario borró este recibo mientras las fotos estaban subiendo (subida lenta con
    // mala señal), NO lo recreamos: un .set con merge:true sobre un doc borrado lo revive
    // como recibo fantasma (solo el campo images, sin id/fecha/total) — y ese fantasma sin
    // id es justo lo que rompía la sincronización entera. Si ya no está local ni tiene
    // lápida vigente, se borran también las fotos recién subidas para no dejar huérfanas.
    if(deletedReceiptIds.includes(receipt.id) || !receipts.some(x=>x.id===receipt.id)){
      uploadedImages.forEach(u=>{ if(u && u.path) firebase.storage().ref(u.path).delete().catch(()=>{}); });
      return;
    }
    // Persistir las url/path recién ganadas: como ahora las páginas conservan su
    // base64 para siempre, si estas referencias no llegan a localStorage el próximo
    // arranque vería "base64 sin url" y catchUpReceiptPhotoUploads() volvería a
    // subir TODAS las fotos en cada apertura de la app.
    saveState();
    await receiptsRef(uid).doc(receipt.id).set({images: uploadedImages}, {merge:true});
  }catch(err){
    console.error('[Dusty] no se pudieron subir las fotos del recibo '+receipt.id+' (se reintenta en la próxima conexión):', err);
  }
}

/* Se llama una sola vez apenas se conectan los listeners de Firestore. Encuentra
   recibos que este dispositivo ya tiene con fotos en base64 pero que la nube
   todavía no tiene con URL (recibos escaneados antes de que existiera esta función,
   o una subida que falló la vez pasada) y los vuelve a intentar subir. */
function catchUpReceiptPhotoUploads(){
  receipts.forEach(r=>{
    const pages = receiptImages(r);
    if(pages.length>0 && pages.some(img=>img.base64 && !img.url)){
      uploadReceiptImages(r);
    }
  });
}

/* ---- Fotos de recetas: mismo tratamiento que las fotos de recibos ----
   El base64 de la foto de una receta (~15-25KB el thumbnail de 300px) viajaba
   DENTRO del doc meta de Firestore: con 40-60 recetas con foto, el doc pisaba el
   límite de 1MB y el batch entero fallaba para siempre (sync muerto y silencioso —
   el mismo modo de falla que ya se arregló para las fotos de recibos moviéndolas
   a Storage). Ahora la foto se sube a Storage y por meta viajan solo las
   referencias {url, mediaType, path}; el base64 se queda en ESTE dispositivo
   (instantáneo y offline) y los demás la ven por url. */
function stripRecipePhotoForCloud(r){
  if(!r || !r.photo) return r;
  const copy = Object.assign({}, r);
  // Sin url todavía (recién creada, o la subida no terminó): la foto simplemente
  // no viaja aún — la receta sí. La subida pendiente la reintenta
  // catchUpRecipePhotoUploads() en la próxima conexión.
  copy.photo = r.photo.url ? { url: r.photo.url, mediaType: r.photo.mediaType || null, path: r.photo.path || null } : null;
  return copy;
}
function recipesForCloud(list){
  return (list || recipes).map(stripRecipePhotoForCloud);
}
async function uploadRecipePhoto(recipe){
  const uid = syncUid();
  if(!uid || !currentUser || !recipe || !recipe.photo || !recipe.photo.base64 || recipe.photo.url) return;
  try{
    const ref = recipePhotoStorageRef(uid, recipe.id);
    await ref.putString(recipe.photo.base64, 'base64', {contentType: recipe.photo.mediaType || 'image/jpeg'});
    const url = await ref.getDownloadURL();
    // El objeto local gana la referencia SIN perder su base64 (mismo criterio que
    // uploadReceiptImages) — y si la receta se borró mientras subía, no se revive:
    // solo se limpia el archivo recién subido.
    if(deletedRecipeIds.includes(recipe.id) || !recipes.some(x=>x.id===recipe.id)){
      ref.delete().catch(()=>{});
      return;
    }
    recipe.photo.url = url; recipe.photo.path = ref.fullPath;
    saveState(); // persiste la url y re-sincroniza meta (ahora la foto viaja como referencia)
  }catch(e){
    console.warn('[Dusty] no se pudo subir la foto de la receta (se reintenta al reconectar):', e);
  }
}
function catchUpRecipePhotoUploads(){
  recipes.forEach(r=>{ if(r && r.photo && r.photo.base64 && !r.photo.url) uploadRecipePhoto(r); });
}

let cloudSyncDirty = false;
let cloudSyncDebounceTimer = null;
// Reintento con backoff exponencial cuando syncAllToFirestore() falla (ver más abajo):
// arranca en 2s y se duplica en cada fallo consecutivo hasta un tope de 60s, y se
// resetea apenas un intento vuelve a tener éxito.
let cloudSyncRetryTimer = null;
let cloudSyncRetryDelayMs = 2000;
const CLOUD_SYNC_RETRY_MAX_MS = 60000;
// Deletes "por las dudas" (lápidas nunca vistas en un snapshot) ya mandados en esta
// sesión — ver syncAllToFirestore.
const firedTombstoneDeletes = new Set();
let applyingRemoteSnapshot = false;
// true desde que arranca la app hasta que la primera reconexión a la nube de ESTA
// carga de página termina (con éxito o con error) -- solo se pone en true para
// empezar si este navegador ya había tenido sesión antes (ver el arranque, al final
// del archivo), porque ahí SÍ hay datos en la nube por los que vale la pena esperar
// antes de decidir que el inventario está vacío. Mientras esto es true, la pantalla
// de "no tenés productos todavía" no se muestra aunque inventory.length sea 0 en ese
// instante -- se ve una pantalla de carga en su lugar. Sin esto, si el primer
// snapshot de Firestore tarda un poco más que el resto del arranque, el usuario veía
// (aunque fuera un instante) su inventario real reemplazado por el cartel de "vacío",
// que da la impresión de que se borró todo cuando en realidad nunca se tocó nada.
let cloudSyncPending = false;
let unsubInventory = null, unsubPurchases = null, unsubReceipts = null, unsubMeta = null;
let lastKnownRemoteInventoryIds = null, lastKnownRemotePurchaseIds = null, lastKnownRemoteReceiptIds = null;

/* ===== PLAN-SYNC etapas A/B/C/E: detección de cambios por hash =====
   lastSyncedHashes es un ESPEJO de lo que la nube tiene, hash por documento (más
   uno para el doc de meta): se actualiza al confirmar cada subida y al recibir cada
   snapshot. "¿Este doc tiene una edición local sin subir?" pasa a ser una pregunta
   local y barata: hash(doc actual) !== hash guardado. Sobre esa primitiva se apoyan:
   - B: syncAllToFirestore sube SOLO los docs cuyo hash difiere (antes reescribía
     las 3 colecciones completas en cada guardado — el "último en escribir gana
     sobre TODO" que pisaba las ediciones de un compañero de equipo).
   - C: el reconcile compara por contenido+sello, no solo por id faltante.
   - E: un snapshot se aplica doc por doc — lo remoto entra salvo en los docs con
     edición local pendiente, que ganan (y se suben enseguida).
   Se persiste en localStorage (unos bytes por doc) para que una edición hecha
   200ms antes de que el SO mate la app siga detectándose como pendiente en el
   próximo arranque — eso cierra la ventana del debounce de 400ms.
   El plan original proponía marcar dirty a mano en cada punto de mutación
   (markDirty en ~4 call sites); se eligió el diff por hash a propósito: la
   historia reciente de este codebase ("agregué un campo y me olvidé de uno de los
   5 escritores") demuestra que las listas manuales de call sites se desactualizan.
   El diff cubre TODOS los caminos de mutación, presentes y futuros, sin lista. */
const SYNCED_HASHES_KEY = 'patron_synced_hashes_v1';
let lastSyncedHashes = { inventory:{}, purchases:{}, receipts:{}, meta:null };
try{
  const rawHashes = localStorage.getItem(SYNCED_HASHES_KEY);
  if(rawHashes) lastSyncedHashes = Object.assign({inventory:{}, purchases:{}, receipts:{}, meta:null}, JSON.parse(rawHashes));
}catch(e){}
function persistSyncedHashes(){
  try{ localStorage.setItem(SYNCED_HASHES_KEY, JSON.stringify(lastSyncedHashes)); }catch(e){}
}
/* DES-ENTIERRO pendiente (restaurar un backup): con las lápidas por unión (etapa D)
   quitar una lápida local no alcanza — la copia de la nube la re-agrega en el
   próximo snapshot y el doc restaurado se re-borra solo. Al importar un backup se
   anotan acá los ids restaurados; la unión de lectura los saltea, y el próximo
   sync manda un arrayRemove por esos ids (se limpia al confirmar). Persistido para
   sobrevivir un cierre entre el import y la subida. */
const PENDING_UNTOMBSTONE_KEY = 'patron_pending_untombstone_v1';
let pendingUntombstone = { deletedInventoryIds:[], deletedReceiptIds:[], deletedPurchaseIds:[], deletedCalNoteIds:[], deletedRecipeIds:[] };
try{
  const rawPU = localStorage.getItem(PENDING_UNTOMBSTONE_KEY);
  if(rawPU) pendingUntombstone = Object.assign({ deletedInventoryIds:[], deletedReceiptIds:[], deletedPurchaseIds:[], deletedCalNoteIds:[], deletedRecipeIds:[] }, JSON.parse(rawPU));
}catch(e){}
function persistPendingUntombstone(){
  try{ localStorage.setItem(PENDING_UNTOMBSTONE_KEY, JSON.stringify(pendingUntombstone)); }catch(e){}
}
function markRestoredIds(map){
  Object.keys(map).forEach(k=>{
    if(!pendingUntombstone[k]) return;
    const set = new Set(pendingUntombstone[k]);
    (map[k]||[]).forEach(id=>{ if(id) set.add(id); });
    pendingUntombstone[k] = Array.from(set);
  });
  persistPendingUntombstone();
}
function isUntombstonePending(field, id){
  return pendingUntombstone[field] && pendingUntombstone[field].includes(id);
}
// En toda transición de árbol de datos (cambio de cuenta, unirse/salir de un equipo)
// el espejo deja de valer: se resetea junto con el resto del estado local.
function resetSyncedHashes(){
  lastSyncedHashes = { inventory:{}, purchases:{}, receipts:{}, meta:null };
  lastSaveContentHashes = null;
  firedTombstoneDeletes.clear();
  pendingUntombstone = { deletedInventoryIds:[], deletedReceiptIds:[], deletedPurchaseIds:[], deletedCalNoteIds:[], deletedRecipeIds:[] };
  persistPendingUntombstone();
  persistSyncedHashes();
}
// La forma que viaja a la nube es la que se hashea (para recibos, sin base64 — igual
// que receiptForCloud) — así el hash local y el del doc remoto son comparables.
function docCloudForm(kind, doc){
  return kind==='receipts' ? receiptForCloud(doc) : doc;
}
function docSyncHash(kind, doc){
  return valueHash(docCloudForm(kind, doc));
}
function isDocDirty(kind, doc){
  return lastSyncedHashes[kind][doc.id] !== docSyncHash(kind, doc);
}
// La FORMA canónica del contenido de meta que se compara/hashea — mismos campos
// que escribe syncAllToFirestore (lápidas incluidas: un borrado nuevo también es
// un cambio de meta que hay que subir). Recibe la fuente para poder hashear tanto
// el contenido LOCAL (metaCloudContent) como un doc REMOTO crudo con la misma
// forma; los defaults igualan "campo ausente" con "vacío" en ambos lados.
function metaContentShape(m){
  return {
    aliasMap: m.aliasMap || {},
    priceAlertThreshold: m.priceAlertThreshold, cycleCountPct: m.cycleCountPct,
    cycleCountIntervalDays: m.cycleCountIntervalDays, cycleCountLastDate: m.cycleCountLastDate,
    cycleCountCursor: m.cycleCountCursor, businessName: m.businessName, monthlyBudget: m.monthlyBudget,
    profitsVisibleToMembers: m.profitsVisibleToMembers === true,
    categories: m.categories,
    calNotes: m.calNotes || [], recipes: m.recipes || [], outflows: m.outflows || [],
    deletedInventoryIds: m.deletedInventoryIds || [], deletedReceiptIds: m.deletedReceiptIds || [],
    deletedPurchaseIds: m.deletedPurchaseIds || [], deletedCalNoteIds: m.deletedCalNoteIds || [],
    deletedRecipeIds: m.deletedRecipeIds || []
  };
}
function metaCloudContent(){
  return metaContentShape({
    aliasMap, priceAlertThreshold, cycleCountPct, cycleCountIntervalDays, cycleCountLastDate, cycleCountCursor,
    businessName, monthlyBudget, profitsVisibleToMembers, categories, calNotes,
    recipes: recipesForCloud(), outflows,
    deletedInventoryIds, deletedReceiptIds, deletedPurchaseIds, deletedCalNoteIds, deletedRecipeIds
  });
}

/* ETAPA A: sellar cada edición local con cuándo y quién. Se llama desde saveState()
   (app-03) ANTES de persistir: cualquier doc cuyo contenido cambió respecto del
   guardado anterior gana updatedAt/updatedBy — el desempate que usa la etapa C para
   decidir qué versión gana al reconciliar. El sello compara contra el estado del
   ÚLTIMO saveState (no contra la nube): un doc puede quedar dirty muchos guardados
   seguidos mientras la subida espera, y re-sellarlo en cada uno le daría a una
   edición vieja un sello siempre-fresco que ganaría conflictos que no debe ganar.
   El propio sello se excluye del contenido comparado (si no, sellar = cambiar). */
let lastSaveContentHashes = null; // null = todavía no se pobló (primera pasada: solo poblar, sin sellar)
function docContentHash(kind, doc){
  const form = Object.assign({}, docCloudForm(kind, doc));
  delete form.updatedAt; delete form.updatedBy;
  return valueHash(form);
}
function stampLocalEdits(){
  // La línea base se refresca en TODOS los guardados; el sello solo se aplica cuando
  // el cambio es una edición local de verdad. Dos casos "solo poblar, sin sellar":
  // - la primera pasada (la línea base todavía no existe: viene de loadState, y lo
  //   cargado no es una edición nueva), y
  // - los guardados disparados por aplicar un snapshot remoto (si acá no se
  //   refrescara la base, el próximo guardado local vería TODOS los docs remotos
  //   como "cambiados" y los sellaría/subiría en masa como si fueran ediciones).
  const populateOnly = lastSaveContentHashes === null || applyingRemoteSnapshot;
  if(lastSaveContentHashes === null) lastSaveContentHashes = { inventory:{}, purchases:{}, receipts:{} };
  const stamp = new Date().toISOString();
  const by = (typeof currentUser!=='undefined' && currentUser) ? currentUser.uid : 'local';
  [['inventory', inventory], ['purchases', purchases], ['receipts', receipts]].forEach(([kind, arr])=>{
    const seen = {};
    arr.forEach(doc=>{
      if(!doc || !doc.id) return;
      const h = docContentHash(kind, doc);
      seen[doc.id] = h;
      if(!populateOnly && lastSaveContentHashes[kind][doc.id] !== h){
        doc.updatedAt = stamp;
        doc.updatedBy = by;
      }
    });
    lastSaveContentHashes[kind] = seen;
  });
}

// Se llama desde saveState() cada vez que cambia algo. Si no hay sesión iniciada,
// o si el cambio vino de aplicar un snapshot remoto (no de una edición real del
// usuario), no hace nada.
function scheduleCloudSync(){
  if(!currentUser || applyingRemoteSnapshot) return;
  cloudSyncDirty = true;
  clearTimeout(cloudSyncDebounceTimer);
  // Un cambio nuevo reemplaza cualquier reintento por fallo que hubiera quedado
  // pendiente (ver syncAllToFirestore) — el debounce de abajo ya va a mandar una
  // versión más actualizada de los datos.
  clearTimeout(cloudSyncRetryTimer);
  cloudSyncDebounceTimer = setTimeout(syncAllToFirestore, 400);
}
// Firestore no deja más de 500 operaciones en un mismo "batch". Antes esta función
// metía TODO el inventario + todas las compras + todos los recibos en un solo batch
// cada vez que se guardaba cualquier cosa — en una cuenta con bastante uso real (todo
// junto pasando de 500), la sincronización se rompía por completo y en silencio (el
// error solo quedaba en la consola, invisible para el usuario). Ahora se arma la lista
// completa de operaciones primero, y se reparte en tantos batches de a 450 (margen de
// sobra) como hagan falta, commiteados todos juntos.
function syncAllToFirestore(){
  if(!currentUser){ cloudSyncDirty = false; return Promise.resolve(); }
  const uid = syncUid();
  try{
    /* ETAPA B del PLAN-SYNC: escrituras POR DOCUMENTO. Antes esto metía en el batch
       TODOS los docs de las 3 colecciones en cada guardado ("último en escribir gana
       sobre todo"): dos miembros editando cosas distintas a la vez → el commit más
       tardío pisaba el doc del otro. Ahora solo viajan los docs cuyo hash difiere
       del espejo de la nube (ver lastSyncedHashes) — un doc que no tocaste no se
       escribe nunca, así que no puede pisar la edición de nadie. Los deletes también
       se acotan: solo ids con lápida que la nube todavía conoce (espejo o último
       snapshot), en vez de re-mandar toda la lista de lápidas en cada guardado. */
    const ops = [];
    const collections = [
      ['inventory', inventory, inventoryRef, deletedInventoryIds, lastKnownRemoteInventoryIds],
      ['purchases', purchases, purchasesRef, deletedPurchaseIds, lastKnownRemotePurchaseIds],
      ['receipts',  receipts,  receiptsRef,  deletedReceiptIds,  lastKnownRemoteReceiptIds]
    ];
    collections.forEach(([kind, arr, refFn, deletedIds, lastKnownIds])=>{
      const presentIds = {};
      // El guard "!doc.id" es clave (recibos fantasma): doc(undefined) tira una
      // excepción síncrona que dejaba cloudSyncDirty en true para SIEMPRE.
      arr.forEach(doc=>{
        if(!doc || !doc.id) return;
        presentIds[doc.id] = true;
        const h = docSyncHash(kind, doc);
        if(lastSyncedHashes[kind][doc.id] === h) return; // sin cambios: no viaja
        ops.push({kind, id:doc.id, hash:h, ref:refFn(uid).doc(doc.id), data:JSON.parse(JSON.stringify(docCloudForm(kind, doc)))});
      });
      // Borrados: cualquier id que la nube conoce (espejo o último snapshot) y que
      // localmente ya no está — cubre lápidas nuevas y el doc duplicado de un remap.
      const knownRemote = new Set(Object.keys(lastSyncedHashes[kind]));
      (lastKnownIds || []).forEach(id=>{ if(id) knownRemote.add(id); });
      knownRemote.forEach(id=>{
        // El guard de id falsy es el mismo de los recibos fantasma: doc(undefined)
        // tira una excepción síncrona que deja el sync muerto para siempre.
        if(!id || presentIds[id]) return;
        ops.push({kind, id, del:true, ref:refFn(uid).doc(id)});
      });
      // Y lápidas que la nube podría tener sin que este dispositivo lo sepa aún
      // (borrado antes del primer snapshot de la sesión): mismo resguardo de antes,
      // pero solo para ids que no acabamos de cubrir, y una sola vez por sesión
      // (firedTombstoneDeletes) — son deletes "por las dudas", no hay eco que los
      // confirme y sin el dedupe se re-mandarían en cada guardado para siempre.
      deletedIds.forEach(id=>{
        if(!id || presentIds[id] || knownRemote.has(id) || firedTombstoneDeletes.has(kind+':'+id)) return;
        firedTombstoneDeletes.add(kind+':'+id);
        ops.push({kind, id, del:true, ref:refFn(uid).doc(id)});
      });
    });
    /* ETAPA D del PLAN-SYNC: las lápidas se escriben por UNIÓN (arrayUnion), nunca
       por reemplazo. Antes viajaban como array completo dentro del set de meta: dos
       borrados simultáneos en dispositivos distintos → el commit más tardío escribía
       su array local SIN el borrado del otro → un tercer dispositivo offline
       resucitaba el producto borrado. Con arrayUnion cada dispositivo solo SUMA sus
       lápidas y ninguna puede desaparecer por una carrera.
       El resto de campos viaja en el mismo set con {merge:true}: los arrays
       (calNotes/recipes/outflows/categories) se REEMPLAZAN igual que antes — merge
       solo cambia la semántica de los mapas, y el único mapa (aliasMap) solo
       agrega/actualiza claves, nunca las borra, así que merge le es equivalente.
       Los sentinels de arrayUnion se agregan DESPUÉS del JSON.parse(JSON.stringify)
       (ese round-trip los destruiría), y solo si el array tiene algo (arrayUnion
       exige al menos un elemento). */
    // Meta: solo viaja si su contenido cambió (mismo criterio por hash que los docs).
    const metaContent = metaCloudContent();
    const metaHash = valueHash(metaContent);
    if(lastSyncedHashes.meta !== metaHash){
      const metaData = JSON.parse(JSON.stringify({
        aliasMap, priceAlertThreshold, cycleCountPct, cycleCountIntervalDays, cycleCountLastDate, cycleCountCursor, businessName, monthlyBudget, profitsVisibleToMembers, categories, calNotes,
        recipes: recipesForCloud(), outflows
      }));
      const FV = firebase.firestore.FieldValue;
      [['deletedInventoryIds',deletedInventoryIds], ['deletedReceiptIds',deletedReceiptIds], ['deletedPurchaseIds',deletedPurchaseIds], ['deletedCalNoteIds',deletedCalNoteIds], ['deletedRecipeIds',deletedRecipeIds]]
        .forEach(([k,arr])=>{ if(Array.isArray(arr) && arr.length>0) metaData[k] = FV.arrayUnion.apply(FV, arr); });
      ops.push({ref:metaRef(uid), data: metaData, merge:true, metaHash});
    }
    // Des-entierro pendiente (restaurar backup): un segundo write sobre meta con
    // arrayRemove de los ids restaurados. Va DESPUÉS del write principal en el
    // mismo batch — Firestore aplica los writes en orden, así que el remove gana
    // sobre cualquier union del write anterior para esos ids.
    const untombstoneFields = {};
    let hasUntombstone = false;
    Object.keys(pendingUntombstone).forEach(k=>{
      const ids = pendingUntombstone[k];
      if(Array.isArray(ids) && ids.length>0){
        const FV2 = firebase.firestore.FieldValue;
        untombstoneFields[k] = FV2.arrayRemove.apply(FV2, ids);
        hasUntombstone = true;
      }
    });
    if(hasUntombstone){
      ops.push({ref:metaRef(uid), data: untombstoneFields, merge:true, untombstone:true});
    }

    // Nada que subir (guardado que no cambió nada sincronizable): listo sin escribir.
    if(ops.length===0){
      cloudSyncDirty = false;
      clearTimeout(cloudSyncRetryTimer);
      cloudSyncRetryDelayMs = 2000;
      render();
      return Promise.resolve();
    }

    const CHUNK = 450;
    const commits = [];
    for(let i=0; i<ops.length; i+=CHUNK){
      const batch = firebase.firestore().batch();
      ops.slice(i, i+CHUNK).forEach(op=>{
        if(op.del) batch.delete(op.ref);
        else if(op.merge) batch.set(op.ref, op.data, {merge:true});
        else batch.set(op.ref, op.data);
      });
      commits.push(batch.commit());
    }
    return Promise.all(commits).then(()=>{
      // Actualizar el espejo con lo que ACABAMOS de escribir — un doc editado de
      // nuevo mientras el commit volaba difiere de este hash y sigue dirty, así que
      // el próximo guardado (ya agendado por su propio saveState) lo re-sube.
      ops.forEach(op=>{
        if(op.metaHash !== undefined){ lastSyncedHashes.meta = op.metaHash; return; }
        if(!op.kind) return;
        if(op.del) delete lastSyncedHashes[op.kind][op.id];
        else lastSyncedHashes[op.kind][op.id] = op.hash;
      });
      // El arrayRemove del des-entierro llegó a la nube: la lista pendiente se
      // limpia. (Alcance honesto: esto restaura del todo en ESTE dispositivo y en
      // los que nunca vieron la lápida; un dispositivo que aún la tenga local la
      // re-subirá por unión — deshacer eso del todo pediría lápidas versionadas.)
      if(ops.some(op=>op.untombstone)){
        pendingUntombstone = { deletedInventoryIds:[], deletedReceiptIds:[], deletedPurchaseIds:[], deletedCalNoteIds:[], deletedRecipeIds:[] };
        persistPendingUntombstone();
      }
      persistSyncedHashes();
      cloudSyncDirty = false;
      clearTimeout(cloudSyncRetryTimer);
      cloudSyncRetryDelayMs = 2000;
      // Vuelve a dibujar para que el ícono de la nube deje de mostrarse "pendiente" ya
      // mismo, en vez de esperar a que el eco del snapshot en tiempo real dispare su
      // propio redibujado (que puede tardar un rato largo con mala señal).
      render();
    }).catch(err=>{
      onCloudSyncWriteFailed(err);
      throw err;
    });
  }catch(err){
    onCloudSyncWriteFailed(err);
    return Promise.reject(err);
  }
}
// Si la subida falla, cloudSyncDirty se deja en true a propósito: los handlers de
// applyRemote*Snapshot() de más abajo lo revisan antes de aceptar un snapshot, así
// que mientras siga en true un cambio remoto (de otro dispositivo, o el eco viejo de
// esta misma cuenta) no puede pisar una edición local que todavía no llegó a la nube.
// - Si el error es "perdí el acceso" (alguien nos sacó del equipo), no tiene sentido
//   reintentar contra un inventario al que ya no podemos escribir: se reutiliza el
//   mismo manejador que ya usan los listeners en tiempo real para volver a la cuenta
//   propia.
// - Para cualquier otro error (sin red, Firestore caído, etc.) se reintenta solo,
//   con backoff exponencial, hasta que un intento tenga éxito.
function onCloudSyncWriteFailed(err){
  console.error('[Dusty] cloud sync failed:', err);
  // El desvío a "volver a la cuenta propia" solo tiene sentido siendo MIEMBRO de
  // un equipo (te expulsaron). Un permission-denied escribiendo en el árbol
  // PROPIO (regla mal desplegada, token con reloj corrido) caía en un handler
  // que no hace nada y, como tampoco se agendaba reintento, el sync quedaba
  // muerto para toda la sesión — ahora reintenta con el backoff normal.
  if(err && err.code==='permission-denied' && joinedOwnerUid){ handleSyncPermissionDenied(err); return; }
  clearTimeout(cloudSyncRetryTimer);
  cloudSyncRetryTimer = setTimeout(()=>{ if(cloudSyncDirty) syncAllToFirestore(); }, cloudSyncRetryDelayMs);
  cloudSyncRetryDelayMs = Math.min(cloudSyncRetryDelayMs*2, CLOUD_SYNC_RETRY_MAX_MS);
}

/* Cada handler ignora dos cosas: el eco de la propia escritura de este cliente
   (hasPendingWrites) y cualquier snapshot que llegue mientras hay un cambio local
   recién hecho todavía subiéndose (cloudSyncDirty) — sin esto, un cambio remoto
   podría pisar un cambio local que todavía no terminó de sincronizarse. */
/* Firestore entrega el snapshot inicial DOS veces al reconectar (recargar la página,
   volver de segundo plano, etc.): una desde el caché local casi al instante, otra
   desde el servidor un rato después — aunque los datos sean exactamente los mismos.
   El debounce de scheduleCloudTriggeredRender() junta redibujados que llegan pegados
   en el tiempo, pero el viaje de ida y vuelta al servidor casi siempre tarda más que
   esa ventana, así que las dos llegadas terminan disparando dos redibujados
   completos igual — cada uno reconstruye TODO #app de cero, fotos incluidas (ver
   nota en render()). Eso es lo que se siente como que el calendario de recibos
   "tiembla" o las fotos desaparecen y vuelven al refrescar: no cambió nada, pero se
   redibuja como si hubiera cambiado. Comparar contra lo que ya está en pantalla
   evita el redibujado (y el parpadeo) cuando en verdad no hay nada nuevo.
   sameJSON ahora vive en patron-core.js (ordena las claves antes de comparar —
   Firestore no garantiza devolver los campos de un doc en el mismo orden en que se
   escribieron, así que un JSON.stringify ingenuo daba "distinto" con los mismos datos
   y disparaba este redibujado igual). */
function applyRemoteInventorySnapshot(snapshot){
  if(snapshot.metadata.hasPendingWrites) return;
  // Este es el primer dato de inventario que de verdad vino de Firestore desde que
  // arrancó la página (o el único momento en que sabemos con certeza que la nube
  // realmente no tiene nada) -- recién acá es seguro confiar en inventory.length
  // para decidir si mostrar el cartel de "no tenés productos todavía".
  cloudSyncPending = false;
  lastKnownRemoteInventoryIds = snapshot.docs.map(d=>d.id);
  mergeRemoteCollection('inventory', snapshot, ()=>inventory, next=>{ inventory = next; });
}
function applyRemotePurchasesSnapshot(snapshot){
  if(snapshot.metadata.hasPendingWrites) return;
  lastKnownRemotePurchaseIds = snapshot.docs.map(d=>d.id);
  mergeRemoteCollection('purchases', snapshot, ()=>purchases, next=>{ purchases = next; });
}
function applyRemoteReceiptsSnapshot(snapshot){
  if(snapshot.metadata.hasPendingWrites) return;
  lastKnownRemoteReceiptIds = snapshot.docs.map(d=>d.id);
  mergeRemoteCollection('receipts', snapshot, ()=>receipts, next=>{ receipts = next; }, (remote, local)=>{
    // Si este dispositivo ya tiene las fotos de este recibo en base64 (las escaneó
    // él mismo), las conserva — es instantáneo y no depende de la red. Si no, usa
    // las URLs de Storage que vienen en el doc remoto.
    remote.images = (local && local.images && local.images.length>0) ? local.images : (remote.images || []);
    return remote;
  });
}
/* ETAPA E del PLAN-SYNC: el snapshot se aplica DOC POR DOC en vez de descartarse
   entero mientras había una subida pendiente (eso descartaba también lo que traía
   de los compañeros — la mitad del "se me borró lo que cargué"). Regla por doc:
   - doc remoto SIN edición local pendiente → entra (aunque cloudSyncDirty sea true);
   - doc remoto CON edición local pendiente (dirty) → gana lo local, que se sube
     enseguida (su guardado ya agendó el sync);
   - doc local que la nube conocía (está en el espejo) y ya no vino, sin edición
     pendiente → lo borraron remotamente, se va; con edición pendiente o nunca
     sincronizado → se queda (edición gana a borrado; la lápida real, si existe,
     llega por meta y lo filtra igual).
   El espejo de hashes se reconstruye con lo que la nube ACABA de mostrar — así
   "dirty" siempre significa "difiere de la nube", que es la única definición que
   no se desactualiza. Los docs con lápida local no entran nunca (último resguardo
   de siempre). */
function mergeRemoteCollection(kind, snapshot, getLocal, setLocal, preserveFn){
  applyingRemoteSnapshot = true;
  const localArr = getLocal();
  const deletedIds = { inventory: deletedInventoryIds, purchases: deletedPurchaseIds, receipts: deletedReceiptIds }[kind];
  const localById = {};
  localArr.forEach(l=>{ if(l && l.id) localById[l.id] = l; });
  const remoteById = {};
  const newHashes = {};
  const next = [];
  snapshot.docs.forEach(d=>{
    const remote = d.data();
    if(!remote || !remote.id) return; // fantasma sin id: ni se muestra ni entra al espejo
    remoteById[remote.id] = remote;
    newHashes[remote.id] = docSyncHash(kind, remote);
    if(deletedIds.includes(remote.id)) return; // lápida local: nunca vuelve a mostrarse
    const local = localById[remote.id];
    if(local && isDocDirty(kind, local)){
      // Edición local pendiente: gana... salvo que AMBOS lados tengan sello y el
      // remoto sea estrictamente más nuevo — mismo criterio que localWins() en el
      // reconcile. Sin este chequeo, un "dirty" espurio (espejo y estado
      // desalineados en disco por un guardado fallido a mitad de camino) hacía que
      // un dispositivo que nunca editó el doc revirtiera en la nube la edición más
      // nueva de un compañero.
      const l = String(local.updatedAt||''), r = String(remote.updatedAt||'');
      if(l && r && r > l){
        next.push(preserveFn ? preserveFn(remote, local) : remote);
      } else {
        next.push(local); // se sube enseguida (sigue dirty contra el espejo nuevo)
      }
      return;
    }
    next.push(preserveFn ? preserveFn(remote, local) : remote);
  });
  localArr.forEach(local=>{
    if(!local || !local.id || remoteById[local.id]) return;
    if(deletedIds.includes(local.id)) return;
    const cloudKnewIt = lastSyncedHashes[kind][local.id] !== undefined;
    if(!cloudKnewIt || isDocDirty(kind, local)) next.push(local);
  });
  // El estado se persiste ANTES que el espejo — si el proceso muere entre los dos
  // escritos, quedar con "estado nuevo + espejo viejo" solo causa una re-subida
  // inofensiva; el orden inverso (espejo nuevo + estado viejo) era justo la
  // desalineación que armaba el escenario de reversión de arriba.
  if(!sameJSON(next, localArr)){
    setLocal(next);
    saveState(); scheduleCloudTriggeredRender();
  }
  lastSyncedHashes[kind] = newHashes;
  persistSyncedHashes();
  applyingRemoteSnapshot = false;
}
function applyRemoteMetaSnapshot(doc){
  if(doc.metadata.hasPendingWrites || cloudSyncDirty || !doc.exists) return;
  // Mismo problema que ya se arregló en los otros 3 listeners (inventario/compras/
  // recibos) pero se había quedado afuera acá: el doc de "meta" también llega DOS
  // veces al reconectar (caché, después servidor) aunque no haya cambiado nada real.
  // En el celular esto pasa mucho más seguido que en una computadora — el sistema
  // operativo corta la conexión de Firestore apenas la app pasa a segundo plano
  // (cambiar de app, apagar la pantalla), así que CADA vez que se vuelve a esta app
  // se dispara una reconexión con sus dos entregas. Sin este chequeo, ese redibujado
  // de más reconstruía #app entero (fotos del calendario de recibos incluidas) cada
  // vez, aunque este handler ni siquiera toca receipts — eso es lo que se sentía como
  // que las fotos "parpadean" solo en el celular y solo al volver/refrescar.
  const incomingMeta = doc.data();
  /* El espejo de meta se calcula del doc REMOTO CRUDO, ANTES de la unión de
     lápidas y de applyStateData. Calcularlo del estado local resultante (el bug
     que había acá) marcaba como "sincronizados" cambios de meta que NUNCA
     subieron: una eliminación hecha offline podía no llegar jamás a la nube y un
     tercer dispositivo resucitaba el producto borrado para todo el equipo — el
     problema exacto que el rediseño del sync existe para matar. Con el hash
     remoto, cualquier diferencia local↔nube deja meta "dirty" y el próximo
     guardado la sube (y si no hay guardado próximo, el scheduleCloudSync de más
     abajo la empuja solo). */
  const remoteMetaHash = valueHash(metaContentShape(doc.data()));
  // ETAPA D del PLAN-SYNC (lado lectura): las lápidas locales se UNEN con las
  // remotas en vez de reemplazarse — una lápida que este dispositivo conoce y la
  // nube todavía no (subida pendiente, o carrera con otro dispositivo) ya no puede
  // desaparecer por aplicar un snapshot. El orden de la unión (remotas primero,
  // extras locales al final) coincide con cómo arrayUnion las va a dejar en la
  // nube, así el sameJSON de abajo converge y deja de re-aplicar.
  const localTombstones = { deletedInventoryIds, deletedReceiptIds, deletedPurchaseIds, deletedCalNoteIds, deletedRecipeIds };
  Object.keys(localTombstones).forEach(k=>{
    // Las lápidas con des-entierro pendiente (restaurar backup) NO entran a la
    // unión — si no, la copia de la nube re-mataba el doc restaurado antes de que
    // el arrayRemove del próximo sync llegara.
    const remoteArr = (Array.isArray(incomingMeta[k]) ? incomingMeta[k] : []).filter(id=>!isUntombstonePending(k, id));
    incomingMeta[k] = Array.from(new Set(remoteArr.concat(localTombstones[k] || [])));
  });
  /* MERGE FINO de los arrays que viven en meta — la última pieza del rediseño del
     sync: el doc de meta viaja entero, así que sin esto dos miembros editando
     recetas DISTINTAS a la vez se pisaban (el commit más tardío traía la copia
     vieja del otro), y una nota creada localmente se perdía si llegaba un snapshot
     antes de subirla. Reglas por tipo:
     - recetas: por id; en conflicto gana el lastEditedAt más nuevo (sin sello,
       gana la nube — comportamiento de siempre). Las locales que la nube no tiene
       se conservan (creadas offline/acá).
     - notas y salidas: inmutables por id → unión (remoto de base + locales que
       falten, filtrando tombstones ya unidos); salidas re-ordenadas y capadas.
     - aliasMap: remoto manda por clave, las claves solo-locales se conservan.
     Tras aplicar, meta queda dirty contra el hash remoto y el scheduleCloudSync
     del final sube el resultado fusionado — todos convergen. */
  const noteTombs = new Set(incomingMeta.deletedCalNoteIds || []);
  const recipeTombs = new Set(incomingMeta.deletedRecipeIds || []);
  const remoteRecipesIn = (Array.isArray(incomingMeta.recipes) ? incomingMeta.recipes : []).filter(r=>r && r.id);
  const remoteRecipeIdsIn = new Set(remoteRecipesIn.map(r=>r.id));
  incomingMeta.recipes = remoteRecipesIn.map(remote=>{
    const local = recipes.find(x=>x && x.id===remote.id);
    if(local && String(local.lastEditedAt||'') > String(remote.lastEditedAt||'')) return JSON.parse(JSON.stringify(stripRecipePhotoForCloud(local)));
    return remote;
  }).concat(
    recipes.filter(x=>x && x.id && !remoteRecipeIdsIn.has(x.id) && !recipeTombs.has(x.id)).map(x=>JSON.parse(JSON.stringify(stripRecipePhotoForCloud(x))))
  );
  const remoteNotesIn = (Array.isArray(incomingMeta.calNotes) ? incomingMeta.calNotes : []).filter(n=>n && n.id);
  const remoteNoteIdsIn = new Set(remoteNotesIn.map(n=>n.id));
  incomingMeta.calNotes = remoteNotesIn.concat(calNotes.filter(n=>n && n.id && !remoteNoteIdsIn.has(n.id) && !noteTombs.has(n.id)));
  const remoteOutIn = (Array.isArray(incomingMeta.outflows) ? incomingMeta.outflows : []).filter(o=>o && o.id);
  const remoteOutIdsIn = new Set(remoteOutIn.map(o=>o.id));
  incomingMeta.outflows = remoteOutIn.concat(outflows.filter(o=>o && o.id && !remoteOutIdsIn.has(o.id)))
    .sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).slice(0, OUTFLOWS_MAX);
  incomingMeta.aliasMap = Object.assign({}, aliasMap, incomingMeta.aliasMap || {});
  // Las recetas se comparan en su forma NORMALIZADA para la nube (fotos como
  // referencia, sin base64) — es lo que el doc remoto realmente contiene. Comparar
  // contra las locales con base64 haría que TODO snapshot pareciera distinto, y
  // cada reconexión re-aplicaría y redibujaría de más (el parpadeo ya arreglado).
  const currentMeta = {aliasMap, priceAlertThreshold, cycleCountPct, cycleCountIntervalDays, cycleCountLastDate, cycleCountCursor, deletedInventoryIds, deletedReceiptIds, deletedPurchaseIds, businessName, monthlyBudget, profitsVisibleToMembers, categories, calNotes, deletedCalNoteIds, recipes: recipesForCloud(), outflows, deletedRecipeIds};
  if(sameJSON(incomingMeta, currentMeta)){
    // Sin nada que aplicar, el espejo igual se actualiza al hash remoto: si local
    // y nube ya coinciden, esto lo deja "limpio" con la verdad de la nube.
    lastSyncedHashes.meta = remoteMetaHash;
    persistSyncedHashes();
    // OJO: "nada que aplicar" NO implica "nada que subir". La unión de lápidas
    // puede hacer que incoming == local justamente PORQUE lo local ya tenía una
    // lápida que la nube no conoce (borrado offline) — meta sigue dirty contra el
    // hash remoto y hay que empujar la subida ya, no esperar a la próxima edición.
    if(currentUser && lastSyncedHashes.meta !== valueHash(metaCloudContent())) scheduleCloudSync();
    return;
  }
  applyingRemoteSnapshot = true;
  applyStateData(incomingMeta);
  lastSyncedHashes.meta = remoteMetaHash;
  persistSyncedHashes();
  saveState(); scheduleCloudTriggeredRender();
  applyingRemoteSnapshot = false;
  // Si tras aplicar el snapshot lo local sigue difiriendo de la nube (típico: una
  // lápida agregada offline que la nube aún no conoce), se agenda la subida YA —
  // sin esto, el cambio esperaba a la próxima edición del usuario, que puede no
  // llegar nunca.
  if(currentUser && lastSyncedHashes.meta !== valueHash(metaCloudContent())) scheduleCloudSync();
}
// Si el dueño saca a alguien del equipo (removeMember) mientras esa persona sigue
// con la app abierta, Firestore le empieza a negar lectura/escritura sobre el árbol
// del dueño — sin este chequeo, esos errores solo quedaban en la consola y la
// persona seguía viendo/editando una foto vieja y congelada sin saber que ya no se
// está guardando nada. Ante un "permission-denied" en cualquiera de los 4
// listeners, se la vuelve a su propia cuenta (vacía) automáticamente.
function handleSyncPermissionDenied(err){
  if(!err || err.code!=='permission-denied' || !currentUser || !joinedOwnerUid) return;
  console.warn('[Dusty] se perdió el acceso al inventario compartido — volviendo a la cuenta propia.');
  detachFirestoreListeners();
  detachTeamListener();
  stopPresenceHeartbeat();
  joinedRef(currentUser.uid).delete().catch(()=>{});
  applyingRemoteSnapshot = true;
  inventory=[]; purchases=[]; receipts=[]; deletedInventoryIds=[]; deletedReceiptIds=[]; deletedPurchaseIds=[]; aliasMap={}; calNotes=[]; deletedCalNoteIds=[]; recipes=[]; outflows=[]; deletedRecipeIds=[]; resetSyncedHashes();
  joinedOwnerUid = null; joinedOwnerEmail = '';
  lastSyncedUid = currentUser.uid;
  saveState();
  applyingRemoteSnapshot = false;
  attachFirestoreListeners(currentUser.uid);
  attachTeamListener();
  render();
}
function attachFirestoreListeners(uid){
  // Idempotente a propósito: si ya había listeners conectados de un llamado anterior
  // sin desconectar (p. ej. Firebase reinvocando onAuthStateChanged para un usuario
  // que ya estaba logueado), se cierran antes de abrir los nuevos. Si no, las
  // referencias unsub* de la vez anterior se pisan sin haberse desuscrito nunca, y esos
  // listeners viejos quedan escuchando (y re-subiendo fotos vía catchUpReceiptPhotoUploads)
  // para siempre.
  detachFirestoreListeners();
  unsubInventory = inventoryRef(uid).onSnapshot(applyRemoteInventorySnapshot, err=>{ console.error('[Dusty] inventory listener error:', err); handleSyncPermissionDenied(err); });
  unsubPurchases = purchasesRef(uid).onSnapshot(applyRemotePurchasesSnapshot, err=>{ console.error('[Dusty] purchases listener error:', err); handleSyncPermissionDenied(err); });
  unsubReceipts = receiptsRef(uid).onSnapshot(applyRemoteReceiptsSnapshot, err=>{ console.error('[Dusty] receipts listener error:', err); handleSyncPermissionDenied(err); });
  unsubMeta = metaRef(uid).onSnapshot(applyRemoteMetaSnapshot, err=>{ console.error('[Dusty] meta listener error:', err); handleSyncPermissionDenied(err); });
  // De solo lectura — nunca se guarda en localStorage ni se "sube" como el resto,
  // así que no necesita pasar por applyingRemoteSnapshot ni por saveState(). Sí
  // necesita el mismo chequeo de "¿cambió algo de verdad?" que los otros 4
  // listeners (ver sameJSON en applyRemoteInventorySnapshot/applyRemoteMetaSnapshot):
  // sin él, este llamaba a render() a lo bruto en cada entrega del snapshot, y en el
  // celular ese "cada entrega" pasa mucho más seguido de lo que parece — cada vez
  // que la app vuelve de segundo plano (cambiar de app, prender la pantalla),
  // Firestore reconecta y entrega el mismo estado dos veces (caché, después
  // servidor). Este además ni pasaba por el debounce de scheduleCloudTriggeredRender,
  // así que su redibujado quedaba totalmente suelto del de los otros — con inventario,
  // equipo y conexiones activados a la vez, un solo reconectar podía disparar
  // media docena de redibujados completos seguidos, uno por cada listener, cada uno
  // "saltando" la pantalla un poco. Eso es lo que se siente como que "todo brinca o
  // desaparece y reaparece" en el celular.
  unsubActivity = activityRef(uid).orderBy('at','desc').limit(100).onSnapshot(snap=>{
    const nextActivityLog = snap.docs.map(d=>d.data());
    if(sameJSON(nextActivityLog, activityLog)) return;
    activityLog = nextActivityLog;
    scheduleCloudTriggeredRender();
  }, err=>{ console.error('[Dusty] activity listener error:', err); handleSyncPermissionDenied(err); });
  // Un solo lugar para esto, en vez de repetirlo en cada sitio que llama a
  // attachFirestoreListeners — cubre tanto el primer login como reconectar
  // (refrescar la página, volver a tener red) y unirse/salir de un equipo.
  catchUpReceiptPhotoUploads();
  catchUpRecipePhotoUploads();
  pruneOldActivity(uid);
}
/* La colección de actividad ganaba un doc por CADA cambio de inventario y nunca se
   borraba nada — la app solo lee los últimos 100, pero el almacenamiento en
   Firestore crecía para siempre. Limpieza fire-and-forget al conectar: borra hasta
   200 entradas con más de 120 días, solo cuando este usuario es el DUEÑO del árbol
   (los miembros no andan borrando historial ajeno aunque las reglas lo permitan).
   200 por conexión alcanza de sobra para ir drenando el backlog sin costo notable. */
const ACTIVITY_KEEP_DAYS = 120;
function pruneOldActivity(uid){
  try{
    if(!currentUser || currentUser.uid !== uid) return;
    const cutoff = new Date(Date.now() - ACTIVITY_KEEP_DAYS*24*60*60*1000).toISOString();
    activityRef(uid).where('at','<',cutoff).limit(200).get().then(snap=>{
      if(snap.empty) return;
      const batch = firebase.firestore().batch();
      snap.docs.forEach(d=>batch.delete(d.ref));
      return batch.commit();
    }).catch(err=>console.warn('[Dusty] no se pudo podar la actividad vieja:', err));
  }catch(e){}
}
function detachFirestoreListeners(){
  if(unsubInventory) unsubInventory();
  if(unsubPurchases) unsubPurchases();
  if(unsubReceipts) unsubReceipts();
  if(unsubMeta) unsubMeta();
  if(unsubActivity) unsubActivity();
  unsubInventory = unsubPurchases = unsubReceipts = unsubMeta = unsubActivity = null;
  activityLog = [];
  lastKnownRemoteInventoryIds = lastKnownRemotePurchaseIds = lastKnownRemoteReceiptIds = null;
}

/* ================= EQUIPO: compartir un inventario entre varias cuentas =================
   Cada cuenta tiene su propio código de invitación (se genera solo, la primera vez que
   se abre este panel). Quien entra ese código en SU PROPIA cuenta pasa a leer/escribir
   siempre en el árbol de datos del dueño (joinedOwnerUid) en vez del propio — nunca se
   mezclan ni se copian datos entre cuentas, solo se apunta al mismo lugar. */
function attachTeamListener(){
  // La lista de miembros solo la ve el dueño real mirando su propio equipo — alguien
  // que ya se unió a otro no necesita (ni puede, por las reglas) ver esta lista.
  if(joinedOwnerUid || !currentUser) return;
  // Idempotente por la misma razón que attachFirestoreListeners() de arriba.
  detachTeamListener();
  unsubTeamMembers = membersRef(currentUser.uid).onSnapshot(snap=>{
    const nextTeamMembers = snap.docs.map(d=>Object.assign({id:d.id}, d.data()));
    // "lastActive" de cada miembro cambia solo por su propio latido de presencia
    // cada 30s (ver sendPresenceHeartbeat) — comparando el array completo, ESO solo
    // ya alcanza para que sameJSON nunca vea dos snapshots iguales mientras haya
    // algún miembro activo, y la app entera se redibujara cada 30s aunque nada
    // visible haya cambiado. Se compara sin ese campo — el resto (mismo chequeo que
    // el listener de actividad, más arriba) sigue cubriendo la reconexión duplicada
    // del celular.
    const strip = (list)=> list.map(m=>{ const {lastActive, ...rest} = m; return rest; });
    const structurallySame = sameJSON(strip(nextTeamMembers), strip(teamMembers));
    teamMembers = nextTeamMembers;
    // Si nada estructural cambió, solo vale la pena redibujar mientras el modal de
    // equipo está abierto de verdad mostrando "activo ahora" — cerrado, a nadie le
    // importa el latido de este instante, y la próxima vez que se abra el modal va a
    // leer el teamMembers ya actualizado igual, sin depender de este redibujado.
    if(structurallySame && !showTeamModal) return;
    scheduleCloudTriggeredRender();
  }, err=>console.error('[Dusty] team members listener error:', err));
}
function detachTeamListener(){
  if(unsubTeamMembers) unsubTeamMembers();
  unsubTeamMembers = null; teamMembers = [];
}
function generateInviteCode(){
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I/L, para que no se confundan al copiarlo a mano
  // crypto.getRandomValues, no Math.random(): el código es lo único que protege el
  // inventario del equipo, y Math.random() es predecible si alguien conoce el motor.
  const buf = new Uint32Array(6);
  crypto.getRandomValues(buf);
  let code = '';
  for(let i=0;i<6;i++) code += chars[buf[i] % chars.length];
  return code;
}
/* Rotar el código de invitación: crea el doc del código nuevo, apunta meta/team al
   nuevo, y recién después borra el viejo (en este orden — si algo falla a mitad de
   camino, siempre queda AL MENOS un código utilizable apuntando al dueño). */
function rotateInviteCode(){
  return teamRef(currentUser.uid).get().then(doc=>{
    const oldCode = (doc.exists && doc.data().inviteCode) || null;
    const code = generateInviteCode();
    return inviteCodeRef(code).set({ownerUid: currentUser.uid, ownerEmail: currentUserLabel()})
      .then(()=>teamRef(currentUser.uid).set({inviteCode: code}))
      .then(()=>{ if(oldCode && oldCode !== code) return inviteCodeRef(oldCode).delete().catch(()=>{}); })
      .then(()=>{ teamInviteCode = code; });
  });
}
function ensureInviteCode(){
  if(teamInviteCode || !currentUser) return;
  teamLoading = true; render();
  teamRef(currentUser.uid).get().then(doc=>{
    if(doc.exists && doc.data().inviteCode){
      const code = doc.data().inviteCode;
      // Reparación (satélite del PLAN-SYNC): si el doc de inviteCodes/ no existe
      // (la segunda escritura de una versión vieja falló a mitad de camino), el
      // dueño mostraba un código al que NADIE podía unirse — se recrea acá.
      return inviteCodeRef(code).get().then(codeDoc=>{
        if(codeDoc.exists) return code;
        return inviteCodeRef(code).set({ownerUid: currentUser.uid, ownerEmail: currentUserLabel()}).then(()=>code);
      });
    }
    const code = generateInviteCode();
    // Atómico (satélite del PLAN-SYNC): antes eran dos escrituras sueltas — si la
    // segunda fallaba, quedaba el mismo código-fantasma de arriba.
    const batch = firebase.firestore().batch();
    batch.set(teamRef(currentUser.uid), {inviteCode: code});
    batch.set(inviteCodeRef(code), {ownerUid: currentUser.uid, ownerEmail: currentUserLabel()});
    return batch.commit().then(()=>code);
  }).then(code=>{
    teamInviteCode = code; teamLoading = false; render();
  }).catch(err=>{
    console.error('[Dusty] invite code setup failed:', err);
    teamLoading = false; teamError = t('team_err_generic'); render();
  });
}
let teamModalRefreshTimer = null;
function openTeamModal(){
  showTeamModal = true; teamError=''; teamJoinCode='';
  if(!joinedOwnerUid) ensureInviteCode();
  // "Activo ahora" / "última vez hace X" son relativos al reloj, no a un cambio de
  // datos — sin este refresco, quedarían pegados a lo que decían en el momento de
  // abrir el panel hasta que a alguien se le ocurriera hacer algo que dispare un
  // snapshot nuevo.
  if(teamModalRefreshTimer) clearInterval(teamModalRefreshTimer);
  teamModalRefreshTimer = setInterval(()=>{ if(showTeamModal) render(); }, 20000);
  render();
}
function closeTeamModal(){
  showTeamModal=false; teamError=''; teamJoinCode='';
  if(teamModalRefreshTimer){ clearInterval(teamModalRefreshTimer); teamModalRefreshTimer=null; }
  render();
}
// Un link (en vez del código pelado) para que quien lo reciba no tenga que
// transcribirlo a mano — al abrirlo, la app se lo carga sola en el paso de "unirme".
function teamInviteLink(){
  return location.origin + location.pathname + '?join=' + encodeURIComponent(teamInviteCode);
}
function copyInviteCode(){
  if(!teamInviteCode) return;
  navigator.clipboard.writeText(teamInviteLink()).catch(()=>{});
}
function shareInviteCode(){
  if(!teamInviteCode || !navigator.share) return;
  navigator.share({ title: 'Dusty', text: t('team_share_msg'), url: teamInviteLink() }).catch(()=>{});
}
function joinTeam(){
  const code = (teamJoinCode||'').trim().toUpperCase();
  if(!code){ teamError=t('team_err_need_code'); render(); return; }
  teamLoading = true; teamError=''; render();
  inviteCodeRef(code).get().then(doc=>{
    if(!doc.exists){ teamLoading=false; teamError=t('team_err_not_found'); render(); return; }
    const ownerUid = doc.data().ownerUid, ownerEmail = doc.data().ownerEmail||'';
    if(ownerUid === currentUser.uid){ teamLoading=false; teamError=t('team_err_self'); render(); return; }
    if(!confirm(t('team_join_confirm').replace('{email}', ownerEmail))){ teamLoading=false; render(); return; }
    // Antes de escribir nada de "unirse al equipo", se fuerza a que cualquier cambio de
    // ESTA cuenta que todavía no se subió (por el debounce de 400ms de scheduleCloudSync,
    // o por haber estado offline hace un momento) termine de guardarse en SU PROPIO
    // Firestore. Si esto falla, se corta acá — sin haber tocado membersRef/joinedRef ni
    // el estado local — porque de lo contrario el vaciado de más abajo borraría para
    // siempre datos de esta cuenta que nunca llegaron a ningún lado.
    clearTimeout(cloudSyncDebounceTimer);
    // `code` va en el propio documento de membresía: las reglas de Firestore ahora exigen
    // que quien se une pruebe que conoce un código de invitación válido de este dueño (ver
    // firestore.rules, match .../members/{memberId}). Sin este campo, la creación se rechaza.
    return syncAllToFirestore().then(()=>membersRef(ownerUid).doc(currentUser.uid).set({
      email: currentUserLabel(), joinedAt: new Date().toISOString(), code
    })).then(()=>joinedRef(currentUser.uid).set({ownerUid, ownerEmail})).then(()=>{
      // Se corta la sincronización actual y se arranca de cero apuntando al inventario
      // del dueño — a propósito NO se corre reconcileLocalOnlyData acá: lo que este
      // dispositivo tuviera guardado (aunque sea de esta misma cuenta) nunca se mezcla
      // con el inventario de otra persona. Ya se aseguró arriba que esos datos quedaron
      // guardados en la cuenta propia antes de vaciarlos.
      // (reusa applyJoinedTeam(), la misma que usa el alta rápida por PIN — antes esto
      // era una copia inline que se había desincronizado y se olvidaba de arrancar el
      // "presence heartbeat", dejando a quien entraba por este camino siempre marcado
      // como inactivo para el dueño del inventario)
      applyJoinedTeam(ownerUid, ownerEmail);
      teamLoading = false; showTeamModal = false; teamJoinCode = '';
      render();
    });
  }).catch(err=>{
    console.error('[Dusty] join team failed:', err);
    teamLoading = false; teamError = t('team_err_generic'); render();
  });
}
function leaveTeam(){
  if(!joinedOwnerUid) return;
  if(!confirm(t('team_leave_confirm'))) return;
  teamLoading = true; render();
  const ownerUid = joinedOwnerUid;
  membersRef(ownerUid).doc(currentUser.uid).delete()
    .then(()=>joinedRef(currentUser.uid).delete())
    .then(()=>{
      detachFirestoreListeners();
      stopPresenceHeartbeat();
      // Mismo resguardo que en joinTeam(): esta limpieza es una transición de árbol
      // de datos, no una edición real — no debe disparar una subida con estado vacío.
      applyingRemoteSnapshot = true;
      inventory=[]; purchases=[]; receipts=[]; deletedInventoryIds=[]; deletedReceiptIds=[]; deletedPurchaseIds=[]; aliasMap={}; calNotes=[]; deletedCalNoteIds=[]; recipes=[]; outflows=[]; deletedRecipeIds=[]; resetSyncedHashes();
      joinedOwnerUid = null; joinedOwnerEmail = '';
      lastSyncedUid = currentUser.uid;
      saveState();
      applyingRemoteSnapshot = false;
      attachFirestoreListeners(currentUser.uid);
      attachTeamListener();
      teamLoading = false; showTeamModal = false;
      render();
    }).catch(err=>{
      console.error('[Dusty] leave team failed:', err);
      teamLoading = false; teamError = t('team_err_generic'); render();
    });
}
function removeMember(memberId){
  if(!confirm(t('team_remove_confirm'))) return;
  // El código se rota ANTES de borrar la membresía: el expulsado conoce el código
  // vigente (lo usó para entrar) y la regla de create de members solo exige probar
  // un código válido — sin rotación, podía volver a unirse un segundo después y la
  // expulsión no servía de nada. Si la rotación falla (red), NO se expulsa: mejor
  // reintentar que una expulsión de mentira.
  rotateInviteCode()
    .then(()=>membersRef(currentUser.uid).doc(memberId).delete())
    .then(()=>{ render(); })
    .catch(err=>{
    console.error('[Dusty] remove member failed:', err);
    showToast(t('team_err_generic'), 'error');
  });
}

/* Cada vez que este dispositivo se conecta a la nube (no solo la primera vez):
   compara por id qué hay local que todavía NO está en la nube, y lo sube antes
   de dejar que los listeners en tiempo real empiecen a aplicar snapshots.
   Antes esto solo subía datos si la cuenta no tenía NADA en la nube ("si ya
   sincronizó antes, no hace falta"), pero esa suposición estaba mal: cualquier
   recibo/producto/compra agregado en este dispositivo que no hubiera alcanzado
   a subirse (por ejemplo, si se refrescó la página antes de que terminara la
   sincronización de 400ms) quedaba huérfano — nunca se subía, y en cuanto el
   listener conectaba, lo pisaba con la versión incompleta de la nube y se
   perdía.

   IMPORTANTE sobre aislamiento entre clientes: todo esto opera exclusivamente
   dentro de la colección de ESTE "uid" (users/{uid}/...) — nunca compara ni
   toca datos de otra cuenta. Cada cliente de Dusty tiene su propio uid con
   sus propias reglas de seguridad en Firestore (ya verificado con pruebas
   reales devolviendo 403 para accesos ajenos); esta función jamás ve ni podría
   ver el inventario de otro cliente, así que no hay forma de que se mezclen
   entre sí. Lo único que "fusiona" es un producto de ESTE MISMO cliente creado
   en dos de SUS PROPIOS dispositivos antes de sincronizar por primera vez (ver
   abajo) — nunca entre clientes distintos. */
function reconcileLocalOnlyData(uid, localSnapshot){
  return Promise.all([
    inventoryRef(uid).get(), purchasesRef(uid).get(), receiptsRef(uid).get(), metaRef(uid).get()
  ]).then(([invSnap, purSnap, recSnap, metaSnap])=>{
    // Junta las "lápidas" de este dispositivo con las que suba haya subido otro dispositivo
    // de la misma cuenta (guardadas dentro de meta), para que un producto borrado en CUALQUIER
    // dispositivo deje de existir en todos. Cualquier producto de la nube que aparezca en esta
    // lista se borra ahora mismo, antes de que los listeners en tiempo real puedan traerlo de
    // vuelta — esto es lo que arregla productos "borrados" que seguían reapareciendo.
    const remoteMetaData = metaSnap.exists ? metaSnap.data() : {};
    const remoteDeletedIds = Array.isArray(remoteMetaData.deletedInventoryIds) ? remoteMetaData.deletedInventoryIds : [];
    let deletedIdsChanged = false;
    remoteDeletedIds.forEach(id=>{ if(isUntombstonePending('deletedInventoryIds', id)) return; if(!deletedInventoryIds.includes(id)){ deletedInventoryIds.push(id); deletedIdsChanged = true; } });
    const deletedSet = new Set(deletedInventoryIds);

    // Mismas lápidas para recibos y compras: se fusionan las de la nube con las locales, y
    // cualquier recibo/compra de la nube que caiga en esas listas se borra ahora, antes de
    // que los listeners lo traigan de vuelta. Sin esto, borrar un recibo con un compañero
    // offline no se propagaba (solo el inventario tenía este mecanismo).
    const remoteDeletedRecIds = Array.isArray(remoteMetaData.deletedReceiptIds) ? remoteMetaData.deletedReceiptIds : [];
    remoteDeletedRecIds.forEach(id=>{ if(isUntombstonePending('deletedReceiptIds', id)) return; if(!deletedReceiptIds.includes(id)){ deletedReceiptIds.push(id); deletedIdsChanged = true; } });
    const remoteDeletedPurIds = Array.isArray(remoteMetaData.deletedPurchaseIds) ? remoteMetaData.deletedPurchaseIds : [];
    remoteDeletedPurIds.forEach(id=>{ if(isUntombstonePending('deletedPurchaseIds', id)) return; if(!deletedPurchaseIds.includes(id)){ deletedPurchaseIds.push(id); deletedIdsChanged = true; } });
    // Lápidas de notas de calendario: mismo mecanismo que las de arriba — una nota
    // borrada en cualquier dispositivo deja de existir en todos.
    const remoteDeletedNoteIds = Array.isArray(remoteMetaData.deletedCalNoteIds) ? remoteMetaData.deletedCalNoteIds : [];
    remoteDeletedNoteIds.forEach(id=>{ if(isUntombstonePending('deletedCalNoteIds', id)) return; if(!deletedCalNoteIds.includes(id)){ deletedCalNoteIds.push(id); deletedIdsChanged = true; } });
    const deletedNoteSet = new Set(deletedCalNoteIds);
    if(calNotes.some(n=>deletedNoteSet.has(n.id))){
      calNotes = calNotes.filter(n=>!deletedNoteSet.has(n.id));
      saveState();
    }
    // Lápidas de recetas: mismo mecanismo que las notas (viven dentro de meta).
    const remoteDeletedRecipeIds = Array.isArray(remoteMetaData.deletedRecipeIds) ? remoteMetaData.deletedRecipeIds : [];
    remoteDeletedRecipeIds.forEach(id=>{ if(isUntombstonePending('deletedRecipeIds', id)) return; if(!deletedRecipeIds.includes(id)){ deletedRecipeIds.push(id); deletedIdsChanged = true; } });
    const deletedRecipeSet = new Set(deletedRecipeIds);
    if(recipes.some(r=>deletedRecipeSet.has(r.id))){
      recipes = recipes.filter(r=>!deletedRecipeSet.has(r.id));
      saveState();
    }
    const deletedRecSet = new Set(deletedReceiptIds);
    const deletedPurSet = new Set(deletedPurchaseIds);

    // Si otro dispositivo borró un recibo/compra que este todavía tiene local, se lo saca
    // de acá también (igual que se hace para inventario justo abajo).
    if(receipts.some(r=>deletedRecSet.has(r.id)) || purchases.some(p=>deletedPurSet.has(p.id))){
      receipts = receipts.filter(r=>!deletedRecSet.has(r.id));
      purchases = purchases.filter(p=>!deletedPurSet.has(p.id));
      saveState();
    }

    // Si otro dispositivo borró un producto que este todavía tiene en su propia lista
    // local (porque no se había enterado), se lo saca de acá también — no solo de la nube.
    if(inventory.some(i=>deletedSet.has(i.id))){
      inventory = inventory.filter(i=>!deletedSet.has(i.id));
      saveState();
    }

    const remoteInv = invSnap.docs.map(d=>d.data()).filter(i=>!deletedSet.has(i.id));
    const remoteInvIds = new Set(remoteInv.map(i=>i.id));
    const remoteTombstonedIds = invSnap.docs.map(d=>d.id).filter(id=>deletedSet.has(id));
    // Recibos/compras que están en la nube pero tienen lápida -> se borran ahora mismo.
    const remoteTombstonedRecIds = recSnap.docs.map(d=>d.id).filter(id=>deletedRecSet.has(id));
    const remoteTombstonedPurIds = purSnap.docs.map(d=>d.id).filter(id=>deletedPurSet.has(id));
    const remotePurIds = new Set(purSnap.docs.map(d=>d.id));
    const remoteRecIds = new Set(recSnap.docs.map(d=>d.id));

    /* Si un producto local todavía no está en la nube CON ESE ID, puede ser (a) un
       producto nuevo de verdad, o (b) el MISMO producto que este dispositivo y otro
       de esta misma cuenta crearon cada uno por su lado, offline, antes de sincronizar
       — cada uno con su propio id random. Se distingue por nombre (sin mayúsculas ni
       espacios de más, igual que el resto de la app ya hace para reconocer productos
       al escanear recibos). Si coincide con uno que ya existe en la nube de este mismo
       cliente, se usa el id de la nube en vez de crear un duplicado — nunca se crea un
       producto nuevo por error, y nunca se compara contra otro cliente. */
    /* ETAPA C del PLAN-SYNC: para un doc presente en AMBOS lados ya no gana siempre
       la nube — si lo local tiene una edición sin subir (dirty contra el espejo de
       hashes, que se persiste entre sesiones: cubre la edición hecha 200ms antes de
       que el SO matara la app) y su sello updatedAt es más nuevo, se sube lo local.
       Sin sello local (datos viejos) o con sello remoto más nuevo, gana la nube —
       exactamente el comportamiento de siempre. Empate exacto de sello: desempate
       estable por updatedBy (uid menor gana), como pide el plan. */
    const localWins = (kind, localDoc, remoteDoc)=>{
      if(!isDocDirty(kind, localDoc)) return false;
      const l = String(localDoc.updatedAt||''), r = String((remoteDoc && remoteDoc.updatedAt)||'');
      if(l !== r) return l > r;
      return !!l && String(localDoc.updatedBy||'') < String((remoteDoc && remoteDoc.updatedBy)||'');
    };
    const idRemap = {};
    const newInv = [];
    const updInv = [];
    localSnapshot.inventory.forEach(i=>{
      if(deletedSet.has(i.id)) return;
      if(remoteInvIds.has(i.id)){
        const remote = remoteInv.find(r=>r.id===i.id);
        if(localWins('inventory', i, remote)) updInv.push(i);
        return;
      }
      const nameKey = (i.name||'').trim().toLowerCase();
      const match = nameKey ? remoteInv.find(r=>(r.name||'').trim().toLowerCase()===nameKey) : null;
      if(match) idRemap[i.id] = match.id;
      else newInv.push(i);
    });

    // Aplica el remapeo a lo que este dispositivo tiene en memoria ahora mismo, para
    // que deje de usar el id "duplicado" desde ya: la compra que apuntaba al producto
    // duplicado pasa a apuntar al real, y el producto duplicado se quita de la lista
    // local (el real ya está, o va a llegar en el próximo snapshot).
    const remappedPurchaseIds = [];
    if(Object.keys(idRemap).length>0){
      inventory = inventory.filter(i=>!idRemap[i.id]);
      purchases.forEach(p=>{ if(idRemap[p.ingId]){ p.ingId = idRemap[p.ingId]; remappedPurchaseIds.push(p.id); } });
      Object.keys(aliasMap).forEach(k=>{ if(idRemap[aliasMap[k]]) aliasMap[k] = idRemap[aliasMap[k]]; });
      Object.keys(localSnapshot.aliasMap).forEach(k=>{ if(idRemap[localSnapshot.aliasMap[k]]) localSnapshot.aliasMap[k] = idRemap[localSnapshot.aliasMap[k]]; });
      saveState();
    }

    // localSnapshot.purchases son los mismos objetos que "purchases" (slice() copia el
    // array, no cada compra) — el remapeo de arriba ya les llegó, así que este filtro
    // ya ve el ingId corregido.
    // El "&& !deletedPurSet.has(p.id)" es la corrección clave: una compra que está en la
    // lista de borradas NO se re-sube aunque falte en la nube — antes reaparecía. Ídem recibos.
    const missingPur = localSnapshot.purchases.filter(p=>(!remotePurIds.has(p.id) || remappedPurchaseIds.includes(p.id)) && !deletedPurSet.has(p.id));
    const missingRec = localSnapshot.receipts.filter(r=>!remoteRecIds.has(r.id) && !deletedRecSet.has(r.id));
    // ETAPA C para compras y recibos: mismos criterios que updInv arriba.
    const remotePurById = {}; purSnap.docs.forEach(d=>{ const p=d.data(); if(p && p.id) remotePurById[p.id]=p; });
    const remoteRecById = {}; recSnap.docs.forEach(d=>{ const r=d.data(); if(r && r.id) remoteRecById[r.id]=r; });
    const updPur = localSnapshot.purchases.filter(p=>p && p.id && remotePurIds.has(p.id) && !remappedPurchaseIds.includes(p.id) && !deletedPurSet.has(p.id) && localWins('purchases', p, remotePurById[p.id]));
    const updRec = localSnapshot.receipts.filter(r=>r && r.id && remoteRecIds.has(r.id) && !deletedRecSet.has(r.id) && localWins('receipts', r, remoteRecById[r.id]));
    // Notas de calendario: viven DENTRO de meta (no en su propia subcolección), así
    // que "subir las que faltan" es fusionar por id — la nube manda por cada id que
    // ya tiene, lo local solo agrega las que la nube no conocía (creadas offline en
    // este dispositivo), y las que tienen lápida no entran de ningún lado. Mismo
    // espíritu que mergedAliasMap, más abajo.
    const remoteNotes = (Array.isArray(remoteMetaData.calNotes) ? remoteMetaData.calNotes : []).filter(n=>n && n.id && !deletedNoteSet.has(n.id));
    const remoteNoteIds = new Set(remoteNotes.map(n=>n.id));
    const localOnlyNotes = (localSnapshot.calNotes||[]).filter(n=>n && n.id && !remoteNoteIds.has(n.id) && !deletedNoteSet.has(n.id));
    const mergedCalNotes = remoteNotes.concat(localOnlyNotes);
    /* Recetas y salidas viven en meta igual que las notas — mismo merge por id: la
       nube manda por cada id que ya tiene, lo local solo agrega lo creado offline en
       este dispositivo, y lo tombstoneado no entra de ningún lado. Este reconcile es
       el TERCER escritor del doc meta y era el único que no conocía estos campos:
       cada vez que un dispositivo reconciliaba (algo tan común como enterarse de UNA
       lápida nueva), reescribía meta SIN recipes/outflows/deletedRecipeIds y borraba
       de la nube todas las recetas y el historial de salidas de la cuenta. */
    const remoteRecipes = (Array.isArray(remoteMetaData.recipes) ? remoteMetaData.recipes : []).filter(r=>r && r.id && !deletedRecipeSet.has(r.id));
    const remoteRecipeIds = new Set(remoteRecipes.map(r=>r.id));
    const localOnlyRecipes = (localSnapshot.recipes||[]).filter(r=>r && r.id && !remoteRecipeIds.has(r.id) && !deletedRecipeSet.has(r.id));
    const mergedRecipes = remoteRecipes.concat(localOnlyRecipes);
    const remoteOutflows = (Array.isArray(remoteMetaData.outflows) ? remoteMetaData.outflows : []).filter(o=>o && o.id);
    const remoteOutflowIds = new Set(remoteOutflows.map(o=>o.id));
    const localOnlyOutflows = (localSnapshot.outflows||[]).filter(o=>o && o.id && !remoteOutflowIds.has(o.id));
    // Historial más nuevo primero, con el mismo tope que recordOutflow() (app-08).
    const mergedOutflows = remoteOutflows.concat(localOnlyOutflows)
      .sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).slice(0, OUTFLOWS_MAX);
    // Lápidas LOCALES que la nube todavía no conoce (borrados hechos offline)
    // también obligan a escribir meta — sin esto, el tombstone de un borrado
    // offline no subía en el reconcile y otro dispositivo podía resucitar el
    // producto para todo el equipo.
    const localOnlyTombstones = [
      ['deletedInventoryIds', deletedInventoryIds], ['deletedReceiptIds', deletedReceiptIds],
      ['deletedPurchaseIds', deletedPurchaseIds], ['deletedCalNoteIds', deletedCalNoteIds],
      ['deletedRecipeIds', deletedRecipeIds]
    ].some(([k, arr])=>{
      const rem = new Set(Array.isArray(remoteMetaData[k]) ? remoteMetaData[k] : []);
      return arr.some(id=>!rem.has(id));
    });
    const needsMeta = !metaSnap.exists || Object.keys(idRemap).length>0 || deletedIdsChanged || localOnlyNotes.length>0 || localOnlyRecipes.length>0 || localOnlyOutflows.length>0 || localOnlyTombstones;
    if(newInv.length===0 && updInv.length===0 && missingPur.length===0 && updPur.length===0 && missingRec.length===0 && updRec.length===0 && remoteTombstonedIds.length===0 && remoteTombstonedRecIds.length===0 && remoteTombstonedPurIds.length===0 && !needsMeta) return null;
    // Mismo límite de 500 operaciones por batch que syncAllToFirestore() — un primer
    // sincronizado grande (por ejemplo, activar la nube con cientos de productos ya
    // cargados localmente) también puede pasarse, así que se reparte igual.
    const ops = [];
    newInv.forEach(i=>ops.push({ref:inventoryRef(uid).doc(i.id), data:JSON.parse(JSON.stringify(i))}));
    updInv.forEach(i=>ops.push({ref:inventoryRef(uid).doc(i.id), data:JSON.parse(JSON.stringify(i))}));
    remoteTombstonedIds.forEach(id=>ops.push({ref:inventoryRef(uid).doc(id), del:true}));
    remoteTombstonedRecIds.forEach(id=>ops.push({ref:receiptsRef(uid).doc(id), del:true}));
    remoteTombstonedPurIds.forEach(id=>ops.push({ref:purchasesRef(uid).doc(id), del:true}));
    missingPur.forEach(p=>ops.push({ref:purchasesRef(uid).doc(p.id), data:JSON.parse(JSON.stringify(p))}));
    updPur.forEach(p=>ops.push({ref:purchasesRef(uid).doc(p.id), data:JSON.parse(JSON.stringify(p))}));
    missingRec.forEach(r=>ops.push({ref:receiptsRef(uid).doc(r.id), data:JSON.parse(JSON.stringify(receiptForCloud(r)))}));
    updRec.forEach(r=>ops.push({ref:receiptsRef(uid).doc(r.id), data:JSON.parse(JSON.stringify(receiptForCloud(r)))}));
    if(needsMeta){
      // Bug real encontrado al probar el modo equipo (afecta también a cualquier
      // cuenta con 2+ dispositivos, no solo equipos compartidos): esto se dispara
      // cada vez que este dispositivo se entera de UNA tumba de borrado nueva
      // (deletedIdsChanged), algo muy común — y antes pisaba directo el aliasMap
      // de la nube con el de este dispositivo (vacío, si nunca escaneó un recibo
      // acá), borrando alias reales guardados por otro dispositivo. Ahora se
      // fusiona: la nube manda, lo local solo agrega lo que la nube todavía no
      // tenía. Los ajustes escalares (umbral de alerta, conteo cíclico) se dejan
      // como estaban en la nube si ya existía un doc de meta — este reconcile es
      // para subir lo que falta, no para que el último dispositivo en conectarse
      // pise la configuración de los demás.
      const remoteMeta = metaSnap.exists ? metaSnap.data() : {};
      const mergedAliasMap = Object.assign({}, remoteMeta.aliasMap||{}, localSnapshot.aliasMap);
      ops.push({ref:metaRef(uid), data:JSON.parse(JSON.stringify({
        aliasMap: mergedAliasMap,
        priceAlertThreshold: metaSnap.exists ? remoteMeta.priceAlertThreshold : localSnapshot.priceAlertThreshold,
        cycleCountPct: metaSnap.exists ? remoteMeta.cycleCountPct : localSnapshot.cycleCountPct,
        cycleCountIntervalDays: metaSnap.exists ? remoteMeta.cycleCountIntervalDays : localSnapshot.cycleCountIntervalDays,
        cycleCountLastDate: metaSnap.exists ? remoteMeta.cycleCountLastDate : localSnapshot.cycleCountLastDate,
        cycleCountCursor: metaSnap.exists ? remoteMeta.cycleCountCursor : localSnapshot.cycleCountCursor,
        profitsVisibleToMembers: metaSnap.exists ? remoteMeta.profitsVisibleToMembers : localSnapshot.profitsVisibleToMembers,
        businessName: metaSnap.exists ? remoteMeta.businessName : localSnapshot.businessName,
        monthlyBudget: metaSnap.exists ? (remoteMeta.monthlyBudget===undefined ? null : remoteMeta.monthlyBudget) : localSnapshot.monthlyBudget,
        categories: metaSnap.exists ? (remoteMeta.categories || localSnapshot.categories) : localSnapshot.categories,
        calNotes: mergedCalNotes,
        recipes: mergedRecipes.map(stripRecipePhotoForCloud),
        outflows: mergedOutflows,
        deletedInventoryIds, deletedReceiptIds, deletedPurchaseIds, deletedCalNoteIds, deletedRecipeIds
      }))});
    }
    const CHUNK = 450;
    const commits = [];
    for(let i=0; i<ops.length; i+=CHUNK){
      const batch = firebase.firestore().batch();
      ops.slice(i, i+CHUNK).forEach(op=>{ if(op.del) batch.delete(op.ref); else batch.set(op.ref, op.data); });
      commits.push(batch.commit());
    }
    return Promise.all(commits);
  });
}

let priceAlertThreshold = 15; // % de aumento que dispara la alerta fuerte al escanear — ajustable por el gerente
let showAlertSettingsModal = false;
let showSuggestedOrderModal = false;
let draftThreshold = priceAlertThreshold;
// Nombre del negocio, opcional — vive en esta cuenta nomás (se guarda y sincroniza
// junto con el resto de meta/settings), nunca afecta a otras cuentas. Vacío por
// defecto: en ese caso el título de Inventario se ve exactamente como siempre.
let businessName = '';
let draftBusinessName = businessName;
// Presupuesto mensual: un solo número que se repite todos los meses (no uno por
// mes) hasta que el usuario lo cambie a mano en Ajustes. null = todavía no lo definió,
// en ese caso el Dashboard no muestra la barra.
let monthlyBudget = null;
let draftMonthlyBudget = monthlyBudget;
/* Visibilidad financiera para MIEMBROS del equipo (decisión del dueño, viaja en
   meta): apagado (default), un miembro unido ve costos y stock pero NO el % de
   ganancia, ni el precio de venta, ni el Valor del inventario. El dueño (o un
   uso sin equipo) siempre ve todo. La aplicación es del lado del cliente — un
   miembro técnico podría leer los datos crudos; el cierre server-side (reglas
   por campo) queda como trabajo futuro si el caso lo amerita. */
let profitsVisibleToMembers = false;
function canSeeFinancials(){ return !joinedOwnerUid || profitsVisibleToMembers === true; }
// Categorías de inventario (ej. Comida/Hogar/Ropa/Mantenimiento) — el usuario las crea,
// renombra y borra a mano, no vienen fijas en el código. null = todavía no se cargó nada
// guardado (ni local ni de la nube); un array, aunque esté vacío, significa que el
// usuario ya tiene su propia lista (incluso si la vació a propósito) y no hay que
// pisarla con las categorías por defecto. La siembra real pasa después de loadState(),
// ver más abajo cerca de "loadState();".
let categories = null;
let showCategoriesModal = false;
let draftCategories = [];
function defaultCategories(){
  const names = uiLang==='en'
    ? ['Food','Household','Clothing','Maintenance','Eat Out','Miscellaneous','Entertainment','Transportation','Utilities']
    : ['Comida','Hogar','Ropa','Mantenimiento','Comer afuera','Varios','Entretenimiento','Transporte','Servicios'];
  return names.map(name=>({id:uid('cat'), name}));
}

/* Conteo cíclico: cada X días, recuerda contar a mano un % del inventario, rotando
   qué productos toca cada vez (cycleCountCursor) para no repetir siempre los mismos. */
let cycleCountPct = 20;
let cycleCountIntervalDays = 3;
let cycleCountLastDate = null; // fecha (YYYY-MM-DD) del último conteo completado, o null si nunca se hizo
let cycleCountCursor = 0;
let showCycleCountModal = false;
let draftCycleCountPct = cycleCountPct;
let draftCycleCountInterval = cycleCountIntervalDays;

/* Estado del escaneo de recibo */
// Se incrementa cada vez que se abre/cierra el modal de escaneo — processReceiptImage()
// guarda el valor vigente al arrancar el pedido a la API y lo compara antes de aplicar
// la respuesta. Si no coinciden, el usuario cerró/reinició el escaneo mientras la
// respuesta de una foto ANTERIOR seguía en vuelo, y esa respuesta tardía se descarta en
// vez de pisar los datos de la foto nueva que el usuario ya está mirando.
let scanRequestId = 0;
let scanState = 'idle'; // idle | preview | loading | matched | error
let scanImages = []; // [{base64, mediaType}] — copia liviana (para guardar en el historial y mostrar miniaturas)
let scanImagesHiRes = []; // misma cantidad de páginas que scanImages, pero en más resolución — solo se manda a leer con Claude, nunca se guarda
/* Las fotos originales tal cual salieron de la cámara. Se guardan solo mientras dura el
   escaneo, porque la resolución a la que conviene mandar cada página depende de cuántas
   páginas termine teniendo el recibo (ver bestSideForPageCount) — y eso no se sabe hasta
   que el usuario toca "leer". Guardar el File es barato: es una referencia al archivo, no
   los pixeles decodificados. */
let scanSourceFiles = [];
let scanPageWarnings = []; // misma cantidad de páginas — null, o 'dark'/'blurry'/'flat' si la foto se ve difícil de leer
let scanExtracted = []; // [{name, qty, unit, totalPrice, matchedIngId(new/null), supplier, date}]
let scanErrorMsg = '';
let scanSupplier = '';
let scanDate = localDateStr();
let scanInvoiceTotal = null; // total impreso en la factura, según lo lee Claude — se guarda aparte de la suma de líneas confirmadas

/* ---- Modo "varios recibos" (lote) ----
   Por defecto (scanBatchMode = false) las fotos que se agregan son PÁGINAS DE UN MISMO
   recibo largo, igual que siempre. En modo lote, cada foto puede tener uno o VARIOS
   recibos distintos apoyados juntos (ej. 3 tickets chicos sobre la mesa): el lector
   devuelve una lista, y todos los recibos encontrados se acomodan en una cola.
   Los recibos de la cola pasan de a uno por la MISMA pantalla de confirmación que un
   recibo suelto — no hay una segunda pantalla que pueda quedar desincronizada. */
let scanBatchMode = false;
let scanQueue = [];          // recibos leídos que faltan confirmar: [{parsed, images}]
let scanQueueTotal = 0;      // cuántos recibos se detectaron en todo el lote (para "Recibo N de M")
let scanQueueIndex = 0;      // cuál se está confirmando ahora (1 = el primero)
let scanQueueSkipped = 0;    // cuántos salteó el usuario, para el resumen final
let scanQueueSaved = 0;      // cuántos se guardaron de verdad
let scanCurrentImages = null; // fotos del recibo que se está confirmando (null = usar todas las de scanImages)
let scanBatchFailedPhotos = 0; // fotos del lote que no se pudieron leer, para avisarlo sin abortar el resto

