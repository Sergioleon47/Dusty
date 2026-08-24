/* ================= ESTADO INICIAL ================= */
// Antes estos dos arrays traían 7 productos y 6 compras de ejemplo (pollo, camarones,
// mozzarella, etc.) — útil para probar la app durante el desarrollo, pero loadState()
// solo los pisa si YA hay algo guardado en localStorage (ver más abajo), así que
// cualquier cliente nuevo de verdad los veía como si fueran su propio inventario, sin
// ninguna marca de "esto es un ejemplo". Un dueño de restaurante que abre la app por
// primera vez y ya tiene "5 alertas críticas" y productos que nunca cargó pierde la
// confianza en la app antes de usarla. Ahora arranca vacío de verdad — ver
// dashboardEmptyState() para la pantalla de "primeros pasos" que lo reemplaza.
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
let showDayReceipts = null; // "YYYY-MM-DD" del día tocado en el calendario cuando tiene más de un recibo, o null
let calendarShowYearPicker = false; // true cuando se tocó el mes/año arriba del calendario, para elegir otro mes del mismo año de un tirón
let calendarAmountQuery = ''; // texto del buscador por monto, al lado de "Escanear recibo"
let calendarBlinkDates = []; // fechas "YYYY-MM-DD" que coinciden con calendarAmountQuery — esos días parpadean en el calendario

// Antes esto siempre arrancaba en 'dashboard', así que refrescar la página (o cerrar y
// volver a abrir la app) te sacaba de la pestaña en la que estabas — ahora se recuerda
// la última pestaña usada en este dispositivo.
let activeTab = 'dashboard';
try{ activeTab = localStorage.getItem('patron_active_tab') || 'dashboard'; }catch(e){}
const TAB_ORDER = ['dashboard','inventario','recibos'];
let showItemModal=false, showScanModal=false, showReceiptDetail=null, showWelcomeModal=false, showLangChoiceModal=false;
// Qué paso del tutorial de bienvenida se está mostrando (ver welcomeModal()).
let welcomeStep = 0;
// Dirección del último cambio de paso (1 = avanzando, -1 = retrocediendo) — decide si
// el paso entra deslizando desde la derecha o desde la izquierda (ver welcomeModal()),
// para que saltar directo a un punto con los puntitos también se sienta direccional
// y no solo un fade genérico.
let welcomeStepDir = 1;
// Punto X donde empezó el toque actual sobre la tarjeta del paso, o null si no hay
// ningún gesto en curso — permite deslizar el dedo para avanzar/retroceder el
// tutorial además de los botones (ver attachEvents). Usa pointer events (no touch)
// para que también funcione arrastrando con el mouse en desktop.
let welcomeSwipeStartX = null;
// Si el paso actual ya se terminó de animar una vez. render() reconstruye TODA la
// pantalla de cero ante cualquier cosa (ej. la reconexión a la nube que arranca sola
// en segundo plano si ya iniciaste sesión antes) — sin esto, cada uno de esos
// redibujados de fondo, aunque no cambien nada visible del tutorial, vuelve a
// disparar sus animaciones de entrada (fade del fondo + pop del modal + del paso),
// lo que se ve como que la pantalla "parpadea" sola. Se resetea a false solo cuando
// el paso realmente cambia (avanzar/retroceder), que es cuando sí vale animar de nuevo.
let welcomeStepAnimated = false;
// Mismo motivo que welcomeStepAnimated: dashboardEmptyState() (la tarjeta de "vamos a
// armar tu inventario") tiene una animación de entrada pensada para jugar UNA sola vez
// (ver el comentario junto a .dash-empty-card en el CSS) — sin esto, cada redibujado de
// fondo, o cada vez que se vuelve a la pestaña Dashboard por swipe, la hace "aparecer
// de golpe" de nuevo, que es el parpadeo que se nota al deslizar entre pestañas.
let dashEmptyCardAnimated = false;
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

