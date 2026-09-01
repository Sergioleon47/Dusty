/* ================= RENDER ================= */
/* render() reconstruye TODO el HTML de #app de una — no hace diffing. Si un dedo está
   en medio de un deslice entre pestañas (swipeGestureActive), reconstruir ahora
   reemplazaría el nodo .view-track que el gesto está animando a mano, y el propio
   código de attachViewSwipeHandlers lo detecta como "la pantalla cambió por debajo"
   y aborta el gesto en seco — se siente como que el deslice "no agarra" o se corta
   solo. Puede pasar por cualquier cosa que dispare un render en el momento menos
   pensado: un snapshot de Firestore llegando, el latido de presencia del modo equipo
   cada 30s, etc. En vez de perder esa actualización, se pospone y se aplica de una
   sola vez apenas el dedo suelta (ver flushPendingRenderIfAny, llamado desde
   endGestureImpl en attachViewSwipeHandlers). */
let swipeGestureActive = false;
let renderPendingAfterGesture = false;
let lastOverlayFlags = null;
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
function render(){
  // trackAnimating cubre el resorte de asentado (tap en la barra de abajo, o el
  // "suelto el dedo y termina de acomodarse" de un swipe) — swipeGestureActive por
  // sí solo no alcanza ahí porque ya se puso en false apenas se soltó el dedo (ver
  // endGestureImpl) o nunca llegó a ponerse en true (tocar un botón no es un
  // arrastre). Sin este chequeo, un render disparado desde afuera (un snapshot de
  // Firestore, el latido de presencia) durante esa ventana reemplaza el nodo
  // .view-track que el resorte todavía está animando a mano: el rAF en curso queda
  // animando un nodo huérfano (fuera del DOM, invisible) hasta que se asienta solo
  // y dispara un segundo redibujado tardío — se siente como un freeze seguido de un
  // salto brusco.
  // Mismo motivo que arriba, pero para la cámara del escaneo de código de barras:
  // mientras barcodeScannerInstance existe hay un <video> de verdad adentro de
  // #barcode-reader que la librería de códigos de barras maneja a mano — un
  // redibujado completo (un snapshot de Firestore llegando en el peor momento, por
  // ejemplo) le arrancaría el <video> por debajo sin avisarle, dejando la cámara
  // prendida sin feed visible y sin forma de apagarla. Importante: el chequeo es
  // sobre barcodeScannerInstance (¿la cámara ya está prendida de verdad?), NO sobre
  // barcodeScanState==='scanning' — ese estado se pone ANTES del primer render que
  // recién va a CREAR el <div id="barcode-reader">, así que frenar ese primer
  // render por el estado dejaría el modal sin aparecer nunca.
  // idScanStream: misma protección que barcodeScannerInstance pero para el <video>
  // del identificador por cámara (getUserMedia manejado a mano en app-06).
  if(swipeGestureActive || trackAnimating || barcodeScannerInstance || idScanStream){ renderPendingAfterGesture = true; return; }
  /* CERRAR un modal (o abrir/cerrar el detalle de recibo) se anima con la View
     Transitions API del navegador: startViewTransition() saca una captura del
     estado viejo y funde hacia el nuevo. Solo al cerrar, a propósito: al ABRIR el
     modal ya trae su propia entrada por CSS (overlayFadeIn + modalPopIn), así que
     la View Transition no sumaba nada — y sí costaba: la captura congela el frame
     justo en el instante del tap, y ese enganchón se veía como un "flick" al tocar
     el botón de la cámara. El cierre no tiene animación CSS propia (era un corte
     seco), ahí la transición es la que pone el fundido. La excepción es el detalle
     de recibo en ambas direcciones, porque su gracia es el morph tarjeta↔modal
     (view-transition-name compartido, ver receiptVtName()).
     Los renders de fondo (snapshots de Firestore, latidos de presencia, tipeo
     dentro de un modal) no cambian ninguna bandera y siguen siendo instantáneos.
     El modal de código de barras queda afuera a propósito (no participa de las
     banderas): openBarcodeScanModal() y el botón de reintento dependen de que el
     <div id="barcode-reader"> exista APENAS render() retorna (ver el comentario en
     openBarcodeScanModal), y startViewTransition aplica el cambio de DOM un
     instante después, de forma asíncrona — ese instante alcanza para que la
     promesa de la librería gane la carrera y arranque la cámara contra un div que
     todavía no existe. */
  const overlayFlags = [showItemModal, showScanModal, !!showReceiptDetail, !!showDayReceipts,
    showWelcomeModal, showLangChoiceModal, showAuthModal, showFeedbackModal,
    showDeleteAccountModal, showPriceHistoryModal, showMonthlySpendModal,
    showActivityModal, showTeamModal, showProductBatchModal, showIdScanModal];
  const RECEIPT_DETAIL_FLAG = 2; // índice de !!showReceiptDetail en overlayFlags
  let overlayClosed = false, receiptDetailToggled = false;
  if(lastOverlayFlags){
    overlayFlags.forEach((v,i)=>{
      if(v !== lastOverlayFlags[i]){
        if(i === RECEIPT_DETAIL_FLAG) receiptDetailToggled = true;
        if(!v) overlayClosed = true;
      }
    });
  }
  lastOverlayFlags = overlayFlags;
  if((overlayClosed || receiptDetailToggled) && document.startViewTransition && !reducedMotionQuery.matches){
    // Si llega otro render mientras esta transición sigue en curso, el navegador
    // descarta la vieja solo (startViewTransition se auto-cancela) — no hace falta
    // coordinar nada a mano.
    // Cuando la transición se saltea (app en segundo plano, otra transición la
    // pisa), el cambio de DOM se aplica igual pero la promesa `ready` rechaza — y
    // sin este catch cada salteo aparece como "Uncaught (in promise)" en consola.
    document.startViewTransition(()=>{ renderNow(); }).ready.catch(()=>{});
  } else {
    renderNow();
  }
}
function renderNow(){
  try{
    renderApp();
  }catch(err){
    console.error('Dusty render error:', err);
    reportClientError(err, 'render');
    renderCrashScreen(err);
  }
}
function flushPendingRenderIfAny(){
  if(renderPendingAfterGesture){ renderPendingAfterGesture = false; render(); }
}

