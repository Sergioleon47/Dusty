/* ================= ESTADO INICIAL ================= */
// Antes estos dos arrays traían 7 productos y 6 compras de ejemplo (pollo, camarones,
// mozzarella, etc.) — útil para probar la app durante el desarrollo, pero loadState()
// solo los pisa si YA hay algo guardado en localStorage (ver más abajo), así que
// cualquier cliente nuevo de verdad los veía como si fueran su propio inventario, sin
// ninguna marca de "esto es un ejemplo". Un dueño de restaurante que abre la app por
// primera vez y ya tiene "5 alertas críticas" y productos que nunca cargó pierde la
// confianza en la app antes de usarla. Ahora arranca vacío de verdad — y el
// Dashboard se ve igual con o sin datos (todas las baldosas en cero, ver
// dashboardView en app-05).
/* DÓNDE VIVEN LAS FUNCIONES DE LA NUBE (escanear recibo, identificar producto,
   borrar la cuenta). En la web la app y las funciones comparten origen, así que
   una ruta relativa alcanza. Dentro de la app de Play Store NO: Capacitor sirve
   los archivos desde https://localhost, y ahí "/.netlify/functions/..." apunta
   al propio teléfono, donde no hay ninguna función. El fetch fallaba y el
   usuario veía "sin conexión" teniendo señal perfecta — o sea, escanear recibos
   e identificar productos no funcionaban en la app publicada (auditoría
   2026-09-09). Con esto, dentro del envoltorio nativo se pide al servidor real.
   El servidor, por su lado, tuvo que aprender a aceptar ese origen: ver
   ALLOWED_ORIGIN_PATTERNS en netlify/functions/lib/patron-admin.js. */
const API_ORIGEN_WEB = 'https://patronsc.netlify.app';
const API_BASE = (function(){
  try{
    const cap = window.Capacitor;
    const nativo = !!(cap && (typeof cap.isNativePlatform === 'function' ? cap.isNativePlatform() : cap.isNative))
      || location.protocol === 'capacitor:';
    return nativo ? API_ORIGEN_WEB : '';
  }catch(e){ return ''; }
})();
// Une la base con la ruta de la función. En la web devuelve la ruta tal cual.
function urlFuncion(path){ return API_BASE + path; }

let inventory = [];
let purchases = [];

let receipts = []; // historial: {id, images:[{base64,mediaType}, ...] (una o varias páginas), supplier, date, total, itemCount, appliedItems, createdAt, purchaseIds}
/* "Lápidas" de productos borrados: sin esto, un producto borrado en este dispositivo
   podía "revivir" solo al reconectar la nube — si el borrado no había alcanzado a
   subirse (por ejemplo, se borró y se cerró la app antes de los 400ms de la sincronización,
   o se borró justo antes de que llegara el primer snapshot en tiempo real), la nube
   todavía tenía el producto viejo, y el próximo snapshot lo traía de vuelta como si nunca
   se hubiera borrado. Ahora, cada vez que se conecta la nube (ver reconcileLocalOnlyData),
   se borra explícitamente de la nube cualquier id que esté acá, ANTES de que los listeners
   en tiempo real puedan traerlo de vuelta — y un snapshot que igual llegue con uno de estos
   ids se lo filtra en applyRemoteInventorySnapshot como último resguardo. */
