/* Service Worker de Dusty — cachea el app shell para que la app abra sin
   conexión. Estrategia: network-first con fallback a caché. Se prioriza
   traer siempre la versión más nueva cuando hay red (el repo cambia seguido)
   y sólo se usa lo cacheado cuando falla el fetch (sin red) o para las
   navegaciones dentro de la SPA. */

// v2: index.html se dividió en dusty.css + app-01..07-*.js — el bump fuerza a los
// clientes con el shell viejo cacheado a precachear el juego de archivos nuevo.
// v3: cambios cruzados entre app-02/03/05/06/07 + dusty.css (validación de guardado,
// login instantáneo, base64 de recibos) — el bump evita que quede cacheada una
// mezcla de versiones viejas y nuevas de archivos que se llaman entre sí.
// v4: trial sin cuenta (sesión anónima + modal "guardá tu cuenta") — cambios
// cruzados entre app-02/03/04/06/07, mismo motivo de siempre para el bump.
// v5: escaneo de productos en lote (inventario desde una foto) — de nuevo
// cambios cruzados entre app-01/03/04/05/06/07.
// v6: identificador por cámara ("¿qué producto es?").
// v7: el trial anónimo ya no secuestra dispositivos que tuvieron cuenta real.
// v8: un solo escáner de productos (lote + identificador unificados).
// v9: órbita de iconos alrededor del botón de escanear del dashboard.
// v11: tema oscuro completo (dusty.css + estilos inline en app-03/04/05/06 +
// manifest/theme-color) — el bump evita quedar con el CSS oscuro y vistas viejas
// claras (o al revés) mezcladas desde caché.
// v12: notas de calendario con parser de lenguaje natural (nudgy-core.js NUEVO en
// el precache + cambios cruzados en app-01..07) — sin el bump, un cliente con el
// shell viejo cacheado cargaría las vistas nuevas sin el parser y rompería.
// v13: recordatorio de pago mensual al escanear recibos de servicio (Fase 2 Nudgy)
// — cambios cruzados en app-01/03/06/07 + dusty.css.
// v14: defaults inteligentes en formularios (unidad más usada, placeholder de
// presupuesto con el gasto real) — app-03/05/06/07.
// v15: producción y salidas (recetas + escáner de estante) — archivo NUEVO
// app-08-produccion.js + cambios cruzados en app-02..07, index.html y dusty.css;
// además el header de marca pasó a vivir dentro del Dashboard (app-04).
// v16: día grande de UI/UX (2026-09-03) — calculadora de pedido (hoja completa,
// enviar/copiar, persistencia), barra de stock con "lleno" (stockFullRef),
// tarjetas-botón en 2/3 columnas con selector de vista y buscador, visor de foto,
// Eat out (gastos sin stock), categorías creadas por IA e inline, sin zoom,
// transiciones nativas, arreglo del swipe sobre la calculadora.
// v17: Presupuesto como casa de los gastos (2026-09-05) — bills con pago del mes
// (checkbox y botón ＋ por fila), escanear boleta desde Budget, categorías de
// gasto propias y barra debajo de su monto; cambios cruzados en app-03/05/06/07
// + dusty.css. Sin el bump, un cliente con mezcla de caché vieja y nueva puede
// tener la barra sin reaccionar a los pagos manuales o escaneados.
// v18: el escáner de recibos reconoce/propone categorías fuera de la lista del
// usuario (sentinel __newcat__ como el lote de productos) y las boletas de
// servicio categorizan contra las categorías de GASTO — app-06/07 + función.
// v19: precio de venta editable al registrar la venta (escáner de salidas por
// línea y producción por pieza) para que el Cierre de mes calcule ingresos
// reales, + aclaración del "Gastado" en Budget sin bills — app-03/05/08.
// v20: Catálogo público para clientes (modal en Dashboard, inCatalog en
// ítems/recetas, catalogWhatsApp/catalogId en meta) — app-02/03/04/05/07.
// catalogo.html NO se precachea a propósito: es la página de los CLIENTES del
// negocio, no parte del shell de la app.
// v21: el Catálogo pasa de modal a 4.ª PESTAÑA del carrusel (TAB_ORDER, track al
// 400%, nav de abajo con ícono de vitrina) — app-01/03/04/05/07 + dusty.css:
// mezclar CSS viejo (300%) con las 4 páginas nuevas rompería el swipe entero.
// v22: la pestaña Catálogo agrupa los productos por categoría como el
// Inventario (groupRowsByCategory) — app-03/05.
// v23: el Catálogo usa las MISMAS tarjetas y grilla fila/2col/3col del
// Inventario (selector compartido); tocar la tarjeta marca/desmarca — app-05/07.
// v24: Catálogo sin el bloque de arriba (abre directo con los productos; lo
// operativo al final) + FAB de cámara con modo fotos para cambiar la foto de
// productos/recetas al toque — app-03/05/07.
// v25: la cámara del Catálogo (modo fotos) pasa al MISMO punto de pantalla que
// el escáner de estante del Inventario — FAB de 76px con badge ✎ — app-05.
// v26: las tarjetas de la pestaña Catálogo son SOLO la foto semi-cuadrada (sin
// nombre ni precio, como la página pública) — app-03/05.
// v27: el modo fotos del Catálogo dispara LA CÁMARA directo (capture) al tocar
// un producto, en vez del selector de archivos — app-03/07.
// v28: cámara-primero en el Catálogo — el FAB dispara la cámara AL TOQUE, y con
// la foto sacada un modal pregunta de qué producto es (adiós modo fotos) —
// app-03/04/05/07.
// v29: fotos del Catálogo con subida desde galería (botón junto a la cámara) y
// 4 filtros (Vívido/Cálido/Retro/B&N, a puro píxel) en el modal de asignar —
// app-03/05/07.
// v30: las fotos del Catálogo van TODAS a pleno brillo (adiós al atenuado de
// las no seleccionadas — la pantalla se veía apagada); la selección la marca
// solo el ✓ verde con su borde — app-05.
// v31: cámara inteligente del Catálogo — la IA del identificador reconoce el
// producto de la foto y lo sugiere resaltado arriba de la lista de asignar
// (solo cuentas reales; gasta 1 escaneo del cupo) — app-03/05/07.
// v32: editor de fotos del Catálogo — recorte/encuadre con zoom y giro,
// Auto-mejora (auto-niveles por canal) y deslizadores de brillo/contraste/
// saturación/nitidez, todo a canvas sin servicios pagos — app-03/04/05/07.
// v33: editor fluido — brillo/contraste/saturación por CSS filter en GPU al
// ritmo del dedo (se hornean recién en "Listo", misma matemática), zoom y
// arrastre con transform en vivo — app-05/07.
// v34: QUITAR FONDO (cámara Pro) — segmentación vía Replicate (función
// remove-background, cobra 1 escaneo del cupo), composición local sobre el
// color de fondo elegido — app-03/05/07 + función nueva.
// v35: la función de quitar fondo se renombra a remove-bg — Netlify trataba a
// "remove-background" como función de segundo plano (202 vacío) — app-07.
// v36: SÚPER CALIDAD — al asignar una foto se sube en segundo plano la versión
// de 1200px con edición y filtro (upload-catalog-photo → photoHiUrl) y el
// catálogo público la prefiere sobre el thumbnail de 300px — app-05/07 + funciones.
// v37: inyección de calidad a la cámara — reescalado por pasos con suavizado
// 'high' (mata el aliasing en TODAS las fotos), base del catálogo a 1600px/alta
// a 1440px, y "Mejorar IA" (súper-resolución Real-ESRGAN, 2.º botón Pro) —
// app-03/05/06/07 + función enhance-photo.
// v38: ver la imagen COMPLETA — la ficha del catálogo muestra la foto entera
// (contain) y tocarla abre pantalla completa; la alta conserva la forma
// original cuando no se encuadró a propósito — app-05 + catalogo.html.
// v39: pestaña Catálogo estilo iOS Fotos — tocar ABRE la foto completa (visor
// con la alta si existe); "Seleccionar"/"Listo" es el modo aparte para marcar
// qué va al catálogo — app-03/04/05/07.
// v40: editor con controles de LUZ de verdad (Sombras/Luces/Temperatura, pesos
// por luminancia) y panel profesional con pestañas Luz/Color/Encuadre/PRO y
// valores en vivo — app-03/05/07.
// v41: escenarios de foto — 6 fondos incorporados (/backdrops, no precacheados:
// solo se usan en el editor) con SOMBRA automática bajo el producto, y
// "Escenario IA" (FLUX Kontext vía stage-photo, 1 escaneo del cupo) con presets
// y descripción libre — app-03/05/07 + función nueva + texturas.
// v42: editor a tamaño de dedo y más dinámico — tipografías 14px, pestaña
// activa con relieve, valores que se encienden fuera del neutro, transición
// suave del filtro en el preview, swatches más grandes con pop — app-05/07.
// v43: tarjeta de herramientas del Catálogo estilo InShot "Create New" —
// Galería · Cámara · Seleccionar · Compartir como círculos con etiqueta en una
// tarjeta elevada (reemplaza al FAB suelto + chips regados) — app-03/05/07.
// v44: la zona de publicar del Catálogo se vuelve tarjeta "Publicación" con el
// mismo lenguaje que la de Herramientas — app-03/05.
// v45: el cuadro de Publicación sale de la página de raíz — vive en un modal
// que abre la herramienta Compartir; la tarjeta de herramientas pasa a estar
// SIEMPRE (sin productos tampoco había cámara, bug cazado) — app-03/04/05/07.
// v46: canales de pedido a elección del dueño (WhatsApp + SMS/Llamadas con el
// mismo número + Instagram/Facebook/TikTok) que el cliente ve en la ficha, y
// COLLAGE de 2-4 fotos como quinta herramienta — app-02/03/05/07 + funciones +
// catalogo.html.
// v47: la Cámara pasa al extremo DERECHO de la tarjeta de herramientas del
// Catálogo (primera desde la derecha, donde cae el pulgar) — app-05.
// v48: las herramientas del Catálogo flotan sin la tarjeta contenedora (el
// cuadro de atrás se fue de raíz) — app-05.
// v49: Compartir va DIRECTO al menú nativo del teléfono (cero formularios en
// el medio — comparación del usuario con la hoja de iOS); los ajustes de
// Publicación viven en un engranaje junto al encabezado, siempre visible —
// app-05/07.
// v50: el engranaje se borra de raíz — PUBLICACIÓN AUTOMÁTICA (cada cambio del
// catálogo republica solo a los 4s, silencioso, con toast "Catálogo
// actualizado"); la config de una vez vive en la primera publicación
// (Compartir) y después en Ajustes → Publicación del catálogo — app-03/05/07.
// v51: collage con SELECTOR DE DISEÑOS (cuadrículas + Pinboard estilo polaroid
// con sombra) y los ítems del inventario FLOTANDO sin caja — app-03/04/05/07 +
// dusty.css.
// v52: Galería se fusiona en la Cámara (sin capture → la hoja nativa ofrece
// Tomar foto y Fototeca en un toque); quedan 4 herramientas — app-03/05/07.
// v53: Collage con DISEÑO PRIMERO (tocar Collage abre el menú de 9 layouts y
// recién el elegido pide sus fotos) y Seleccionar se muda a la izquierda de la
// fila del selector de vista (donde lo señaló el usuario) — app-03/05/07.
// v54: la fila Seleccionar + vista baja (margin-top) para agruparse con los
// ítems, despegada de las herramientas — app-05.
// v55: Seleccionar sin caja — texto pelado estilo iOS Fotos, verde en modo
// activo — app-05.
// v56: ítems de EJEMPLO en el Catálogo vacío (visuales, sin datos) para que
// el usuario nuevo vea cómo queda todo — desaparecen solos con el primer
// producto real — app-03/05.
// v57: cuarta opción de vista — cuadrícula de 4 columnas (ícono de 8 puntitos)
// en Inventario y Catálogo, la más densa — app-03/05 + dusty.css.
// v58: 10 TEMAS DE COLOR elegibles en Ajustes (7 oscuros con distintos acentos
// + 3 claros) — bloques de variables en dusty.css, selector de circulitos,
// se aplica al instante y se recuerda en el dispositivo — index/app-03/05/07.
// v59: apple-touch-icon y og-image regenerados con la marca naranja vigente
// (la tarjeta de compartir en iOS mostraba los colores viejos) + catalogo.html
// con favicon/theme-color/og propios.
// v60: 8 temas más con las paletas de referencia del usuario (Esmeralda,
// Índigo, Rubí, Zafiro oscuros + Pastel, Eléctrico, Coral, Miel claros) —
// solo colores de cada paleta, mezclados entre sí — dusty.css + app-05.
// v61: fuera el mostaza raro de Claro/Crema/Menta (captura del usuario) — en
// esos tres el saffron pasa a ser el acento del tema (Guardar y todo lo demás);
// en Menta las barras de alerta conservan un durazno propio para distinguirse.
// v62: mismo pedido que v61 pero en Coral, Miel y Pastel — el amarillo apagado
// del botón Guardar (y todo lo que lo usaba) pasa a ser el acento del tema.
// v63: COLORES DE DINERO FIJOS en los 18 temas (pedido del usuario): montos,
// $, porcentajes y barras siempre verde/rojo/ámbar (--money-*), sin importar
// el acento del tema — dusty.css + app-03/05/06/08.
// v64: scroll sin parpadeos — la capa de composición del track solo existe
// mientras se desliza/asienta (.vt-live), las páginas a 2+ pestañas no se
// rasterizan (content-visibility) y las fotos decodifican async; de paso el
// total del recibo pasa al verde de dinero fijo.
// v65: la Cámara del Catálogo al mismo porte que los escáneres (76px, ícono 32)
// — sin el override de 64px que la dejaba más chica — app-05.
// v66: fuera el título "Herramientas del catálogo" (borrado de raíz, pedido
// del usuario) — los círculos con etiqueta se explican solos — app-03/05.
// v67: dos temas claros más por captura del usuario — Robin (blanco + verde
// neón estilo Robinhood) y Cupertino (gris iOS + azul Apple, look App Store).
// Ya son 20 — dusty.css + app-05.
// v68: idioma en el botón, D con color fijo, catálogo más fluido (filas como
// lista, ayuda como toast, un solo scroll en asignar), auditoría de scroll.
// v69: auditoría "smooth" del Catálogo — visor con gestos (deslizar, pellizco,
// doble tap, X, Escape, vuelo desde la miniatura), compartir foto con archivo,
// miniaturas a 400px, editor a pantalla completa con antes/después, formato,
// enderezar y guía, progreso/cancelar en PRO, modo selección con contador,
// presión larga y arrastre, deshacer al pisar una foto — y ESTE cache de fotos
// de Storage (cache-first, tope de entradas) para la app y la página pública.
// v70: INTRO ÚNICA de cámara (captura del usuario de la hoja de iOS): Recibos,
// Productos, Estante y Catálogo abren igual al primer toque — hoja nativa en
// iOS (input sin capture), hoja de Dusty con Fototeca/Tomar foto en Android y
// escritorio; el visor en vivo de Productos/Estante se retiró — app-03/04/06/07/08 + css.
// v71: la intro única es el MODAL con la caja punteada (captura del usuario en
// iPhone: salían la caja y la hoja nativa a la vez); la hoja recién al tocar la
// caja, y el Catálogo gana su propio modal con la misma caja — app-03/04/05/06/07/08.
// v72: al tocar una cámara sale SOLO la hoja de fotos (nativa iOS / de Dusty
// en Android), sin modal antes; el modal del escáner aparece con la foto elegida.
// La explicación de cada cámara pasa a una burbuja junto al botón (primera vez
// y presión larga). Fuera el modal "Foto de producto" del Catálogo — app-04/05/06/07/08 + css.
// v73: decisión final de la intro única (el usuario descartó la hoja gris:
// "tapa"): las cuatro cámaras abren el MISMO modal con título, la línea que
// explica el escáner, la caja punteada (cámara directo) y el link de galería.
// Fuera la hoja nativa/propia y las burbujas — app-03/04/05/06/07/08 + css.
// v74: auditoría de primer minuto (onboarding). Tutorial de 2 pasos que termina
// abriendo la cámara; "Mejor en equipo" al primer Compartir; encabezado estable
// (Entrar hasta tener datos, luego Guardar); tarjeta Primeros pasos en vez de los
// ceros; "?" = ayuda con reporte al pie; estados vacíos con botón; alta rápida;
// confeti + toast al primer escaneo — app-01/03/04/05/06/07 + css + extract-receipt.
// v75: auditoría del presupuesto. Tarjeta siempre en el mes calendario con
// "Gastos X de Y · Quedan Z", marca de ritmo y proyección; avisos al umbral y al
// 100% (toast + tarjeta); historial por mes; gráfico apilado con línea de
// presupuesto; gastado por categoría; solo el dueño edita; pago de bill por id;
// comprometido de bills; objetivo costo/ventas — app-02/03/05/06/07 + css.
// v76: el aviso de presupuesto PALPITA (pedido del usuario, en vez de
// notificaciones fuera de la app): barra que respira, tarjeta con halo y
// ícono latiendo, punto sobre el Dashboard en la barra inferior — app-03/04 + css.
// v77: el calendario de Recibos vuelve a verse SIEMPRE (sin recibos no se podía
// anotar un recordatorio tocando un día) — app-05.
// v78: interruptor "Latidos de aviso" en Ajustes (apaga/prende las palpitaciones
// de Inventario y Presupuesto) — app-03/05/07 + css.
// v79: auditoría de cámaras (30 puntos): revisión compacta con foto de referencia
// y barra fija en Recibos; costo solo con precio visible; "sigue leyendo" y
// cancelar sin perder la foto; aviso de calidad y 2000 px en Productos y Estante;
// no reconocidos del estante → alta con la misma foto; código de barras local,
// entrada manual, linterna y SKU siempre; ficha que no pisa lo escrito; consejos
// de encuadre y cupo visible — app-01/03/05/06/07/08 + css + prompts.
// v80: AJUSTES reorganizado (auditoría 2026-09-07): título "Ajustes", cinco
// secciones con nombre (Apariencia, Inventario, Alertas, Catálogo, Cuenta),
// todo se aplica al instante (sin Guardar/Cancelar), Publicación vuelve a
// Ajustes, Compartir cuenta también en Cuenta, y el respaldo exporta la
// configuración del catálogo — app-03/05/07.
// v81: INVENTARIO reorganizado (maqueta aprobada 2026-09-07, para 100+
// productos): franja Valor/Potencial, fila de herramientas con nombre (Pedido,
// Conteo, Escanear estante sin badge), buscador fijo con vista y orden, filtros
// rápidos Crítico/Toca contar/Sin foto, chips con "Todos", grupos plegables y
// "ver los restantes" — app-03/05/07/08 + css.
// v82: DASHBOARD reorganizado (maqueta aprobada 2026-09-07): dos botones
// arriba (Ayuda pasa a Ajustes), un solo bloque de presupuesto (inversión +
// gastos con barra, sin franja repetida), fila de herramientas con nombre
// (Productos · Escanear recibo · A mano, sin órbita), "Hoy" con Críticos /
// Toca contar / Salud que abren el Inventario filtrado, y filas de Pedido
// sugerido, Último recibo, Producción y Cambios — app-03/04/05/07 + css.
// v83: PLANTILLAS en el Catálogo (pedido del usuario 2026-09-07): cuarta
// herramienta que arma una imagen para compartir o imprimir — catálogo en
// grilla, lista de precios, menú de restaurante u oferta; post / historia /
// hoja; oscuro / claro / cálido; varias páginas; Guardar y Compartir como
// archivos — app-03/04/05/07.
// v84: Plantillas con GALERÍA de miniaturas reales (pedido del usuario: que se
// vean las maquetas con sus productos antes de elegir) y diseño nuevo "Por
// categorías" con banda de color y tarjetas con foto redonda (su referencia),
// que sirve para menús y catálogos — app-03/05/07 + css.
// v85: DASHBOARD "anillo + cuadrícula" (maqueta aprobada 2026-09-08): la
// tarjeta de presupuesto con anillo del % gastado y cuatro cifras, y los
// módulos (Críticos, Toca contar, Pedido, Último recibo, Producción,
// Actividad) como tarjetas en dos columnas con ícono y badge. Dos temas
// nuevos "App Store" (claro y noche) con los degradados pastel muestreados
// de la captura del usuario. Y las otras pestañas con el mismo estilo en esos
// temas: Inventario (Valor/Potencial en verde y azul, anillos de Pedido/Conteo
// en color, chip activo en color, tarjetas blancas), Recibos (mes, días con
// recibo y Cierre de mes en color) y Catálogo (anillos en color). Y los 21
// temas de siempre con su PROPIA paleta de tarjetas (seis tonos por tema,
// degradés derivados: profundos en oscuro, pastel en claro). Y en el Catálogo
// la fila de herramientas (Collage, Plantillas, Compartir, Cámara) dentro del
// mismo cuadro de color que el presupuesto — app-03/05/07 + css.
// v86: recibos de VARIAS páginas se leen una página por pedido, en paralelo, y
// se unen en la app (mergeReceiptPages, patron-core, con tests): mandar las 4
// páginas de una factura de 80 renglones en un solo pedido tardaba más de lo
// que Netlify le permite a una función y volvía como "no se pudo conectar".
// Mensajes de error por estado (413 fotos muy pesadas, 502/504 tardó demasiado)
// — patron-core/app-03/app-06.
// v87: PARPADEO y "palpitaciones" con inventarios grandes (auditoría medida
// con 150 productos con foto y 120 recibos): claves estables (data-key) para
// que morphdom mueva las tarjetas en vez de recrearlas (0 fotos re-decodificadas
// al reordenar, antes 15), view-transition-name solo en lo que anima en cada
// transición (cerrar un modal pasó de ~270 capas a 1), y los latidos de
// presupuesto por opacidad/anillo en vez de filter y box-shadow animados —
// app-04/05 + css.
// v88: PARPADEO AL CAMBIAR DE PESTAÑA (medido cuadro a cuadro): al tocar una
// pestaña a 2+ de distancia (Dashboard → Recibos, Inventario → Catálogo) la
// página de destino, marcada .far (content-visibility:hidden), entraba VACÍA
// durante todo el resorte y aparecía de golpe al asentarse. Ahora se destapan
// las páginas que pasan por debajo del deslizamiento antes de medir, y el
// resorte arranca un cuadro después, con la página ya pintada — app-06.
// v89: asentado LIVIANO del cambio de pestaña: al terminar el resorte ya no se
// re-arma el template entero (25-55 ms en escritorio, un tirón en teléfono):
// solo se ajustan transform/.active/.far/barra/alto del viewport; el render
// completo queda para cuando quedó uno pospuesto durante la animación — app-06.
const CACHE_NAME = 'patron-shell-v89';
// Fotos del catálogo en Storage (versionadas por ?v=, inmutables): cache-first
// con tope — la app y catalogo.html las muestran sin volver a bajarlas.
const PHOTO_CACHE = 'patron-photos-v1';
const PHOTO_HOSTS = ['storage.googleapis.com', 'firebasestorage.googleapis.com'];
const PHOTO_CACHE_MAX = 240;

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/dusty.css',
  '/patron-core.js',
  '/nudgy-core.js',
  '/morphdom-umd.min.js',
  '/app-01-estado.js',
  '/app-02-nube.js',
  '/app-03-base.js',
  '/app-04-render.js',
  '/app-05-vistas.js',
  '/app-06-modales.js',
  '/app-07-eventos.js',
  '/app-08-produccion.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-512-maskable.png',
  '/apple-touch-icon.png'
];