/* Los 4 listeners de Firestore (inventario/compras/recibos/meta) llegan cada uno por
   su lado — en una red real casi nunca al mismo tiempo. Sin esto, reconectar a la
   nube redibuja la pantalla entera hasta 4 veces seguidas en menos de un segundo
   (cada redibujado vuelve a decodificar todas las fotos incrustadas), y se ve como
   que la información "parpadea" o desaparece y vuelve. Junta varias llegadas
   cercanas en el tiempo en un solo redibujado al final. Solo la usan esos 4
   handlers — las acciones directas del usuario (tocar un botón, etc.) siguen
   llamando a render() de una, sin esperar nada, para que se sientan instantáneas. */
let cloudRenderDebounceTimer = null;
function scheduleCloudTriggeredRender(){
  if(cloudRenderDebounceTimer) clearTimeout(cloudRenderDebounceTimer);
  cloudRenderDebounceTimer = setTimeout(()=>{ cloudRenderDebounceTimer = null; render(); }, 80);
}

/* Mismo problema que scheduleCloudTriggeredRender de arriba, pero disparado por el
   usuario en vez de la nube: los buscadores de recibos (por texto y por monto) llaman
   a esto en cada tecla, y como render() reconstruye #app entero, cada letra volvía a
   decodificar de cero todas las fotos de recibo visibles (la grilla de recibos, las
   miniaturas del calendario) — eso es lo que se sentía como que las fotos
   "parpadean"/desaparecen mientras se escribe. Juntar las teclas seguidas en un solo
   redibujado al final (como ya hacen los eventos de Firestore) evita ese redibujado
   de más sin perder la sensación de "busca mientras escribís". */
let searchRenderDebounceTimer = null;
function scheduleSearchTriggeredRender(afterRender){
  clearTimeout(searchRenderDebounceTimer);
  searchRenderDebounceTimer = setTimeout(()=>{ searchRenderDebounceTimer = null; render(); afterRender(); }, 150);
}