let deletedInventoryIds = [];
// Mismas "lápidas" que deletedInventoryIds, pero para recibos y compras — sin esto, un
// recibo (o su compra) borrado en un dispositivo mientras otro estaba offline REAPARECÍA:
// el otro dispositivo lo veía como "dato local que la nube todavía no tiene" y lo re-subía
// (ver reconcileLocalOnlyData/missingRec), con las fotos apuntando a archivos de Storage ya
// borrados. Se propaga por el mismo canal (dentro de meta) y se filtra en los snapshots.
let deletedReceiptIds = [];
let deletedPurchaseIds = [];
// Nota: recibos guardados antes de la migración a Claude API pueden tener el formato viejo
// de una sola foto (imageBase64 + mediaType) en vez de "images" — por eso receiptImages()
// abajo soporta ambos formatos en vez de asumir que todos los recibos ya son el nuevo.
let aliasMap = {}; // nombre normalizado del recibo -> ingredienteId, aprendido de correcciones previas
let receiptSearchQuery = '';
try{ receiptSearchQuery = localStorage.getItem('patron_receipt_search') || ''; }catch(e){}
// "YYYY-MM" del mes que muestra el calendario de recibos — recuerda el último mes que
// se estaba mirando (incluso después de un refresh); si nunca se usó, se completa solo
// con el mes actual la primera vez que se dibuja el calendario (ver receiptCalendarWidget).
let calendarViewMonth = null;
try{ calendarViewMonth = localStorage.getItem('patron_cal_month') || null; }catch(e){}
/* "YYYY-MM-DD" del día tocado en el calendario, o null. Antes solo se abría para
   días con MÁS de un recibo (para elegir cuál); ahora que los días también tienen
   notas, tocar CUALQUIER día abre este modal unificado — recibos del día + notas +
   caja para escribir una nota nueva. Un día con un solo recibo pasa de 1 toque a 2
   para llegar al detalle, a cambio de un modelo mental único: "tocá el día". */
let showDayModal = null;
/* Notas del calendario (Fase 1 de la integración con Nudgy — ver nudgy-core.js):
   {id, text, date:'YYYY-MM-DD'|null, hour, minute, recurring, icon, createdAt, by}.
   date null = nota puramente recurrente ("pagar la renta cada mes") — qué días
   pinta lo decide recurringMatchesDay() a partir de recurring + createdAt.
   Viajan dentro del doc meta/settings (como categories), así el equipo entero ve
   el mismo calendario. deletedCalNoteIds son sus "lápidas", mismo mecanismo que
   deletedInventoryIds: sin ellas, una nota borrada acá reviviría cuando otro
   dispositivo que no se enteró vuelva a subir su copia de meta. */
let calNotes = [];
let deletedCalNoteIds = [];
// Borrador de la nota que se está escribiendo en el modal de día — vive fuera del
// input para sobrevivir a un render() disparado por la nube a mitad de tipeo.
let dayNoteDraft = '';
let calendarShowYearPicker = false; // true cuando se tocó el mes/año arriba del calendario, para elegir otro mes del mismo año de un tirón
/* SIN CONEXIÓN, VISIBLE (auditoría 2026-09-09): la app funciona entera offline
   —el service worker sirve el shell y el estado vive en este teléfono— pero no
   lo decía en ningún lado: el usuario veía todo normal hasta que tocaba
   Escanear y recibía un error seco. navigator.onLine no aparecía ni una vez en
   el código. Lo mantienen los listeners de app-07. */
let isOffline = false;
try{ isOffline = (typeof navigator!=='undefined' && navigator.onLine===false); }catch(e){}
let calendarAmountQuery = ''; // texto del buscador por monto, al lado de "Escanear recibo"
let calendarBlinkDates = []; // fechas "YYYY-MM-DD" que coinciden con calendarAmountQuery — esos días parpadean en el calendario

// Antes esto siempre arrancaba en 'dashboard', así que refrescar la página (o cerrar y
// volver a abrir la app) te sacaba de la pestaña en la que estabas — ahora se recuerda
// la última pestaña usada en este dispositivo.
let activeTab = 'dashboard';
/* RECIBOS SALIÓ DE LA BARRA (pedido del usuario 2026-09-10). El calendario pasó
   a vivir en el Dashboard —en la tarjeta grande, dibujado en chiquito— y se abre
   entero desde ahí; el lugar que dejó en la barra lo toma Producción, que es un
   catálogo y no cabía en un modal. Recibos NO se perdió: showReceiptsSheet lo
   abre a pantalla completa con la misma vista de siempre. */