// Orígenes de fuentes: se cachean por separado (cache-first) porque son
// archivos versionados/inmutables — no hace falta ni tiene sentido pedirlos
// de nuevo en cada carga.
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names.filter(name => name !== CACHE_NAME && name !== PHOTO_CACHE).map(name => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Firebase (auth/firestore/storage), Netlify functions y cualquier otra
  // llamada a la nube quedan sin tocar: ya manejan su propio caso de "sin
  // red" en el código de la app, y no tiene sentido cachear esas respuestas.
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(req));
  } else if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(req));
  } else if (PHOTO_HOSTS.includes(url.hostname) && req.destination === 'image') {
    // Solo las <img> (destination image): las llamadas del SDK de Firebase al
    // mismo host (subidas, metadata) siguen sin tocarse.
    event.respondWith(photoCacheFirst(req));
  }
});

async function photoCacheFirst(req){
  const cache = await caches.open(PHOTO_CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  const fresh = await fetch(req);
  if (fresh && (fresh.ok || fresh.type === 'opaque')) {
    cache.put(req, fresh.clone()).then(() => trimPhotoCache(cache)).catch(() => {});
  }
  return fresh;
}
// Tope de entradas (las más viejas primero — el orden de keys() es el de
// inserción): sin esto un catálogo grande crecería sin límite en el disco.
async function trimPhotoCache(cache){
  const keys = await cache.keys();
  if (keys.length <= PHOTO_CACHE_MAX) return;
  const extra = keys.slice(0, keys.length - PHOTO_CACHE_MAX);
  await Promise.all(extra.map(k => cache.delete(k)));
}

async function networkFirst(req){
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await cache.match(req);
    if (cached) return cached;
    // Navegación (recarga/abrir la app) sin red y sin esa URL exacta en
    // caché: se sirve el shell de todos modos, la SPA arranca desde ahí.
    if (req.mode === 'navigate') {
      const shell = await cache.match('/index.html');
      if (shell) return shell;
    }
    throw err;
  }
}

async function cacheFirst(req){
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  if (cached) return cached;
  const fresh = await fetch(req);
  if (fresh && fresh.ok) cache.put(req, fresh.clone());
  return fresh;
}
