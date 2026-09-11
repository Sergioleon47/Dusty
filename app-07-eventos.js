/* ================= EVENTOS ================= */
// Varios controles clave de la app (el botón grande de "Escanear", cada tarjeta de
// recibo, las celdas del calendario, el ícono de subir foto) son <div>/<span> con
// onclick nada más — sin tabindex ni rol, un usuario que navega solo con teclado no
// puede llegar a ellos ni activarlos. Se los marca acá, en un solo lugar genérico
// (en vez de repetir tabindex/role/keydown a mano en cada punto de render), así que
// cualquier onclick que ya se les haya asignado en attachEvents() sigue funcionando
// igual con Enter/Espacio.
function makeKeyboardClickable(el){
  // Los atributos se re-ponen SIEMPRE: las plantillas no los emiten, así que
  // morphdom se los quita al nodo conservado en cada parcheo (morphAttrs borra
  // todo atributo que no esté en el HTML nuevo). Por eso mismo el guard de "ya
  // cableado" NO puede vivir en el atributo tabindex — vivía ahí, y como morphdom
  // lo borraba, cada render volvía a pasar el guard y apilaba OTRO listener de
  // keydown en el mismo nodo (Enter disparaba N clicks tras N renders). El guard
  // vive ahora en una propiedad del nodo, que morphdom no toca.
  el.setAttribute('tabindex','0');
  if(!el.hasAttribute('role')) el.setAttribute('role','button');
  if(el.__kbClickable) return;
  el.__kbClickable = true;
  el.addEventListener('keydown', e=>{
    if(e.key==='Enter' || e.key===' '){ e.preventDefault(); el.click(); }
  });
}
/* ===== Accesibilidad de modales, genérica para los ~24 (sin tocar plantillas) =====
   - role="dialog" + aria-modal en cada .modal (atributos idempotentes por render;
     morphdom puede quitarlos al parchear, así que se re-aplican como los tabindex
     de makeKeyboardClickable).
   - Al ABRIR un modal, el foco entra a su primer control y se recuerda dónde
     estaba; al cerrarse el último modal, el foco vuelve ahí — sin esto, un usuario
     de teclado/lector de pantalla quedaba "detrás" del overlay.
   - Trampa de Tab (listener de document, una sola vez): con un modal abierto, Tab
     circula solo entre los controles del modal DE ARRIBA. */