/* LA BARRA SE ADAPTA AL NEGOCIO (pregunta del usuario 2026-09-10: "¿y si alguien
   no usa la zona de producción?"). Un negocio que solo revende no fabrica nada, y
   tendría un tercio de la barra ocupado por una pantalla que nunca abre — y encima
   habría perdido Recibos de ahí. Así que la tercera pestaña es:
     - RECIBOS mientras no exista ninguna receta (o sea: todo sigue como antes);
     - PRODUCCIÓN en cuanto el negocio arma su primera receta.
   El calendario del Dashboard se queda en los dos casos: es mejor que la línea de
   texto que había, y tocarlo lleva a los recibos por el camino que corresponda —
   a la pestaña si existe, a la hoja completa si no (ver openReceiptsSheet).
   productionTabPref permite forzarlo desde Ajustes: 'auto' (según haya recetas),
   'on' o 'off'. Es preferencia del DISPOSITIVO, como los latidos o las columnas
   del inventario: no viaja a la nube ni se le impone al resto del equipo. */
let productionTabPref = 'auto';
try{
  const v = localStorage.getItem('patron_production_tab');
  if(v==='on' || v==='off') productionTabPref = v;
}catch(e){}
function usesProduction(){
  if(productionTabPref==='on') return true;
  if(productionTabPref==='off') return false;
  return Array.isArray(recipes) && recipes.length > 0;
}
/* TAB_ORDER es `let` y no `const` porque la tercera pestaña cambia según lo de
   arriba. Todo el sistema de deslizar la lee EN CADA USO (ancho, gesto, memoria de
   scroll), así que reasignarla y redibujar alcanza — ver refreshTabOrder(). */
let TAB_ORDER = ['dashboard','inventario','recibos'];
// La pestaña recordada puede ser una que ya no existe (el Catálogo se eliminó, y
// ahora Recibos): sin este filtro, el dispositivo que quedó ahí arrancaba en una
// pestaña muerta — pantalla en blanco hasta tocar otra.
try{
  const saved = localStorage.getItem('patron_active_tab');
  /* Se valida contra las CUATRO conocidas y no contra TAB_ORDER: acá todavía no
     se sabe si la tercera va a ser Recibos o Producción (recipes se carga después),
     y comparar con el arreglo provisional dejaba afuera a quien se había quedado
     en Producción. refreshTabOrder() la corrige en el primer render si no existe. */
  if(['dashboard','inventario','equipo','recibos','produccion'].indexOf(saved) >= 0) activeTab = saved;
}catch(e){}
/* Recibos a pantalla completa, abierto desde la tarjeta del calendario. Se abre
   con una View Transition que agranda el calendario chiquito hasta el grande
   (ver openReceiptsSheet en app-07): el mismo mecanismo que ya usa el cambio de
   vista del Inventario, no una animación nueva. */
let showReceiptsSheet = false;
/* Recalcula la tercera pestaña. Corre al principio de cada render (app-04): si el
   usuario acaba de crear su primera receta, Producción aparece sin que haga falta
   recargar. Si la pestaña en la que estaba parado desaparece, vuelve al Dashboard
   en vez de quedar en un índice -1 con la pantalla en blanco. */
function refreshTabOrder(){
  /* Modo Servicios (2026-09-11): un negocio que presta servicios y NO vende
     productos no tiene inventario que mirar — la segunda pestaña pasa a ser
     "Equipo" (equipoView, app-15). Con productos y servicios, Inventario se
     queda y Equipo se abre desde el Dashboard. */
  const segunda = (typeof sellsProducts==='function' && !sellsProducts()) ? 'equipo' : 'inventario';
  const tercera = usesProduction() ? 'produccion' : 'recibos';
  if(TAB_ORDER[1] === segunda && TAB_ORDER[2] === tercera) return false;
  TAB_ORDER = ['dashboard',segunda,tercera];
  if(TAB_ORDER.indexOf(activeTab) < 0) activeTab = 'dashboard';
  return true;
}
// La introducción (idioma, bienvenida, tema) ya no es un modal de render(): vive
// en su propio nodo fuera de #app — ver startOnboarding en app-06.
let showItemModal=false, showScanModal=false, showReceiptDetail=null;
/* Auditoría de primer minuto 2026-09-07 (ver helpModal, teamIntroModal, itemModal
   y celebrateFirstScan en app-06):
   - showHelpModal: la hoja de ayuda detrás del "?" del encabezado.
   - showTeamIntroModal + teamIntroContinue: la tarjeta "Mejor en equipo" salió del
     tutorial y se muestra UNA vez, al primer toque de Compartir; al cerrarla sigue
     con lo que el toque iba a hacer (continuación guardada acá).
   - itemModalExpanded: la ficha de producto nuevo arranca como ALTA RÁPIDA (nombre,
     costo, cantidad) y "Más detalles" la despliega entera. Editar abre completa.
   - lastScanQuota: {limit, used} que devuelve el servidor con cada escaneo — para
     decirle al trial cuántos escaneos gratis le quedan, antes de que choque el tope. */
