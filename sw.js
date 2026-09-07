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
const CACHE_NAME = 'patron-shell-v59';

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
        names.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
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
  }
});

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