let lastOverlayCount = 0;
let focusBeforeModal = null;
function modalFocusables(overlay){
  return [...overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter(el=>!el.disabled && el.offsetParent!==null);
}
function topOverlay(){
  const all = document.querySelectorAll('.overlay');
  return all.length ? all[all.length-1] : null;
}
function manageModalA11y(){
  const overlays = document.querySelectorAll('.overlay');
  overlays.forEach(ov=>{
    const modal = ov.querySelector('.modal');
    if(modal){
      modal.setAttribute('role','dialog');
      modal.setAttribute('aria-modal','true');
      ensureModalBackBtn(ov, modal);
    }
  });
  const count = overlays.length;
  if(count > lastOverlayCount){
    // Se abrió un modal: recordar el foco de la página y entrar al modal.
    if(lastOverlayCount === 0) focusBeforeModal = document.activeElement;
    const top = topOverlay();
    // El foco entra al DIÁLOGO (contenedor con tabindex=-1), no a un campo de
    // texto: enfocar un input abría el teclado del teléfono sin que nadie lo
    // pidiera (feedback del usuario). Lectores de pantalla anuncian el diálogo
    // igual, y Tab lleva al primer control cuando el usuario quiere.
    const modalEl = top ? top.querySelector('.modal') : null;
    if(modalEl && (!document.activeElement || !top.contains(document.activeElement))){
      modalEl.setAttribute('tabindex','-1');
      try{ modalEl.focus({preventScroll:true}); }catch(e){}
    }
  } else if(count === 0 && lastOverlayCount > 0){
    // Se cerró el último modal: devolver el foco a donde estaba.
    if(focusBeforeModal && document.contains(focusBeforeModal)){
      try{ focusBeforeModal.focus({preventScroll:true}); }catch(e){}
    }
    focusBeforeModal = null;
  }
  lastOverlayCount = count;
}
/* "ATRÁS" ARRIBA EN TODAS LAS PANTALLAS (pedido del usuario 2026-09-08: "a
   veces entro y no tengo forma de darle atrás"). De 38 modales solo 4 traían
   la ✕ arriba; el resto cerraba con un Cancelar/Cerrar al FINAL (en los
   largos, fuera de la vista) o tocando fuera. Acá se inyecta la misma ✕
   (.modal-close-btn) como primer hijo de cada .modal que no la tenga, y al
   tocarla se usa el cierre PROPIO del modal, sin duplicar lógica: primero el
   botón btn-close-* del modal, si no su btn-cancel-*, y si no hay ninguno
   el toque fuera (mousedown sobre el overlay, que cada uno ya escucha).
   Se saltan los que ya traen su X propia. (La introducción no es un .overlay
   — vive fuera de #app, ver startOnboarding — así que no pasa por acá.) */
function ensureModalBackBtn(ov, modal){
  if(modal.querySelector('.modal-close-btn')) return;
  if(modal.querySelector('button[id$="-x"]')) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'modal-close-btn modal-back-btn';
  btn.setAttribute('aria-label', t('btn_close'));
  btn.textContent = '✕';
  btn.onclick = (ev)=>{
    ev.preventDefault(); ev.stopPropagation();
    closeOverlayLikeBackBtn(ov);
  };
  modal.prepend(btn);
}
/* Cierra un modal usando SU PROPIO cierre, sin duplicar lógica: primero el
   botón btn-close-* del modal, si no su btn-cancel-*, y si no tiene ninguno el
   toque fuera (mousedown sobre el overlay, que cada modal ya escucha). Lo usan
   la ✕ inyectada arriba y el botón físico "atrás" de Android (ver
   attachHardwareBackButton), así los dos cierran exactamente igual. */
function closeOverlayLikeBackBtn(ov){
  // .full-sheet además de .modal: Recibos dejó de ser pestaña y se abre como
  // hoja a pantalla completa (ver receiptsSheet en app-05), que no usa .modal.
  // Sin esto, "atrás" caía al mousedown de abajo — funcionaba de casualidad, no
  // por diseño, y sin pasar por el cierre con transición.
  const modal = ov.querySelector('.modal') || ov.querySelector('.full-sheet');
  const own = modal && (modal.querySelector('button[id^="btn-close-"]:not(.modal-back-btn)')
    || modal.querySelector('button[id^="btn-cancel-"]'));
  if(own){ own.click(); return; }
  ov.dispatchEvent(new MouseEvent('mousedown', {bubbles:true, cancelable:true}));
}
/* BOTÓN FÍSICO "ATRÁS" DE ANDROID (auditoría 2026-09-08). No lo escuchaba nadie:
   ni el proyecto nativo (MainActivity es el BridgeActivity pelado), ni el código
   web (no hay pushState/popstate). Sin listener, Capacitor lo resuelve con el
   historial del WebView, y como esta app nunca apila entradas, el historial está
   vacío: con un modal abierto encima, "atrás" CERRABA LA APP ENTERA en vez de
   cerrar el modal. Es el mismo problema que motivó la ✕ de arriba ("a veces
   entro y no tengo forma de darle atrás"), pero por el gesto que un usuario de
   Android usa primero.
   Orden de prioridad, el estándar de Android: lo de más arriba primero, y salir
   de la app solo desde la pantalla inicial.
   Se cablea UNA vez; si los plugins de Capacitor todavía no cargaron, no marca
   la bandera y el próximo render lo reintenta solo. En el navegador el plugin no
   existe y esto es un no-op. */
let hardwareBackAttached = false;
function attachHardwareBackButton(){
  if(hardwareBackAttached) return;
  const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if(!App || !App.addListener) return;
  hardwareBackAttached = true;
  App.addListener('backButton', ()=>{
    // 0. Introducción (primera apertura, ver startOnboarding): no se puede
    //    descartar — hay que elegir idioma y tema para que la app se entienda —
    //    así que "atrás" sale, como en la primera pantalla de cualquier app.
    if(document.getElementById('ob-root')){ if(App.exitApp) App.exitApp(); return; }
    // 0b. Despedida (la cuenta ya se borró, ver openGoodbye): no hay a dónde
    //     volver — "atrás" cierra la app.
    if(document.getElementById('gb-root')){ if(App.exitApp) App.exitApp(); return; }
    // 1. Modal abierto: se cierra el de más arriba (los modales se apilan).
    const ov = topOverlay();
    if(ov){
      closeOverlayLikeBackBtn(ov);
      return;
    }
    // 1b. Página de suscripción: "atrás" equivale a "ver mis datos mientras
    //     tanto" — se esconde y la app queda en solo lectura, sin salir.
    if(document.getElementById('pw-root')){ closePaywall(true); return; }
    // 2. Hoja a página completa (calculadora de pedido, resumen del mes): no son
    //    .overlay, viven aparte — se cierran con su propia ✕ para que guarden su
    //    estado igual que si la tocaras.
    const sheet = document.querySelector('.oc-sheet.open');
    if(sheet){
      const cerrar = sheet.querySelector('button.oc-close');
      if(cerrar){ cerrar.click(); return; }
    }
    // 3. En otra pestaña: vuelve al Dashboard, animando el carrusel como
    //    cualquier cambio de pestaña (no un salto seco).
    if(activeTab !== TAB_ORDER[0]){ switchToTab(TAB_ORDER[0]); return; }
    // 4. Ya en el Dashboard y sin nada abierto: recién acá sale de la app.
    if(App.exitApp) App.exitApp();
  });
}
let modalTabTrapAttached = false;
// "Edit budget" (Dashboard) abre el modal de ajustes pidiendo foco directo en el
// campo de presupuesto — se consume en el attach del overlay, un solo render.
// Selector de archivo + resize para la foto de un producto — lo usan el toque en
// la miniatura sin foto (lista) y el botón "cambiar" del visor de foto.
/* esReceta: una pieza del catálogo guarda la foto igual que un ítem (.photo),
   pero además hay que subirla a Storage. Antes eso se resolvía sondeando con un
   setInterval desde el que llamaba; acá se hace donde de verdad se sabe que la
   foto cambió. */
function promptItemPhotoUpload(item, esReceta){
  const input = document.createElement('input');
  input.type='file';
  input.accept='image/*';
  input.style.display='none';
  document.body.appendChild(input);
  // Si el usuario cierra el selector sin elegir, "change" nunca dispara — sin esto
  // el <input> quedaba huérfano en el body acumulándose en cada intento cancelado.
  // "cancel" no está en todos los navegadores; donde no, el peor caso es el de antes.
  input.addEventListener('cancel', ()=>{ if(input.parentNode) input.parentNode.removeChild(input); });
  input.onchange=async ()=>{
    const file=input.files[0];
    if(input.parentNode) input.parentNode.removeChild(input);
    if(!file || !/^image\//.test(file.type)) return;
    try{
      const img = await loadImageFromFile(file);
      item.photo = resizeToBase64(img, ITEM_PHOTO_SIDE, ITEM_PHOTO_QUALITY);
      saveState();
      render();
      if(esReceta) uploadRecipePhoto(item);
    }catch(err){
      showToast(err.message || t('err_img_process'), 'error');
    }
  };
  input.click();
}
function attachModalTabTrap(){
  if(modalTabTrapAttached) return;
  modalTabTrapAttached = true;
  document.addEventListener('keydown', (e)=>{
    if(e.key !== 'Tab') return;
    const top = topOverlay();
    if(!top) return;
    const focusables = modalFocusables(top);
    if(focusables.length === 0) return;
    const first = focusables[0], last = focusables[focusables.length-1];
    const inside = top.contains(document.activeElement);
    if(!inside){ e.preventDefault(); first.focus(); return; }
    if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  });
}
/* RECIBOS A PANTALLA COMPLETA, desde la tarjeta del calendario del Dashboard
   (pedido del usuario 2026-09-10: "a la hora de tocar salga tipo iOS dinámico").
   El calendario chiquito de la tarjeta y el grande de la hoja comparten el mismo
   view-transition-name, así que el navegador AGRANDA uno hasta el otro en vez de
   que la hoja aparezca de golpe. Es el mismo mecanismo que ya usa el cambio de
   vista del Inventario (invLayoutVtActive en app-04), no una animación nueva.
   Donde no hay View Transitions (Safari viejo, Firefox) el if de abajo cae al
   render de siempre: se abre igual, sin el agrandado. */
function openReceiptsSheet(){
  /* Un solo destino mental —"tocá el calendario y vas a tus recibos"— por dos
     caminos: si Recibos todavía es pestaña (negocio que no fabrica), se cambia de
     pestaña como siempre; si Producción le tomó el lugar, se abre la hoja. */
  if(TAB_ORDER[2]==='recibos'){ switchToTab('recibos'); return; }
  // La tarjeta muestra el mes de HOY: el calendario grande abre en ese mismo mes,
  // no en el último que se hojeó. Lo que tocaste es lo que ves.
  calendarViewMonth = localMonthStr();
  calendarShowYearPicker = false;
  // Mismo fundido que las hojas de Servicios (svcShow, app-15), que además
  // redibuja a mano si el navegador aborta la transición con la app en segundo plano.
  svcShow(()=>{ showReceiptsSheet = true; });
}
function closeReceiptsSheet(){
  svcShow(()=>{ showReceiptsSheet = false; });
}
function attachEvents(){
  /* Esta funcion tenia 1753 lineas y hacia TODO. Ahora es lo que deberia ser: lo
     que de verdad es global, y una llamada por pantalla. Cada pantalla se engancha
     sus handlers en su propio archivo — el mismo patron que Produccion y la
     calculadora de pedido ya usaban.
     El orden entre pantallas no importa: cada bloque engancha elementos distintos,
     y makeKeyboardClickable llama a el.click() en el momento del evento, no al
     enganchar. Lo global va primero igual, como corria antes. */
  /* TOCAR LA PESTANA EN LA QUE YA ESTAS LA REINICIA (pedido del usuario
     2026-09-10: "con tan solo cliquear, me vuelva para el menu de inventory").
     Estando en Critico / Toca contar / Sin foto, lo primero que hace cualquiera
     para salir es tocar INVENTARIO abajo — y hasta ahora eso no hacia nada,
     porque switchToTab con la pestana ya activa solo asienta el carrusel. Es el
     gesto de siempre en cualquier app: la pestana activa te devuelve al inicio.
     Irse a otra pestana YA limpiaba el filtro (ver switchToTab en app-06); esto
     cubre el caso de quedarse, que es el que dejaba encerrado.
     La busqueda escrita no se toca: se ve, tiene su texto a la vista y su propia
     equis. El filtro es el que no tenia salida visible. */
  document.querySelectorAll('.bottom-nav-item').forEach(t=>{
    t.onclick=()=>{
      const destino = t.dataset.tab;
      if(destino===activeTab && destino==='inventario' && invQuickFilter){
        invQuickFilter = null;
        render();
        return;
      }
      switchToTab(destino);
    };
  });
  manageModalA11y();
  attachModalTabTrap();
  document.querySelectorAll('#btn-scan-fab, [data-view-receipt], [data-cal-day], [data-photo-item], [data-open-item], [data-history-item], [data-cat-toggle], [data-assign-photo], #btn-critical-alerts, [data-open-asset], [data-open-job], [data-edit-maint], [data-edit-service]').forEach(makeKeyboardClickable);
  attachViewSwipeHandlers();
  attachHardwareBackButton();
  attachCategoryChipDragHandlers();
  attachDashboardEvents();
  attachReportEvents();
  attachInventoryEvents();
  attachScannerEvents();
  attachSettingsEvents();
  attachAccountEvents();
  attachProductionEvents();
  attachServicesEvents();
  // Calculadora de pedido (tarjeta + panel en Inventario) — app-05.
  attachOrderCalcEvents();
}

function closeItemModal(){ showItemModal=false; editingItem=null; draftItem=null; render(); }

/* Guarda la nota escrita en el modal de día. El parser de Nudgy (buildCalNote)
   decide si es una nota fija de ese día, una fecha que el texto pide explícita
   ("mañana", "el 15 de octubre") o una recurrencia ("cada mes") — el texto del
   usuario se guarda tal cual lo escribió, nunca se reformatea (regla de Nudgy). */
function addDayNote(){
  if(!requireWriteAccess()) return;
  const raw = dayNoteDraft.trim();
  if(!raw || !showDayModal) return;
  const built = buildCalNote(raw, showDayModal);
  calNotes.push(Object.assign(built, {
    id: uid('note'),
    createdAt: new Date().toISOString()
  }));
  dayNoteDraft='';
  saveState();
  logActivity('note_created', built.text);
  render();
}

document.addEventListener('keydown', (e)=>{
  if(e.key !== 'Escape') return;
  /* Las HOJAS (calculadora de pedido, cierre de mes) no son .overlay y hasta la
     auditoría 2026-09-09 solo las cerraba el botón atrás de Android: con teclado
     —la app corre igual en el navegador— Escape cerraba cualquier modal menos
     estas dos. Se cierran tocando su propia ✕ para que guarden su estado igual
     que si la tocaras, exactamente como hace attachHardwareBackButton. */
  const sheet = document.querySelector('.oc-sheet.open');
  if(sheet){
    const cerrar = sheet.querySelector('button.oc-close');
    if(cerrar){ cerrar.click(); return; }
  }
  if(showItemModal){ closeItemModal(); return; }
  if(showScanModal){ closeScanModal(); return; }
  if(showPriceHistoryModal){ closePriceHistoryModal(); return; }
  if(showMonthlySpendModal){ closeMonthlySpendModal(); return; }
  if(showCycleCountModal){ closeCycleCountModal(); return; }
  if(showBudgetModal){ closeBudgetModal(); return; }
  if(showAccountModal){ closeAccountModal(); return; }
  if(showAlertSettingsModal){ showAlertSettingsModal=false; render(); return; }
  if(showDeleteAccountModal){ if(!deleteAccountLoading) closeDeleteAccountModal(); return; }
  if(showSuggestedOrderModal){ showSuggestedOrderModal=false; render(); return; }
  if(typeof showReportBuilder!=='undefined' && showReportBuilder){ showReportBuilder=false; render(); return; }
  if(typeof showInvDetail!=='undefined' && showInvDetail){ showInvDetail=null; render(); return; }
  if(showReceiptDetail){ showReceiptDetail=null; render(); return; }
  if(showDayModal){ showDayModal=null; dayNoteDraft=''; render(); return; }
  // Estos faltaban: sin Escape, el modal de equipo además dejaba vivo su setInterval de
  // refresco (teamModalRefreshTimer) porque solo closeTeamModal() lo limpia. El de barras
  // apaga la cámara al cerrarse. La introducción (startOnboarding) es la primera
  // elección obligatoria de un usuario nuevo, así que a propósito NO se cierra con Escape.
  if(showTeamModal){ closeTeamModal(); return; }
  if(showAuthModal){ closeAuthModal(); return; }
  if(showActivityModal){ closeActivityModal(); return; }
  if(showCategoriesModal){ closeCategoriesModal(); return; }
  if(showFeedbackModal){ closeFeedbackModal(); return; }
  if(showBarcodeScanModal){ closeBarcodeScanModal(); return; }
  // El escáner de productos APAGA su cámara al cerrarse — si se cerrara por
  // cualquier otro camino sin apagar, scannerCamStream quedaría vivo y el guard
  // de render() dejaría la app entera sin redibujar nunca más.
  if(showProductBatchModal){ closeProductBatchModal(); return; }
  // Producción (app-08) — el escáner de estante apaga su cámara igual que el de productos.
  if(showShelfModal){ closeShelfModal(); return; }
  if(showProduceModal){ closeProduceModal(); return; }
  if(showRecipeModal){ closeRecipeModal(); return; }
  if(showOutflowsModal){ showOutflowsModal=false; render(); return; }
  if(showProductionHub){ showProductionHub=false; render(); return; }
});

// Si había una subida pendiente por fallo de red, no hace falta esperar a que venza
// el backoff de onCloudSyncWriteFailed() — apenas el navegador avisa que volvió la
// conexión, se reintenta ahí mismo.
window.addEventListener('online', ()=>{
  isOffline = false;
  render();
  if(cloudSyncDirty){ clearTimeout(cloudSyncRetryTimer); cloudSyncRetryDelayMs = 2000; syncAllToFirestore(); }
});
// Sin conexión: se avisa en el acto (franja fija + ícono de nube). La app sigue
// funcionando entera contra el estado local — eso es justo lo que dice la franja.
window.addEventListener('offline', ()=>{ isOffline = true; render(); });

/* Reporte de errores en producción: sin esto, si algo se rompe para un usuario real,
   el único rastro queda en SU consola del navegador — nadie más se entera salvo que
   avise. Se manda a una colección aparte de Firestore, de solo escritura (mismo
   criterio que "feedback": nadie puede leer el reporte de otro desde el cliente, el
   dueño los revisa directo desde la consola de Firebase).
   Solo se manda si currentUser ya existe — eso implica que Firebase ya terminó de
   cargar e inicializarse (currentUser solo se setea adentro de onAuthStateChanged).
   A alguien usando la app 100% local, sin cuenta, no hay a dónde mandarle el reporte,
   y forzar la carga de Firebase solo para esto le haría pagar el costo que
   ensurePatronFirebaseReady() evita a propósito para ese caso — se queda con el
   console.error de siempre, como antes.
   El tope de reportes por sesión evita que un error en loop (ej. algo que falla en
   cada render()) genere una tormenta de escrituras a Firestore. */
let clientErrorReportCount = 0;
const MAX_CLIENT_ERROR_REPORTS = 15;
/* COMPARTIR LAS FOTOS DE LO MARCADO (pedido del usuario 2026-09-09: "que de
   inmediato aparezcan los contactos del usuario o la forma en la que quiere
   enviar"). Abre la hoja nativa del sistema, que es la que muestra contactos y
   apps — nosotros no vemos ni elegimos nada de eso.

   SIN await antes de navigator.share(): iOS solo abre la hoja si se la llama
   dentro del gesto del usuario, y cualquier espera intermedia rompe esa cadena.
   Se puede porque la foto de un producto vive como base64 en el propio producto
   (ver promptItemPhotoUpload), así que el archivo se arma en memoria al toque.
   Un producto cuya foto solo exista como URL de Storage se saltea: bajarla
   pediría esperar, y perderíamos la hoja. */
function fileFromBase64(base64, mediaType, name){
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) arr[i] = bin.charCodeAt(i);
  return new File([arr], name, {type: mediaType || 'image/jpeg'});
}
function shareSelectedItemPhotos(){
  const items = inventory.filter(i=>invSelected.has(i.id));
  const files = [];
  const shared = [];
  items.forEach(it=>{
    if(!it.photo || !it.photo.base64) return;
    const safe = (it.name||'foto').replace(/[^\w\- ]+/g,'').trim().slice(0,40) || 'foto';
    // resizeToBase64 siempre produce JPEG; la extensión igual sale del tipo real
    // para que una foto vieja de otro formato no llegue mal nombrada.
    const ext = /png/i.test(it.photo.mediaType||'') ? '.png' : '.jpg';
    try{
      files.push(fileFromBase64(it.photo.base64, it.photo.mediaType, safe + ext));
      shared.push(it);
    }catch(e){}
  });
  if(files.length===0){ showToast(t('inv_share_no_photos'), 'info'); return; }
  // El texto acompaña a las fotos: nombre y precio de venta, que es lo que el
  // que recibe necesita para pedir. Sin precio cargado, solo el nombre.
  const text = shared.map(i=> i.name + (i.salePrice>0 ? ' · '+money(i.salePrice) : '')).join('\n');
  if(navigator.canShare && navigator.canShare({files})){
    navigator.share({files, text})
      .then(()=>{ if(files.length < items.length) showToast(t('inv_share_partial').replace('{n}', items.length-files.length), 'info'); })
      .catch(e=>{ if(!e || e.name!=='AbortError') showToast(t('inv_share_failed'), 'error'); });
    return;
  }
  // Escritorio o navegador sin compartir archivos: al menos va el texto.
  if(navigator.share){
    navigator.share({text}).catch(e=>{ if(!e || e.name!=='AbortError') showToast(t('inv_share_failed'), 'error'); });
    return;
  }
  showToast(t('inv_share_unsupported'), 'info');
}

function reportClientError(err, source){
  if(!currentUser || clientErrorReportCount>=MAX_CLIENT_ERROR_REPORTS) return;
  clientErrorReportCount++;
  try{
    firebase.firestore().collection('errorLogs').add({
      message: String((err && (err.message||err)) || err).slice(0,500),
      stack: (err && err.stack) ? String(err.stack).slice(0,2000) : '',
      source,
      uid: currentUser.uid,
      joinedOwnerUid: joinedOwnerUid || null,
      activeTab, uiLang,
      userAgent: navigator.userAgent,
      createdAt: new Date().toISOString()
    }).catch(()=>{}); // si esto también falla, no hay nada más que hacer
  }catch(e){}
}
// El navegador ya loguea solo estos dos casos a consola — acá solo se agrega el envío
// a Firestore, sin duplicar el console.error.
window.addEventListener('error', (e)=>{ reportClientError(e.error || e.message, 'window.onerror'); });
window.addEventListener('unhandledrejection', (e)=>{ reportClientError(e.reason, 'unhandledrejection'); });

loadState();
// Migración de stockFullRef (un solo arranque por dispositivo la necesita de
// verdad): los productos de antes de la feature no tienen marca de "lleno", y
// con la estimación vieja (qty×1.5) la barra quedaba CLAVADA en ~67% — al usar
// stock el objetivo estimado bajaba junto con él y el % no se movía. El nivel
// actual pasa a ser el 100% de cada uno; desde acá, solo las salidas lo bajan.
// No se llama saveState() acá (todavía no corrió todo el boot): el sello y el
// guardado los hace el primer saveState real, y mientras tanto la barra ya
// rinde bien con la marca en memoria.
inventory.forEach(i=>{ if(!i.stockFullRef && (i.qtyOnHand||0) > 0) i.stockFullRef = i.qtyOnHand; });
// ETAPA A del PLAN-SYNC: poblar la línea base de sellado AHORA, con lo recién
// cargado — lo que vino de localStorage no es una edición nueva. Sin esta pasada,
// la primera pasada de stampLocalEdits() ocurría recién en el PRIMER saveState de
// la sesión (una edición real del usuario) y se la tragaba como "solo poblar":
// el primer producto creado/editado de cada sesión quedaba sin updatedAt.
stampLocalEdits();
if(categories===null) categories = defaultCategories();
try{
  const savedCalSearch = localStorage.getItem('patron_cal_search');
  if(savedCalSearch) applyCalendarSearch(savedCalSearch);
}catch(e){}
// Si el link trae ?join=CODIGO (alguien compartió su código de invitación), se
// autocompleta para que la otra persona no tenga que transcribirlo a mano. Si este
// navegador ya tuvo sesión antes, se asume que va a usar el panel de equipo normal
// (ya logueado) en vez de crear una cuenta nueva con nombre+PIN.
// Vuelta de Stripe Checkout (create-checkout manda success_url/cancel_url con
// ?billing=ok|cancel). "ok" no significa "pagado": el pago se confirma cuando el
// webhook escribe meta/billing y el listener lo ve — mientras tanto la página de
// suscripción muestra "Confirmando tu pago…" (ver paywallAwaitPayment en app-06).
let billingReturn = null;
try{
  const br = new URLSearchParams(location.search).get('billing');
  if(br==='ok' || br==='cancel'){
    billingReturn = br;
    history.replaceState(null, '', location.pathname);
  }
}catch(e){}
try{
  const joinCodeFromUrl = new URLSearchParams(location.search).get('join');
  if(joinCodeFromUrl){
    history.replaceState(null, '', location.pathname);
    const code = joinCodeFromUrl.toUpperCase();
    if(localStorage.getItem('patron_had_session')){
      teamJoinCode = code;
    } else {
      authJoinCode = code; authMode = 'join'; showAuthModal = true;
    }
  }
}catch(e){}
render();
// Primera apertura en este dispositivo: la introducción (idioma → bienvenida →
// tema) se monta ENCIMA de la app ya pintada, en su propio nodo fuera de #app
// (ver startOnboarding en app-06). Va después de render() y antes de apagar el
// splash nativo, así lo primero que se ve al caer el splash ya es ella.
try{ if(!localStorage.getItem('patron_onboarded')) startOnboarding(); }catch(e){}
// Adentro de la app nativa (Capacitor/Android), el splash nativo se queda prendido
// a propósito (launchAutoHide:false en capacitor.config.json) hasta que se lo pide
// desde acá — si no, Android lo esconde apenas el WebView "existe", que puede ser
// bastante antes de que este script termine de cargar y pintar la pantalla real,
// dejando un hueco en blanco de por medio (un flash feo entre splash y contenido).
// Dos requestAnimationFrame en cadena (en vez de uno solo) esperan a que el navegador
// ya haya compuesto el frame con el HTML de arriba, no solo que lo haya encolado.
try{
  if(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.SplashScreen){
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      window.Capacitor.Plugins.SplashScreen.hide().catch(()=>{});
    }));
  }
}catch(e){}
// Si este navegador ya había iniciado sesión antes, se reconecta solo a la nube al
// abrir/refrescar la página — antes había que tocar el botón de nube de nuevo cada
// vez, lo cual además de molesto dejaba a la app sin conectar los listeners hasta
// ese click, aumentando la ventana en la que un dato local podía quedar sin subir.
try{
  if(localStorage.getItem('patron_had_session')){
    cloudSyncPending = true;
    ensurePatronFirebaseReady().catch(()=>{});
    // Resguardo: si por lo que sea (sin red, Firestore caído, un error que no se
    // esperaba) el primer snapshot nunca llega, no dejamos a alguien mirando la
    // pantalla de "cargando" para siempre -- después de un rato razonable se apaga
    // solo y se muestra lo que haya (los datos locales de este dispositivo siguen
    // siendo los mismos de antes, no se perdió nada por este timeout).
    setTimeout(()=>{ if(cloudSyncPending){ cloudSyncPending = false; render(); } }, 8000);
  }
}catch(e){}
/* ===== FOTO COMPARTIDA HACIA DUSTY (share_target del manifest) =====
   Android deja elegir Dusty en la hoja de "Compartir" de la galería o de la
   cámara. El service worker atiende ese POST, guarda las fotos en un caché
   aparte y redirige acá con ?compartir=listo (ver recibirCompartido en sw.js).
   Este arranque las levanta, abre el escaneo y las mete como páginas con
   addScanPage(), el mismo camino que si las hubiera elegido del selector — así
   no hay dos rutas distintas para lo mismo.
   Sin sesión de escaneo previa: openScanModal() deja el estado limpio primero.
   El caché se vacía siempre, incluso si algo falla, para que la próxima apertura
   de la app no vuelva a abrir el escaneo con una foto vieja. */