let showHelpModal=false, showTeamIntroModal=false, teamIntroContinue=null, itemModalExpanded=false, lastScanQuota=null;
/* SUSCRIPCIÓN (2026-09-11): "primer mes por nuestra cuenta", después se paga.
   - accessState: lo que contestó el servidor (access-state) — {billingEnabled,
     locked, trialEndsAt, subscription, unlimited}. null hasta que responde; y
     si nunca responde (sin red) la app queda ABIERTA: cerrar por un fallo
     nuestro es peor que un día gratis de más. El candado real vive en el
     servidor (402 en las funciones de IA) y en firestore.rules (escrituras).
   - paywallDismissed: tocó "ver mis datos (solo lectura)": la página se esconde,
     el candado sigue (accessLocked) y el Dashboard muestra la franja.
   - SUB_PRICES: lo que se MUESTRA en la página de suscripción. Precios de
     ejemplo hasta que existan los reales en Stripe (pedido del usuario
     2026-09-11: "esos no son los precios reales pero luego los cambiamos") —
     el cobro real lo decide el price_ de Stripe, nunca este texto. */
let accessState = null, paywallDismissed = false;
const SUB_PRICES = { month: '$4.99', year: '$39.99' };
/* Auditoría de cámaras 2026-09-07 (ver el informe "Las seis cámaras"):
   - scanPhotoView: página del recibo abierta a pantalla completa durante la revisión.
   - scanTruncated: el modelo avisó que el recibo parece cortado.
   - pbPendingImg / shelfPendingImg: foto retenida por el aviso de calidad ("¿usar igual?").
   - shelfLastSource: la foto del estante, para dar de alta los no reconocidos sin otra foto.
   - shelfPhotoView: recorte de una fila del estante abierto grande.
   - productScanSuggest: lo que la IA detectó en la ficha para campos que ya tenían texto.
   - barcodeLastCode: último código leído (se conserva aunque no se encuentre el producto).
   - aiWaitStartedAt/aiWaitTimer: "sigue leyendo…" pasados 8 s en cualquier escáner. */
