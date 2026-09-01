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
          try{ localStorage.setItem('patron_had_session','1'); }catch(e){}
          showAuthModal = false; authError=''; authLoading=false;
          // Antes de reconciliar hay que saber si esta cuenta se unió al inventario
          // compartido de otra persona (ver sección de equipo más abajo) — si es así,
          // todo lo de acá abajo opera sobre el uid del DUEÑO del inventario, no sobre
          // el propio. joinedRef() vive bajo el uid de ESTA cuenta (sus propias reglas
          // de siempre aplican, nada especial).
          joinedRef(user.uid).get().then(joinedDoc=>{
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
              inventory=[]; purchases=[]; receipts=[]; deletedInventoryIds=[]; deletedReceiptIds=[]; deletedPurchaseIds=[]; aliasMap={};
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
              categories: categories ? categories.slice() : categories
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
          }).catch(err=>{
            console.error('[Dusty] joined-team lookup failed:', err);
            attachFirestoreListeners(user.uid);
            attachTeamListener();
            render();
          });
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
// isTrialUser(): sin cuenta, o con cuenta anónima — los límites del trial aplican
// igual en los dos casos (el primero es solo "todavía ni escaneó nada").
const TRIAL_INVENTORY_LIMIT = 30;
function isTrialUser(){ return !currentUser || currentUser.isAnonymous; }
let trialSigninPromise = null;
function ensureTrialAccount(){
  if(currentUser) return Promise.resolve(currentUser);
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

let cloudSyncDirty = false;
let cloudSyncDebounceTimer = null;
// Reintento con backoff exponencial cuando syncAllToFirestore() falla (ver más abajo):
// arranca en 2s y se duplica en cada fallo consecutivo hasta un tope de 60s, y se
// resetea apenas un intento vuelve a tener éxito.
let cloudSyncRetryTimer = null;
let cloudSyncRetryDelayMs = 2000;
const CLOUD_SYNC_RETRY_MAX_MS = 60000;
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
    const ops = [];
    const invIds = {};
    inventory.forEach(i=>{ invIds[i.id]=true; ops.push({ref:inventoryRef(uid).doc(i.id), data:JSON.parse(JSON.stringify(i))}); });
    if(lastKnownRemoteInventoryIds) lastKnownRemoteInventoryIds.forEach(id=>{ if(!invIds[id]) ops.push({ref:inventoryRef(uid).doc(id), del:true}); });
    // Además del diff de arriba (que depende de que ya haya llegado un snapshot en tiempo
    // real), se borra explícitamente cualquier producto marcado como borrado — cubre el
    // caso en que se borra un producto ANTES de que llegue el primer snapshot de la sesión.
    deletedInventoryIds.forEach(id=>{ if(!invIds[id]) ops.push({ref:inventoryRef(uid).doc(id), del:true}); });
    const purIds = {};
    purchases.forEach(p=>{ if(!p || !p.id) return; purIds[p.id]=true; ops.push({ref:purchasesRef(uid).doc(p.id), data:JSON.parse(JSON.stringify(p))}); });
    if(lastKnownRemotePurchaseIds) lastKnownRemotePurchaseIds.forEach(id=>{ if(!purIds[id]) ops.push({ref:purchasesRef(uid).doc(id), del:true}); });
    // Igual que con inventario: borra explícitamente cualquier compra marcada como borrada,
    // por si se borró antes de que llegara el primer snapshot de la sesión.
    deletedPurchaseIds.forEach(id=>{ if(!purIds[id]) ops.push({ref:purchasesRef(uid).doc(id), del:true}); });
    const recIds = {};
    // El guard "!r.id" es clave: un recibo fantasma (un doc recreado con merge:true tras
    // borrarlo a mitad de subida de fotos) puede entrar al array sin id. Sin este guard,
    // receiptsRef(uid).doc(undefined) tira una excepción síncrona que deja cloudSyncDirty
    // en true para SIEMPRE -> la sincronización entera queda muerta hasta limpiar a mano.
    receipts.forEach(r=>{ if(!r || !r.id) return; recIds[r.id]=true; ops.push({ref:receiptsRef(uid).doc(r.id), data:JSON.parse(JSON.stringify(receiptForCloud(r)))}); });
    if(lastKnownRemoteReceiptIds) lastKnownRemoteReceiptIds.forEach(id=>{ if(!recIds[id]) ops.push({ref:receiptsRef(uid).doc(id), del:true}); });
    deletedReceiptIds.forEach(id=>{ if(!recIds[id]) ops.push({ref:receiptsRef(uid).doc(id), del:true}); });
    ops.push({ref:metaRef(uid), data:JSON.parse(JSON.stringify({
      aliasMap, priceAlertThreshold, cycleCountPct, cycleCountIntervalDays, cycleCountLastDate, cycleCountCursor, deletedInventoryIds, deletedReceiptIds, deletedPurchaseIds, businessName, monthlyBudget, categories
    }))});

    const CHUNK = 450;
    const commits = [];
    for(let i=0; i<ops.length; i+=CHUNK){
      const batch = firebase.firestore().batch();
      ops.slice(i, i+CHUNK).forEach(op=>{ if(op.del) batch.delete(op.ref); else batch.set(op.ref, op.data); });
      commits.push(batch.commit());
    }
    return Promise.all(commits).then(()=>{
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
  if(err && err.code==='permission-denied'){ handleSyncPermissionDenied(err); return; }
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
  if(snapshot.metadata.hasPendingWrites || cloudSyncDirty) return;
  // Este es el primer dato de inventario que de verdad vino de Firestore desde que
  // arrancó la página (o el único momento en que sabemos con certeza que la nube
  // realmente no tiene nada) -- recién acá es seguro confiar en inventory.length
  // para decidir si mostrar el cartel de "no tenés productos todavía".
  cloudSyncPending = false;
  applyingRemoteSnapshot = true;
  lastKnownRemoteInventoryIds = snapshot.docs.map(d=>d.id);
  // Último resguardo: si por cualquier motivo un producto marcado como borrado todavía
  // llega en este snapshot (por ejemplo, el reconcile de arriba no había terminado de
  // borrarlo en la nube todavía), nunca se vuelve a mostrar localmente.
  const nextInventory = snapshot.docs.map(d=>d.data()).filter(i=>!deletedInventoryIds.includes(i.id));
  if(!sameJSON(nextInventory, inventory)){
    inventory = nextInventory;
    saveState(); scheduleCloudTriggeredRender();
  }
  applyingRemoteSnapshot = false;
}
function applyRemotePurchasesSnapshot(snapshot){
  if(snapshot.metadata.hasPendingWrites || cloudSyncDirty) return;
  applyingRemoteSnapshot = true;
  lastKnownRemotePurchaseIds = snapshot.docs.map(d=>d.id);
  const nextPurchases = snapshot.docs.map(d=>d.data()).filter(p=>!deletedPurchaseIds.includes(p.id));
  if(!sameJSON(nextPurchases, purchases)){
    purchases = nextPurchases;
    saveState(); scheduleCloudTriggeredRender();
  }
  applyingRemoteSnapshot = false;
}
function applyRemoteReceiptsSnapshot(snapshot){
  if(snapshot.metadata.hasPendingWrites || cloudSyncDirty) return;
  applyingRemoteSnapshot = true;
  lastKnownRemoteReceiptIds = snapshot.docs.map(d=>d.id);
  const oldReceipts = receipts;
  const nextReceipts = snapshot.docs.map(d=>{
    const remote = d.data();
    // Si este dispositivo ya tiene las fotos de este recibo en base64 (las
    // escaneó él mismo), las conserva — es instantáneo y no depende de la red.
    // Si no (otro dispositivo o compañero de equipo lo escaneó), usa las URLs de
    // Storage que ya vienen en el doc remoto — antes acá quedaba un array vacío
    // porque las fotos nunca llegaban a la nube; ahora si.
    const local = oldReceipts.find(r=>r.id===remote.id);
    remote.images = (local && local.images && local.images.length>0) ? local.images : (remote.images || []);
    return remote;
  })
    // Filtra recibos con lápida (borrados en otro dispositivo) y recibos fantasma sin id
    // (un doc recreado por una subida de fotos tardía tras borrarlo) — este último, además
    // de no tener sentido mostrarlo, es justo el que rompía la sincronización en el sync.
    .filter(r=>r && r.id && !deletedReceiptIds.includes(r.id));
  if(!sameJSON(nextReceipts, oldReceipts)){
    receipts = nextReceipts;
    saveState(); scheduleCloudTriggeredRender();
  }
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
  const currentMeta = {aliasMap, priceAlertThreshold, cycleCountPct, cycleCountIntervalDays, cycleCountLastDate, cycleCountCursor, deletedInventoryIds, deletedReceiptIds, deletedPurchaseIds, businessName, monthlyBudget, categories};
  if(sameJSON(incomingMeta, currentMeta)) return;
  applyingRemoteSnapshot = true;
  applyStateData(incomingMeta);
  saveState(); scheduleCloudTriggeredRender();
  applyingRemoteSnapshot = false;
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
  inventory=[]; purchases=[]; receipts=[]; deletedInventoryIds=[]; deletedReceiptIds=[]; deletedPurchaseIds=[]; aliasMap={};
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
  let code = '';
  for(let i=0;i<6;i++) code += chars[Math.floor(Math.random()*chars.length)];
  return code;
}
function ensureInviteCode(){
  if(teamInviteCode || !currentUser) return;
  teamLoading = true; render();
  teamRef(currentUser.uid).get().then(doc=>{
    if(doc.exists && doc.data().inviteCode) return doc.data().inviteCode;
    const code = generateInviteCode();
    return Promise.all([
      teamRef(currentUser.uid).set({inviteCode: code}),
      inviteCodeRef(code).set({ownerUid: currentUser.uid, ownerEmail: currentUserLabel()})
    ]).then(()=>code);
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
      inventory=[]; purchases=[]; receipts=[]; deletedInventoryIds=[]; deletedReceiptIds=[]; deletedPurchaseIds=[]; aliasMap={};
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
  membersRef(currentUser.uid).doc(memberId).delete().catch(err=>{
    console.error('[Dusty] remove member failed:', err);
    alert(t('team_err_generic'));
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
    remoteDeletedIds.forEach(id=>{ if(!deletedInventoryIds.includes(id)){ deletedInventoryIds.push(id); deletedIdsChanged = true; } });
    const deletedSet = new Set(deletedInventoryIds);

    // Mismas lápidas para recibos y compras: se fusionan las de la nube con las locales, y
    // cualquier recibo/compra de la nube que caiga en esas listas se borra ahora, antes de
    // que los listeners lo traigan de vuelta. Sin esto, borrar un recibo con un compañero
    // offline no se propagaba (solo el inventario tenía este mecanismo).
    const remoteDeletedRecIds = Array.isArray(remoteMetaData.deletedReceiptIds) ? remoteMetaData.deletedReceiptIds : [];
    remoteDeletedRecIds.forEach(id=>{ if(!deletedReceiptIds.includes(id)){ deletedReceiptIds.push(id); deletedIdsChanged = true; } });
    const remoteDeletedPurIds = Array.isArray(remoteMetaData.deletedPurchaseIds) ? remoteMetaData.deletedPurchaseIds : [];
    remoteDeletedPurIds.forEach(id=>{ if(!deletedPurchaseIds.includes(id)){ deletedPurchaseIds.push(id); deletedIdsChanged = true; } });
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
    const idRemap = {};
    const newInv = [];
    localSnapshot.inventory.forEach(i=>{
      if(remoteInvIds.has(i.id) || deletedSet.has(i.id)) return;
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
    const needsMeta = !metaSnap.exists || Object.keys(idRemap).length>0 || deletedIdsChanged;
    if(newInv.length===0 && missingPur.length===0 && missingRec.length===0 && remoteTombstonedIds.length===0 && remoteTombstonedRecIds.length===0 && remoteTombstonedPurIds.length===0 && !needsMeta) return null;
    // Mismo límite de 500 operaciones por batch que syncAllToFirestore() — un primer
    // sincronizado grande (por ejemplo, activar la nube con cientos de productos ya
    // cargados localmente) también puede pasarse, así que se reparte igual.
    const ops = [];
    newInv.forEach(i=>ops.push({ref:inventoryRef(uid).doc(i.id), data:JSON.parse(JSON.stringify(i))}));
    remoteTombstonedIds.forEach(id=>ops.push({ref:inventoryRef(uid).doc(id), del:true}));
    remoteTombstonedRecIds.forEach(id=>ops.push({ref:receiptsRef(uid).doc(id), del:true}));
    remoteTombstonedPurIds.forEach(id=>ops.push({ref:purchasesRef(uid).doc(id), del:true}));
    missingPur.forEach(p=>ops.push({ref:purchasesRef(uid).doc(p.id), data:JSON.parse(JSON.stringify(p))}));
    missingRec.forEach(r=>ops.push({ref:receiptsRef(uid).doc(r.id), data:JSON.parse(JSON.stringify(receiptForCloud(r)))}));
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
        businessName: metaSnap.exists ? remoteMeta.businessName : localSnapshot.businessName,
        monthlyBudget: metaSnap.exists ? (remoteMeta.monthlyBudget===undefined ? null : remoteMeta.monthlyBudget) : localSnapshot.monthlyBudget,
        categories: metaSnap.exists ? (remoteMeta.categories || localSnapshot.categories) : localSnapshot.categories,
        deletedInventoryIds, deletedReceiptIds, deletedPurchaseIds
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