function renderApp(){
  const app = document.getElementById('app');
  document.documentElement.lang = uiLang;
  document.title = uiLang==='en' ? 'Dusty — Inventory' : 'Dusty — Inventario';
  const tabIdx = TAB_ORDER.indexOf(activeTab);
  const html = `
    ${topbar()}
    <div class="view-viewport">
      <div class="view-track" style="transform:translateX(-${tabIdx*(100/3)}%);">
        <div class="view-page">${dashboardView()}</div>
        <div class="view-page">${inventarioView()}</div>
        <div class="view-page">${recibosView()}</div>
      </div>
    </div>
    ${showItemModal ? itemModal() : ''}
    ${showBarcodeScanModal ? barcodeScanModal() : ''}
    ${showCategoriesModal ? categoriesModal() : ''}
    ${showActivityModal ? activityModal() : ''}
    ${showScanModal ? scanModal() : ''}
    ${showProductBatchModal ? productBatchModal() : ''}
    ${showIdScanModal ? idScanModal() : ''}
    ${showReceiptDetail ? receiptDetailModal() : ''}
    ${showDayReceipts ? dayReceiptsModal() : ''}
    ${showPriceHistoryModal ? priceHistoryModal() : ''}
    ${showMonthlySpendModal ? monthlySpendModal() : ''}
    ${showAlertSettingsModal ? alertSettingsModal() : ''}
    ${showDeleteAccountModal ? deleteAccountModal() : ''}
    ${showSuggestedOrderModal ? suggestedOrderModal() : ''}
    ${showCycleCountModal ? cycleCountModal() : ''}
    ${showLangChoiceModal ? langChoiceModal() : ''}
    ${showWelcomeModal ? welcomeModal() : ''}
    ${showAuthModal ? authModal() : ''}
    ${showTeamModal ? teamModal() : ''}
    ${showFeedbackModal ? feedbackModal() : ''}
    ${bottomNav()}
  `;
  /* Parcheo del DOM con morphdom en vez de app.innerHTML = html. El reemplazo
     total recreaba TODOS los nodos en cada render: cada <img> nuevo re-decodifica
     su foto (flash blanco visible con las base64 de los recibos), el scroll y el
     foco se pierden, y las animaciones CSS en curso se reinician. morphdom compara
     el HTML nuevo contra el DOM vivo y solo toca lo que cambió — un snapshot de
     Firestore que no cambia nada visible ahora no mueve ni un píxel.
     Dos reglas en onBeforeElUpdated:
     1. Subárbol idéntico → no entrar (es lo que preserva los <img> ya decodificados).
     2. El elemento con foco donde el usuario está escribiendo no se pisa nunca —
        un render de fondo a mitad de tipeo le borraría lo escrito o le movería el
        cursor.
     attachEvents() sigue corriendo completo después: todos sus handlers son
     propiedades on* (asignar pisa, no apila — por eso los overlays se convirtieron
     de addEventListener a onmousedown) o tienen guard propio (makeKeyboardClickable).
     Fallback: si morphdom no cargó (CDN bloqueado jamás aplica — es archivo local —
     pero un SW viejo podría no tenerlo cacheado offline), innerHTML como siempre. */
  if(typeof morphdom === 'function'){
    morphdom(app, `<div id="app">${html}</div>`, {
      onBeforeElUpdated(fromEl, toEl){
        if(fromEl.isEqualNode(toEl)) return false;
        if(fromEl === document.activeElement && (fromEl.tagName==='INPUT' || fromEl.tagName==='TEXTAREA' || fromEl.tagName==='SELECT')) return false;
        return true;
      }
    });
  } else {
    app.innerHTML = html;
  }
  attachEvents();
  syncViewportHeight();
}
// El alto de .view-viewport se fija al de la página activa nada más (ver nota en el
// CSS de .view-viewport) — se llama después de cada render() y también al terminar
// la animación de switchToTab(), porque ahí el DOM no se vuelve a dibujar de cero
// pero la página visible sí puede haber cambiado de alto.
function syncViewportHeight(){
  const viewport = document.querySelector('.view-viewport');
  const pages = document.querySelectorAll('.view-page');
  const idx = TAB_ORDER.indexOf(activeTab);
  if(!viewport || !pages[idx]) return;
  const contentHeight = pages[idx].getBoundingClientRect().height;
  // Si el contenido de la pestaña activa es corto (ej. Inventario filtrado al conteo
  // cíclico, con un solo producto) y no llega a tapar la pantalla hasta la barra de
  // abajo, se estira igual hasta ahí — si no, queda un hueco vacío mostrando el
  // degradé verde decorativo del header (pensado para asomar solo arriba, detrás del
  // topbar/dashboard) en medio de la pantalla, encima de la barra de navegación.
  const bottomNavEl = document.querySelector('.bottom-nav');
  const navHeight = bottomNavEl ? bottomNavEl.getBoundingClientRect().height : 0;
  const fillHeight = Math.max(0, window.innerHeight - viewport.getBoundingClientRect().top - navHeight);
  const totalHeight = Math.max(contentHeight, fillHeight);
  viewport.style.height = totalHeight + 'px';
  // El fondo gris solo arranca EXACTO donde termina el contenido real (contentHeight)
  // — arriba de esa línea queda transparente, tal como estaba siempre, para no tapar
  // el degradé verde de marca del <body> que se sigue viendo (a propósito) en los
  // huecos entre tarjetas cerca del header. Pintar TODO .view-viewport de gris de
  // punta a punta (como se probó antes) tapaba también esa parte de arriba y dejaba
  // un corte feo justo donde arranca el contenido — acá el corte cae exactamente
  // donde el contenido real ya terminó, así no se nota.
  viewport.style.background = totalHeight>contentHeight
    ? `linear-gradient(to bottom, transparent ${contentHeight}px, var(--bg) ${contentHeight}px)`
    : 'none';
}