let scanPhotoView=null, scanTruncated=false, pbPendingImg=null, shelfPendingImg=null, shelfLastSource=null, shelfPhotoView=null, productScanSuggest=null, barcodeLastCode='', aiWaitStartedAt=0, aiWaitTimer=null;
let pbQualityWarn=null, shelfQualityWarn=null;
let showAuthModal=false, authMode='signin', authError='', authContextNote='', authLoading=false, authEmail='', authPassword='';
// authMode también puede ser 'join' (alguien sin cuenta todavía que recibió un código
// de invitación — crea una cuenta liviana con nombre+PIN, sin email) o 'pinlogin'
// (esa misma persona volviendo a entrar después, en cualquier dispositivo).
let authName='', authPin='', authPinConfirm='', authJoinCode='';
let showFeedbackModal=false, feedbackMessage='', feedbackSubmitting=false, feedbackSent=false;
// Borrado de cuenta: 2 pasos en el mismo modal ('confirm' -> 'reauth'), en vez de
// dos overlays separados — Firebase exige sesión "reciente" antes de dejar borrar
// una cuenta (currentUser.delete() falla con auth/requires-recent-login si no),
// así que reautenticar es un paso obligatorio, no opcional, y conviene que se
// sienta parte del mismo flujo en vez de un modal aparte que aparece de sorpresa.
let showDeleteAccountModal=false, deleteAccountStep='confirm', deleteAccountPassword='', deleteAccountError='', deleteAccountLoading=false;
let showPriceHistoryModal=false, priceHistoryIngId=null;
let showMonthlySpendModal=false;
let editingItem=null;
let draftItem=null;
// Estado del botón "Escanear producto" dentro del modal de nuevo/editar producto —
// separado de scanState (que es del escaneo de RECIBOS, un flujo bastante más
// elaborado con páginas/lote/duplicados) porque acá solo hace falta un in/out simple:
// una foto entra, el formulario se completa solo o se avisa que no se pudo.
let productScanState='idle', productScanError='';
// Token de petición del escaneo de producto individual — mismo truco que
// scanRequestId en recibos: si el usuario dispara un segundo escaneo antes de que
// vuelva el primero, la respuesta vieja se descarta en vez de pisar el formulario.
let productScanRequestId=0;
/* Escaneo de productos EN LOTE ("armá tu inventario con una foto"): una sola foto
   con varios productos a la vista → la IA identifica cada uno → lista de
   confirmación con checkbox por ítem → se agregan todos juntos al inventario.
   Es el camino para armar inventario SIN recibos, sin cargar uno a uno.
   Es TAMBIÉN el identificador "¿qué producto es este?": si la foto trae UN solo
   producto y ya está en el inventario, en vez de la lista muestra la ficha de ese
   producto (pbState 'matched', pbMatchedId) — un único escáner para todo, pedido
   del usuario para no llenar el encabezado de botones. NO es reconocimiento
   continuo a propósito: cada análisis es una llamada paga a la IA (1 escaneo del
   cupo por foto), analizar cada cuadro de video quemaría el cupo en segundos.
   pbState: 'camera' | 'loading' | 'review' | 'matched' | 'empty' | 'error'
   pbItems: [{name, unit, cost, sku, categoryId, confidence, photo, selected, dupOfId}] */
let showProductBatchModal=false, pbState='camera', pbItems=[], pbError='', pbRequestId=0, pbMatchedId=null;
// Modal de código de barras: separado del modal de producto para poder tener la
// cámara ocupando toda la ventana mientras escanea, sin competir con el resto del
// formulario detrás.
let showBarcodeScanModal=false, barcodeScanState='scanning', barcodeScanError='';
let barcodeScannerInstance=null;
/* Historial de actividad: quién cambió qué en el inventario y cuándo. Es de solo
   lectura desde Firestore (nunca se sube como "estado local" completo como
   inventory/purchases, cada entrada se agrega una sola vez con logActivity() y
   nunca se edita) — por eso no pasa por saveState()/localStorage ni por el
   resguardo de applyingRemoteSnapshot, no hay forma de que compita con una edición
   local. lastSeenActivityAt sí es local (por dispositivo, no por cuenta): hasta
   dónde llegó a mirar esta persona en este teléfono — decide el numerito de "no
   leídos" en el botón. */
let activityLog = [];
let unsubActivity = null;
let lastSeenActivityAt = null;
try{ lastSeenActivityAt = localStorage.getItem('patron_activity_seen'); }catch(e){}
let showActivityModal = false;
let scanDuplicateOf=null; // receipt existente si se detecta posible duplicado
let scanDuplicateConfirmed=false;
/* Fase 2 Nudgy: si el recibo escaneado es de un SERVICIO (luz, internet, renta —
   la IA lo marca con un único item de unidad "servicio"), la pantalla de
   confirmación ofrece crear un recordatorio de pago mensual en el calendario,
   pre-marcado. Se resetea por recibo en applyParsedReceiptToScanState. */
let scanPayReminder = true;

