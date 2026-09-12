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
  // scannerCamStream: misma protección que barcodeScannerInstance pero para el
  // <video> del escáner de productos (getUserMedia manejado a mano en app-06).
  // shelfCamStream: misma protección que scannerCamStream pero para el <video>
  // del escáner de estante (app-08).
  if(swipeGestureActive || trackAnimating || barcodeScannerInstance || scannerCamStream || shelfCamStream){ renderPendingAfterGesture = true; return; }
  /* La franja de "sin conexión" es fija y se apoya sobre la barra de abajo, así
     que le tiene que hacer lugar al contenido y a los avisos: esta clase es la
     que abre ese espacio en el CSS. Va acá arriba (antes de cualquier salida
     temprana de las de abajo) para que el estado de la clase nunca se atrase
     respecto de lo que se está dibujando. */
  document.documentElement.classList.toggle('sin-red', !!isOffline);
  // La página de suscripción vive fuera de #app; lo único que le cambia entre
  // renders es si la cuenta ya se guardó (paso 1) — ver paywallRefresh en app-06.
  paywallRefresh();
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
  const overlayFlags = [showItemModal, showScanModal, !!showReceiptDetail, !!showDayModal,
    showAuthModal, showFeedbackModal,
    showDeleteAccountModal, showPriceHistoryModal, showMonthlySpendModal,
    showActivityModal, showTeamModal, showProductBatchModal,
    showRecipeModal, showProduceModal, showShelfModal, showOutflowsModal, showProductionHub];
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
  // Cambio de vista del inventario (fila/2col/3col): mismo canal de View
  // Transition que el cierre de modales — con view-transition-name por tarjeta
  // (ver stockRowHtml), cada una anima hacia su nueva posición. Flag de un solo
  // uso: se consume acá, los renders siguientes vuelven a ser instantáneos.
  const invLayoutChanged = invLayoutTransitionPending;
  invLayoutTransitionPending = false;
  /* NOMBRES DE TRANSICIÓN A DEMANDA (auditoría de parpadeo 2026-09-08, medida
     con 150 productos y 120 recibos): antes cada tarjeta de producto y cada
     recibo llevaba su view-transition-name SIEMPRE, así que cualquier View
     Transition (cerrar un modal, abrir un recibo) capturaba ~270 capas — un congelado y un parpadeo por cada cierre en un
     inventario grande. Ahora el nombre existe solo en la transición que lo
     usa: el estado VIEJO se nombra a mano en el DOM justo antes de la captura,
     y el NUEVO lo pone el template mientras la bandera esté prendida. */
  const openingReceipt = receiptDetailToggled && showReceiptDetail ? showReceiptDetail : null;
  const closingReceipt = receiptDetailToggled && !showReceiptDetail ? lastReceiptDetailId : null;
  if(showReceiptDetail) lastReceiptDetailId = showReceiptDetail;
  if((overlayClosed || receiptDetailToggled || invLayoutChanged) && document.startViewTransition && !reducedMotionQuery.matches){
    if(invLayoutChanged){
      invLayoutVtActive = true;
      document.querySelectorAll('.inv-tile[data-ing-id]').forEach(el=>{ el.style.viewTransitionName = 'invtile-' + String(el.dataset.ingId).replace(/[^a-zA-Z0-9_-]/g, ''); });
    }
    receiptVtTargetId = openingReceipt || closingReceipt || null;
    if(openingReceipt){
      const card = document.querySelector(`.dish-card[data-view-receipt="${CSS.escape(String(openingReceipt))}"]`);
      if(card) card.style.viewTransitionName = receiptVtName(openingReceipt);
    }
    // Si llega otro render mientras esta transición sigue en curso, el navegador
    // descarta la vieja solo (startViewTransition se auto-cancela) — no hace falta
    // coordinar nada a mano.
    // Cuando la transición se saltea (app en segundo plano, otra transición la
    // pisa), el cambio de DOM se aplica igual pero la promesa `ready` rechaza — y
    // sin este catch cada salteo aparece como "Uncaught (in promise)" en consola.
    const vt = document.startViewTransition(()=>{ renderNow(); });
    vt.ready.catch(()=>{});
    const cleanup = ()=>{
      invLayoutVtActive = false; receiptVtTargetId = null;
      // Los nombres puestos a mano en el estado viejo no deben sobrevivir a la
      // transición (la próxima captura los volvería a contar).
      document.querySelectorAll('.inv-tile[data-ing-id]').forEach(el=>{ if(el.style.viewTransitionName) el.style.viewTransitionName = ''; });
      document.querySelectorAll('.dish-card[data-view-receipt]').forEach(el=>{ if(el.style.viewTransitionName) el.style.viewTransitionName = ''; });
    };
    vt.finished.then(cleanup, cleanup);
  } else {
    invLayoutVtActive = false; receiptVtTargetId = null;
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
/* Y además NUNCA mientras el usuario está scrolleando (auditoría de scroll
   2026-09-07): un snapshot que caía a mitad de un deslice vertical corría el
   template entero + morphdom + syncViewportHeight en el hilo principal justo
   entre dos cuadros — el cuadro perdido se ve como un tirón, y si el alto del
   documento cambiaba, el scroll se recortaba de golpe (el "salto"). El scroll
   deja huella (lastScrollAt, listener pasivo abajo) y el redibujado de nube
   espera a que el dedo/inercia hayan parado ~150ms. Los toques del usuario
   siguen llamando a render() directo: no pasan por acá. */
let lastScrollAt = 0;
const SCROLL_IDLE_MS = 150;
try{ window.addEventListener('scroll', ()=>{ lastScrollAt = performance.now(); }, {passive:true}); }catch(e){}
function scheduleCloudTriggeredRender(){
  if(cloudRenderDebounceTimer) clearTimeout(cloudRenderDebounceTimer);
  const fire = ()=>{
    const since = performance.now() - lastScrollAt;
    if(since < SCROLL_IDLE_MS){ cloudRenderDebounceTimer = setTimeout(fire, SCROLL_IDLE_MS - since + 10); return; }
    cloudRenderDebounceTimer = null;
    render();
  };
  cloudRenderDebounceTimer = setTimeout(fire, 80);
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
  // La tercera pestaña depende de si el negocio fabrica algo (ver refreshTabOrder
  // en app-01). Se recalcula acá para que aparezca en el mismo render en el que
  // el usuario guarda su primera receta.
  refreshTabOrder();
  document.documentElement.lang = uiLang;
  document.title = uiLang==='en' ? 'Dusty — Inventory' : 'Dusty — Inventario';
  const tabIdx = TAB_ORDER.indexOf(activeTab);
  // Índice de compras por producto para TODO este render (ver buildPurchasesByIng
  // en app-03) — se reconstruye en cada render, así nunca queda desactualizado
  // frente a mutaciones in-place del array de compras.
  purchasesByIngIndex = buildPurchasesByIng();
  // Cache financiero por render (periodFinancials/spendSplitForMonth) — mismo
  // criterio: vive un ciclo, se tira acá para que jamás muestre datos viejos.
  resetFinancialCache();
  /* El topbar (marca Dusty + botones de cuenta/ajustes/idioma) vive DENTRO de la
     página del Dashboard, no arriba del carrusel: la marca aparece una sola vez en
     la app, se desliza junto con el Dashboard en el swipe, e Inventario y Recibos
     arrancan desde arriba del todo — ese espacio queda libre para sus propias
     acciones (p. ej. el futuro escáner de estante). */
  const html = `
    <div class="view-viewport">
      ${/* .far en las páginas a 2+ pestañas de la activa: no se rasterizan
           (content-visibility, ver dusty.css) — la vecina inmediata queda
           entera para que el swipe la muestre sin pop. */''}
      <div class="view-track" style="transform:translateX(-${tabIdx*(100/TAB_ORDER.length)}%);">
      ${/* .active en la página visible: las animaciones infinitas (órbita y
           pulso del escáner del Dashboard, etc.) SOLO corren ahí — en la
           vecina quedan pausadas (dusty.css), no gastan compositor mientras
           se scrollea otra pestaña. */''}
        <div class="view-page${tabIdx===0?' active':''}${Math.abs(0-tabIdx)>1?' far':''}">${readOnlyBanner()}${topbar()}${dashboardView()}</div>
        <div class="view-page${tabIdx===1?' active':''}${Math.abs(1-tabIdx)>1?' far':''}">${TAB_ORDER[1]==='equipo' ? equipoView() : inventarioView()}</div>
        <div class="view-page${tabIdx===2?' active':''}${Math.abs(2-tabIdx)>1?' far':''}">${TAB_ORDER[2]==='produccion' ? produccionView() : recibosView()}</div>
      </div>
    </div>
    ${/* Presupuesto ANTES de itemModal a propósito: sus filas de gastos abren
         la ficha del ítem, que debe apilarse ENCIMA (el orden del DOM manda). */''}
    ${/* Recibos ya no es una pestaña: se abre entero desde la tarjeta del
         calendario del Dashboard. Va ANTES de los modales para que cualquiera de
         ellos (la ficha de un recibo, el modal del día) se apile encima. */''}
    ${showReceiptsSheet && TAB_ORDER[2]!=='recibos' ? receiptsSheet() : ''}
    ${/* Modo Servicios (app-15): hojas a pantalla completa, antes de los modales
         para que cualquiera de ellos se apile encima. La ficha de activo va
         después de Equipo porque se abre desde ahí. */''}
    ${showEquipoSheet && TAB_ORDER[1]!=='equipo' ? equipoSheet() : ''}
    ${showJobsSheet ? jobsSheet() : ''}
    ${(typeof showQuotesSheet!=='undefined' && showQuotesSheet) ? quotesSheet() : ''}
    ${(typeof showClientsSheet!=='undefined' && showClientsSheet) ? clientsSheet() : ''}
    ${showCollectSheet ? collectSheet() : ''}
    ${showServicesSheet ? servicesSheet() : ''}
    ${showExpenseCatsSheet ? expenseCatsSheet() : ''}
    ${showAgentSheet ? agentSheet() : ''}
    ${showAgentCam ? agentCamModal() : ''}
    ${showAssetSheet ? assetSheet() : ''}
    ${showBudgetModal ? budgetModal() : ''}
    ${showFinishedItemModal ? finishedItemModal() : ''}
    ${/* Desglose de Valor/Potencial ANTES de itemModal a propósito (verificación
         2026-09-11): sus filas abren la ficha del producto, que debe apilarse
         ENCIMA — el orden del DOM manda entre overlays del mismo z-index. Antes
         iba después y "Editar producto" quedaba escondido detrás del desglose. */''}
    ${(typeof showInvDetail!=='undefined' && showInvDetail) ? invDetailModal() : ''}
    ${showItemModal ? itemModal() : ''}
    ${showBarcodeScanModal ? barcodeScanModal() : ''}
    ${showCategoriesModal ? categoriesModal() : ''}
    ${showActivityModal ? activityModal() : ''}
    ${showScanModal ? scanModal() : ''}
    ${showProductBatchModal ? productBatchModal() : ''}
    ${showReceiptDetail ? receiptDetailModal() : ''}
    ${(typeof showReportBuilder!=='undefined' && showReportBuilder) ? reportBuilderModal() : ''}
    ${showDayModal ? dayModal() : ''}
    ${showPriceHistoryModal ? priceHistoryModal() : ''}
    ${showMonthlySpendModal ? monthlySpendModal() : ''}
    ${showAlertSettingsModal ? alertSettingsModal() : ''}
    ${showAccountModal ? accountModal() : ''}
    ${showDeleteAccountModal ? deleteAccountModal() : ''}
    ${showSuggestedOrderModal ? suggestedOrderModal() : ''}
    ${showCycleCountModal ? cycleCountModal() : ''}
    ${showAuthModal ? authModal() : ''}
    ${showTeamModal ? teamModal() : ''}
    ${showFeedbackModal ? feedbackModal() : ''}
    ${showHelpModal ? helpModal() : ''}
    ${showTeamIntroModal ? teamIntroModal() : ''}
    ${showRecipeModal ? recipeModal() : ''}
    ${showProduceModal ? produceModal() : ''}
    ${showShelfModal ? shelfScanModal() : ''}
    ${showOutflowsModal ? outflowsModal() : ''}
    ${showProductionHub ? productionHubModal() : ''}
    ${photoViewItemId ? itemPhotoViewerModal() : ''}
    ${showExitSurvey ? exitSurveyModal() : ''}
    ${showManualSpendModal ? manualSpendModal() : ''}
    ${showJobModal ? jobModal() : ''}
    ${(typeof showQuoteModal!=='undefined' && showQuoteModal) ? quoteModal() : ''}
    ${(typeof showClientModal!=='undefined' && showClientModal) ? clientModal() : ''}
    ${showAssetModal ? assetModal() : ''}
    ${showMaintModal ? maintModal() : ''}
    ${showMaintLogModal ? maintLogModal() : ''}
    ${showServiceModal ? serviceModal() : ''}
    ${/* Las hojas a página completa (.oc-sheet) viven ACÁ y no dentro de las vistas:
         .view-track tiene transform (swipe), y un ancestro con transform convierte
         el position:fixed en relativo a él — la hoja quedaba del tamaño del
         contenido en vez de cubrir la pantalla. Se renderizan siempre (no
         condicionales) para que la transición CSS de subida/bajada pueda correr. */''}
    ${monthRecapModal()}
    ${inventory.length>0 ? orderCalcPanel() : ''}
    ${/* Franja de SIN CONEXIÓN: fija sobre la barra de abajo para que se vea en
         cualquier pestaña. La clase .sin-red en <html> es la que le hace lugar:
         sin ella la franja se comía la última fila de productos y se pisaba con
         los avisos (medido 2026-09-09, 10px de solape sobre el texto). */''}
    ${isOffline ? `<div class="offline-bar" role="status">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><line x1="4" y1="20" x2="20" y2="4"/></svg>
      <span>${t('offline_bar')}</span>
    </div>` : ''}
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
      /* CLAVES ESTABLES (auditoría de parpadeo 2026-09-08, medida con 150
         productos con foto y 120 recibos): morphdom solo reconoce "es el mismo
         nodo" por id. Las tarjetas de producto, las de recibo y los días del
         calendario no tenían id, así que al reordenar la lista
         (un snapshot de la nube, ordenar, buscar, un chip de categoría) las
         destruía y las volvía a crear: 45 fotos re-decodificadas al tipear
         "pro" y 20 latidos de conteo arrancando de cero — eso era el parpadeo
         y las "palpitaciones". Con data-key (prefijado por vista para que no
         choque entre pestañas) morphdom MUEVE el nodo en vez de recrearlo: la
         foto ya decodificada y la animación en curso se conservan. Medido
         después: 0 fotos recreadas en los mismos escenarios. */
      getNodeKey(node){
        if(node.nodeType!==1) return undefined;
        return node.id || node.getAttribute('data-key') || undefined;
      },
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
  schedulePagePrewarm();
}
/* PRE-CALENTADO de las páginas lejanas (auditoría de cambio de pestaña
   2026-09-08, medida con el inventario real: 253 productos, 51 por contar):
   destapar una página .far (content-visibility:hidden) en el momento del toque
   cuesta su primer layout + pintado — ~60 ms en escritorio, un tirón de
   150-300 ms en teléfono justo al arrancar el deslizamiento hacia Recibos.
   Acá se destapan en un momento MUERTO (requestIdleCallback) después
   de cada render y de cada asentado de pestaña, así el toque las encuentra ya
   acomodadas y el resorte arranca limpio. El template sigue poniendo .far al
   dibujar (primer pintado rápido; un render de fondo las vuelve a tapar), y este
   pre-calentado las destapa otra vez apenas hay tiempo libre. Nunca a mitad de
   un gesto o del resorte: ahí se reintenta un poco después. */
let pagePrewarmPending = false;
function schedulePagePrewarm(){
  if(pagePrewarmPending) return;
  if(!document.querySelector('.view-page.far')) return;
  pagePrewarmPending = true;
  const run = ()=>{
    pagePrewarmPending = false;
    if(swipeGestureActive || trackAnimating){ setTimeout(schedulePagePrewarm, 400); return; }
    document.querySelectorAll('.view-page.far').forEach(p=>{ p.classList.remove('far'); });
    const track = document.querySelector('.view-track');
    if(track) void track.offsetHeight; // el layout ocurre AHORA, en tiempo libre, no en el toque
  };
  if(typeof requestIdleCallback === 'function') requestIdleCallback(run, {timeout: 1500});
  else setTimeout(run, 350);
}
// El alto de .view-viewport se fija al de la página activa nada más (ver nota en el
// CSS de .view-viewport) — se llama después de cada render() y también al terminar
// la animación de switchToTab(), porque ahí el DOM no se vuelve a dibujar de cero
// pero la página visible sí puede haber cambiado de alto.
let viewportSyncedContentH = -1, viewportSyncedInnerH = -1; // lo último medido (ver scheduleViewportSync)
let viewportShrinkFrame = null;
/* opts (todo opcional): {tab, contentHeight, vTop}. Sirve para ajustar el alto a
   una pestaña que TODAVÍA no es la activa —el cambio de marco lo hace al
   comprometerse el cambio, ver rebasePagesToTab— y para hacerlo con medidas ya
   tomadas, sin leer geometría en el cuadro del pointerup. */
function syncViewportHeight(diferirEncogido, opts){
  const viewport = document.querySelector('.view-viewport');
  const pages = document.querySelectorAll('.view-page');
  const idx = TAB_ORDER.indexOf((opts && opts.tab) || activeTab);
  if(!viewport || !pages[idx]) return;
  const contentHeight = (opts && opts.contentHeight != null)
    ? opts.contentHeight : pages[idx].getBoundingClientRect().height;
  // Si el contenido de la pestaña activa es corto (ej. Inventario filtrado al conteo
  // cíclico, con un solo producto) y no llega a tapar la pantalla hasta la barra de
  // abajo, se estira igual hasta ahí — si no, queda un hueco vacío mostrando el
  // degradé verde decorativo del header (pensado para asomar solo arriba, detrás del
  // topbar/dashboard) en medio de la pantalla, encima de la barra de navegación.
  const bottomNavEl = document.querySelector('.bottom-nav');
  const navHeight = bottomNavEl ? bottomNavEl.getBoundingClientRect().height : 0;
  // Coordenada de DOCUMENTO (rect.top + scrollY), no de ventana (auditoría de
  // scroll 2026-09-07): rect.top solo es viewport-relativo, así que medido con
  // la página scrolleada 469px daba un relleno 469px más grande — cada render
  // hecho a media página (marcar una ficha, un snapshot) estiraba el documento,
  // y el siguiente render hecho arriba lo encogía y el scroll se recortaba de
  // golpe. El relleno tiene que ser el mismo sin importar dónde esté el scroll.
  const viewportDocTop = (opts && opts.vTop != null)
    ? opts.vTop : viewport.getBoundingClientRect().top + window.scrollY;
  const fillHeight = Math.max(0, window.innerHeight - viewportDocTop - navHeight);
  const totalHeight = Math.max(contentHeight, fillHeight);
  const aplicar = ()=>{
    viewportSyncedContentH = Math.round(contentHeight);
    viewportSyncedInnerH = window.innerHeight;
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
  };
  /* ENCOGER EL DOCUMENTO, UN CUADRO DESPUÉS (reporte del usuario 2026-09-08:
     "parpadea toda esa zona al deslizar de Inventario al Dashboard", y "empezó
     desde que le metí muchos datos").
     Al asentarse un cambio de pestaña el alto del documento se ajusta a la
     página nueva. Aunque el contenido visible no se mueva, cambiar el alto del
     documento de golpe re-rasteriza la página entera, y eso se ve como un
     destello justo en el pie del contenido, donde se juntan las tarjetas de
     color, el borde del fondo y la sombra de la barra.
     Medido: yendo de Inventario al Dashboard el alto cae de golpe 490 px con 10
     productos (imperceptible) pero 36.692 px con 400 — 43 pantallas en un
     cuadro. Por eso "empezó" al cargar datos: el mecanismo estuvo siempre, los
     datos lo hicieron visible.
     Solo se difiere ENCOGER. Crecer se aplica ya mismo: un documento más corto
     de la cuenta recorta el scroll (y con él la posición de la página que se
     está mostrando), mientras que uno 2 cuadros más largo no se nota. */
  const altoActual = parseFloat(viewport.style.height) || 0;
  if(diferirEncogido && altoActual > totalHeight + 1){
    if(viewportShrinkFrame) cancelAnimationFrame(viewportShrinkFrame);
    viewportShrinkFrame = requestAnimationFrame(()=>requestAnimationFrame(()=>{
      viewportShrinkFrame = null;
      // Pudo haber otro cambio de pestaña mientras tanto: ese render ya ajustó
      // el alto a SU página y pisar con esta medida vieja sería el salto que se
      // quiere evitar.
      if(TAB_ORDER.indexOf(activeTab)!==idx) return;
      aplicar();
    }));
    return;
  }
  aplicar();
}
/* El alto fijo de arriba se medía UNA vez por render y nada lo volvía a
   medir (auditoría de scroll 2026-09-07). Todo lo que cambia el alto de la
   página DESPUÉS del render dejaba el documento con un alto viejo: las fuentes
   web entrando (display=swap: métricas distintas → otro alto), una foto de
   recibo que termina de cargar, el teclado o la barra del navegador cambiando
   innerHeight, girar el teléfono. Resultado: contenido recortado abajo
   (overflow:hidden) o un hueco de más al final, y el scroll "rebotaba" contra
   un final que no era. Acá se vuelve a sincronizar en cada uno de esos eventos,
   agrupado en un solo frame y sin tocar nada si la medida no cambió — y nunca
   a mitad de un swipe/resorte (ahí el alto lo maneja el gesto). */
let viewportSyncFrame = null;
function scheduleViewportSync(){
  if(viewportSyncFrame) return;
  viewportSyncFrame = requestAnimationFrame(()=>{
    viewportSyncFrame = null;
    if(swipeGestureActive || trackAnimating) return;
    const viewport = document.querySelector('.view-viewport');
    const pages = document.querySelectorAll('.view-page');
    const idx = TAB_ORDER.indexOf(activeTab);
    if(!viewport || !pages[idx]) return;
    const h = Math.round(pages[idx].getBoundingClientRect().height);
    // Si el contenido creció o se achicó respecto de lo medido en el último
    // sync, o la ventana cambió de alto (el relleno hasta la barra depende de
    // innerHeight). Si nada cambió, no se escribe nada — cero layout extra.
    if(h!==viewportSyncedContentH || window.innerHeight!==viewportSyncedInnerH) syncViewportHeight();
  });
}
try{
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleViewportSync);
  window.addEventListener('resize', scheduleViewportSync);
  window.addEventListener('orientationchange', scheduleViewportSync);
  // Las <img> no burbujean load: se escucha en captura. Solo importan las que
  // están dentro del carrusel (las de un modal no mueven el documento).
  document.addEventListener('load', (e)=>{
    const el = e.target;
    if(el && el.tagName==='IMG' && el.closest && el.closest('.view-page')) scheduleViewportSync();
  }, true);
}catch(e){}

function renderCrashScreen(err){
  const app = document.getElementById('app');
  if(!app) return;
  let lang = 'en'; // inglés es el idioma principal — también en la pantalla de crash
  try{ lang = uiLang || 'en'; }catch(e){}
  const copy = lang==='en'
    ? {title:'Something went wrong', body:'Dusty hit an unexpected error and couldn’t continue. Your saved data is safe on this device — reloading usually fixes it.', btn:'Reload'}
    : {title:'Algo salió mal', body:'Dusty encontró un error inesperado y no pudo continuar. Tus datos guardados en este dispositivo están a salvo — recargar normalmente lo soluciona.', btn:'Recargar'};
  app.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;">
      <div style="background:var(--panel);border-radius:20px;box-shadow:var(--shadow);padding:32px 24px;max-width:360px;text-align:center;">
        <svg viewBox="0 0 24 24" style="width:40px;height:40px;stroke:var(--tomato);fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;margin-bottom:12px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div style="font-weight:800;font-size:calc(18px * var(--fs, 1));color:var(--ink);margin-bottom:8px;">${copy.title}</div>
        <div style="font-size:calc(14px * var(--fs, 1));color:var(--ink-soft);line-height:1.5;margin-bottom:20px;">${copy.body}</div>
        <button id="btn-render-crash-reload" style="background:var(--navy);color:var(--on-accent);border:none;border-radius:14px;padding:12px 24px;font-weight:700;font-size:calc(14px * var(--fs, 1));cursor:pointer;">${copy.btn}</button>
      </div>
    </div>`;
  const btn = document.getElementById('btn-render-crash-reload');
  if(btn) btn.onclick = () => location.reload();
}

/* Franja de SOLO LECTURA (suscripción): arriba del Dashboard cuando la cuenta
   está cerrada y la persona eligió "ver mis datos mientras tanto". Vuelve a la
   página de suscripción con un toque (btn-ro-subscribe, app-09). */
function readOnlyBanner(){
  if(!accessLocked()) return '';
  return `
  <div class="ro-banner" role="status">
    <div><b>${t('pw_ro_title')}</b><span>${t('pw_ro_sub')}</span></div>
    <button type="button" id="btn-ro-subscribe">${t('pw_ro_btn')}</button>
  </div>`;
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
      ${/* El "?" de Ayuda se mudó ADENTRO de Ajustes (Dashboard reorganizado
           2026-09-07: dos botones arriba, no tres). Mismo id btn-feedback allá. */''}
      ${currentUser && !currentUser.isAnonymous ? `
      ${/* Nube rediseñada (pedido del usuario 2026-09-04): la silueta clásica
           cerrada (Feather "cloud") en vez del trazo abierto de antes, con el
           check adentro — se lee como nube de un vistazo a 17px. */''}
      ${/* Tres estados, no dos (auditoría 2026-09-09): al día, subiendo, y
           "no se pudo guardar". Sin conexión gana sobre "subiendo": decir
           "sincronizando" sin red es mentirle al usuario. */''}
      ${(()=>{
        const st = isOffline ? 'offline' : cloudSyncIsFailing() ? 'failed' : cloudSyncDirty ? 'pending' : 'synced';
        const titulo = st==='offline' ? t('cloud_sync_offline')
          : st==='failed' ? t('cloud_sync_failed')
          : st==='pending' ? t('cloud_sync_pending')
          : t('cloud_sync_signed_in').replace('{email}', escapeHtml(currentUserLabel()));
        return `
      <button class="lang-toggle ${st}" id="btn-cloud-sync" title="${titulo}" aria-label="${titulo}">
        <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>${st==='failed' ? '<line x1="12" y1="10.5" x2="12" y2="14"/><line x1="12" y1="16.4" x2="12" y2="16.5"/>' : st==='offline' ? '<line x1="4" y1="20" x2="20" y2="4"/>' : '<polyline points="9.5 14 11.5 16 15 12.5"/>'}</svg>
      </button>`;
      })()}
      ` : `
      ${/* Auditoría de primer minuto 2026-09-07: "Guardar mi cuenta" aparecía en el
           PRIMER toque (al crearse la cuenta anónima), sin que hubiera nada que
           guardar, y su largo partía el encabezado en dos filas. Ahora el trial
           sigue viendo "Entrar" hasta tener algo cargado; recién ahí la píldora
           cambia a "Guardar mi cuenta" (o "Guardar" en pantallas angostas, ver
           .cta-short) y entra con un pequeño rebote (.cta-save). */''}
      ${(()=>{
        const hasData = inventory.length>0 || receipts.length>0;
        const saveMode = !!(currentUser && hasData);
        return `
      <button class="cloud-signin-btn${saveMode ? ' cta-save' : ''}" id="btn-cloud-sign-in" title="${currentUser ? t('trial_upgrade_title') : t('cloud_sync_signed_out')}">
        <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0;"><path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.6-1.5A4 4 0 0 0 6.5 16"/></svg>
        <span class="cta-long">${saveMode ? t('trial_save_account_cta') : t('btn_account_cta')}</span>
        <span class="cta-short">${saveMode ? t('trial_save_short') : t('btn_account_cta')}</span>
      </button>`;
      })()}
      `}
      ${agentTopbarButtonHtml()}
      <button class="lang-toggle" id="btn-alert-settings" title="${t('btn_alert_settings')}">
        <svg viewBox="0 0 24 24" style="width:17px;height:17px;stroke:currentColor;fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>
      </button>
      ${/* El cambio de idioma salió del topbar DE RAÍZ (pedido del usuario
           2026-09-04): vive de último en el modal de Ajustes — se cambia una
           vez y listo, no merecía un lugar permanente en la barra. */''}
    </div>
  </div>`;
}

function bottomNav(){
  const items = [
    {tab:'dashboard', label:t('tab_dashboard'), icon:`<polyline points="3 11 12 4 21 11"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/>`},
    TAB_ORDER[1]==='equipo'
      ? {tab:'equipo', label:t('tab_equipo'), icon:`<path d="M1 4h12v11H1z"/><path d="M13 8h5l3 4v3h-8"/><circle cx="5" cy="17.5" r="2"/><circle cx="18" cy="17.5" r="2"/>`}
      : {tab:'inventario', label:t('tab_inventory'), icon:`<polygon points="12 3 21 7.5 21 16.5 12 21 3 16.5 3 7.5"/><polyline points="3 7.5 12 12 21 7.5"/><line x1="12" y1="12" x2="12" y2="21"/>`},
    TAB_ORDER[2]==='produccion'
      ? {tab:'produccion', label:t('tab_production'), icon:`<path d="M4 20h16"/><path d="M6 20v-6a6 6 0 0 1 12 0v6"/><path d="M12 8V4"/><path d="M9 4h6"/>`}
      : {tab:'recibos', label:t('tab_receipts'), icon:`<path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2z"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/>`},
  ];
  // Presupuesto en amarillo/rojo (pedido del usuario 2026-09-07: "ponerla a
  // palpitar como aviso"): un punto que late sobre el ícono del Dashboard para
  // que el aviso se vea desde cualquier pestaña, sin notificaciones externas.
  let budgetDot = '';
  try{ const p = budgetPace(localMonthStr()); if(p && p.status!=='ok') budgetDot = p.status; }catch(e){}
  return `
  <div class="bottom-nav">
    ${items.map(i=>`
      <button class="bottom-nav-item ${activeTab===i.tab?'active':''}" data-tab="${i.tab}">
        <svg viewBox="0 0 24 24">${i.icon}</svg>
        ${i.tab==='dashboard' && budgetDot ? `<i class="nav-alert-dot ${budgetDot}" aria-hidden="true"></i>` : ''}
        <span>${i.label}</span>
      </button>
    `).join('')}
  </div>`;
}