const SHARE_CACHE_APP = 'patron-compartido';
const SHARE_SLOT_APP = '/__compartido__';
async function tomarFotoCompartida(){
  let cache = null;
  try{
    if(!('caches' in window)) return;
    cache = await caches.open(SHARE_CACHE_APP);
    const conteo = await cache.match(SHARE_SLOT_APP);
    if(!conteo) return;
    const n = parseInt(await conteo.text(), 10) || 0;
    const archivos = [];
    for(let i=0;i<n;i++){
      const res = await cache.match(SHARE_SLOT_APP + '/' + i);
      if(!res) continue;
      const blob = await res.blob();
      if(!blob || !blob.size) continue;
      archivos.push(new File([blob], 'compartida-' + (i+1) + '.jpg',
        {type: blob.type || 'image/jpeg'}));
    }
    if(!archivos.length) return;
    openScanModal();
    // En orden y de a una (await), igual que el selector de galería: así las
    // páginas quedan en el orden en que las eligió, no en el que terminan.
    for(const f of archivos) await addScanPage(f);
  }catch(err){
    console.error('[Dusty] no se pudo abrir la foto compartida:', err);
    reportClientError(err, 'compartir');
  }finally{
    try{
      if(cache){
        const claves = await cache.keys();
        await Promise.all(claves.map(k=>cache.delete(k)));
      }
    }catch(e){}
    // La URL vuelve a la normal: recargar no debe re-disparar el escaneo.
    try{ history.replaceState(null, '', location.pathname); }catch(e){}
  }
}
/* Accesos directos del ícono (shortcuts del manifest): ?ir=escanear / ?ir=inventario. */
function aplicarAccesoDirecto(destino){
  if(destino === 'escanear'){ openScanModal(); }
  else if(TAB_ORDER.includes(destino)){
    activeTab = destino;
    try{ localStorage.setItem('patron_active_tab', activeTab); }catch(e){}
    render();
  }
  try{ history.replaceState(null, '', location.pathname); }catch(e){}
}
try{
  const params = new URLSearchParams(location.search);
  if(params.get('compartir') === 'listo') tomarFotoCompartida();
  else if(params.get('ir')) aplicarAccesoDirecto(params.get('ir'));
}catch(e){}

// Avisos de presupuesto (auditoría 2026-09-07): se arman recién después del
// arranque (y de la posible bajada de la nube) para no gritar con datos a medio
// cargar; el primer chequeo cubre el caso de abrir la app ya pasado el umbral.
setTimeout(()=>{ budgetAlertsArmed = true; checkBudgetAlerts(); if(typeof checkServiceAlerts==='function') checkServiceAlerts(); }, 2500);