function renderCrashScreen(err){
  const app = document.getElementById('app');
  if(!app) return;
  let lang = 'es';
  try{ lang = uiLang || 'es'; }catch(e){}
  const copy = lang==='en'
    ? {title:'Something went wrong', body:'Dusty hit an unexpected error and couldn’t continue. Your saved data is safe on this device — reloading usually fixes it.', btn:'Reload'}
    : {title:'Algo salió mal', body:'Dusty encontró un error inesperado y no pudo continuar. Tus datos guardados en este dispositivo están a salvo — recargar normalmente lo soluciona.', btn:'Recargar'};
  app.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;">
      <div style="background:var(--panel);border-radius:20px;box-shadow:var(--shadow);padding:32px 24px;max-width:360px;text-align:center;">
        <svg viewBox="0 0 24 24" style="width:40px;height:40px;stroke:var(--tomato);fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;margin-bottom:12px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div style="font-weight:800;font-size:18px;color:var(--ink);margin-bottom:8px;">${copy.title}</div>
        <div style="font-size:14px;color:var(--ink-soft);line-height:1.5;margin-bottom:20px;">${copy.body}</div>
        <button id="btn-render-crash-reload" style="background:var(--navy);color:#fff;border:none;border-radius:14px;padding:12px 24px;font-weight:700;font-size:14px;cursor:pointer;">${copy.btn}</button>
      </div>
    </div>`;
  const btn = document.getElementById('btn-render-crash-reload');
  if(btn) btn.onclick = () => location.reload();
}

function topbar(){
  return `
  <div class="topbar">
    <div class="brand">
      <div class="brand-mark">D</div>
      <div style="min-width:0;">
        <div class="brand-name">usty</div>
        ${joinedOwnerUid ? `
        <div class="account-owner-pill" title="${t('account_owner_hint')}">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
          ${escapeHtml(joinedOwnerEmail)}
        </div>
        ` : ''}
      </div>
    </div>
    <div class="topbar-actions" style="display:flex;gap:8px;">
      <button class="lang-toggle" id="btn-feedback" title="${t('btn_feedback')}">
        <svg viewBox="0 0 24 24" style="width:17px;height:17px;stroke:currentColor;fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </button>
      ${currentUser && !currentUser.isAnonymous ? `
      <button class="lang-toggle ${cloudSyncDirty ? 'pending' : 'synced'}" id="btn-cloud-sync" title="${cloudSyncDirty ? t('cloud_sync_pending') : t('cloud_sync_signed_in').replace('{email}', escapeHtml(currentUserLabel()))}">
        <svg viewBox="0 0 24 24" style="width:17px;height:17px;stroke:currentColor;fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;"><path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.6-1.5A4 4 0 0 0 6.5 16"/><path d="m9 15 2 2 4-4"/></svg>
      </button>
      ` : `
      <button class="cloud-signin-btn" id="btn-cloud-sign-in" title="${currentUser ? t('trial_upgrade_title') : t('cloud_sync_signed_out')}">
        <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0;"><path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.6-1.5A4 4 0 0 0 6.5 16"/></svg>
        <span>${currentUser ? t('trial_save_account_cta') : t('btn_account_cta')}</span>
      </button>
      `}
      <button class="lang-toggle" id="btn-alert-settings" title="${t('btn_alert_settings')}">
        <svg viewBox="0 0 24 24" style="width:17px;height:17px;stroke:currentColor;fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>
      </button>
      <button class="lang-toggle" id="btn-lang-toggle" title="${uiLang==='es'?'Switch to English':'Cambiar a español'}">${uiLang==='es'?'EN':'ES'}</button>
    </div>
  </div>`;
}

function bottomNav(){
  const items = [
    {tab:'dashboard', label:t('tab_dashboard'), icon:`<polyline points="3 11 12 4 21 11"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/>`},
    {tab:'inventario', label:t('tab_inventory'), icon:`<polygon points="12 3 21 7.5 21 16.5 12 21 3 16.5 3 7.5"/><polyline points="3 7.5 12 12 21 7.5"/><line x1="12" y1="12" x2="12" y2="21"/>`},
    {tab:'recibos', label:t('tab_receipts'), icon:`<path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2z"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/>`},
  ];
  return `
  <div class="bottom-nav">
    ${items.map(i=>`
      <button class="bottom-nav-item ${activeTab===i.tab?'active':''}" data-tab="${i.tab}">
        <svg viewBox="0 0 24 24">${i.icon}</svg>
        <span>${i.label}</span>
      </button>
    `).join('')}
  </div>`;
}

