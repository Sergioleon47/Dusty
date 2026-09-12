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
// v90: pre-calentado de las páginas lejanas en tiempo libre (requestIdleCallback
// tras cada render y cada asentado): destaparlas en el toque costaba su primer
// layout+pintado (~60 ms en escritorio, un tirón en teléfono) al arrancar el
// deslizamiento hacia Recibos o Catálogo — app-04/06.
// v91: capa de composición propia (will-change) para todo lo que late — punto y
// anillo de la barra de abajo, anillo del escáner, anillo de la alerta de
// presupuesto, overlay de "toca contar" — y la barra fija como capa estable:
// parpadeo reportado en iOS en la franja sobre la barra (su sombra de 24 px)
// mientras el punto latía — css.
// v92: el punto de la barra late por OPACIDAD (sin escala), su anillo es un
// halo fijo que se desvanece, y la sombra de la barra fija es un degradado
// ::before en vez de un box-shadow difuminado — confirmado por el usuario que
// el parpadeo sobre la barra se iba al apagar los latidos (iOS re-rasterizaba
// la barra y su sombra en cada pulso) — css.
// v93: auditoría de rendimiento de UI 2026-09-08 — en páginas inactivas se
// pausan SOLO las animaciones infinitas (las de entrada quedaban congeladas
// invisibles y re-arrancaban al cambiar de pestaña: el parpadeo), barras de
// progreso por transform (compositor) en vez de width, esqueletos que reservan
// el alto real mientras llega el primer snapshot (sin saltos), y el resorte
// del swipe arranca en el mismo cuadro del pointerup — css + app-03/05/06/07.
// v94: segunda pasada de la auditoría de rendimiento — la barra de progreso
// del tutorial era la única que seguía animando width (layout por cuadro en
// la primera pantalla que ve un usuario nuevo); pasa a transform:scaleX como
// el resto — css + app-06.
// v95: auditoría con 400 productos y 15 recibos — "Menos stock" ordenaba por
// unidades sueltas (5 cajas vs 20 litros) en vez de por qué tan vacío está cada
// producto, y agrupar por categoría partía el ranking en 12 por grupo; el
// cambio de vista del inventario dejó de redibujar todo (34-61ms → 0-1ms) —
// app-05/06/07.
// v96: arranque — networkFirst esperaba a la red SIN tope, así que con señal
// mala pero viva (no falla, tarda) abrir la app se quedaba colgado en los ~15
// pedidos del shell aunque la copia guardada estuviera lista. Ahora la red
// tiene 2,5 s y después se sirve el caché, actualizando por detrás — sw.
// v97: compartir una foto hacia Dusty (share_target) — el POST de Android se
// atiende en el SW, la foto va a un caché aparte y la app la levanta al
// arrancar y abre el escaneo con ella; accesos directos del ícono; caché de
// íconos y fondos por una semana — manifest + sw + app-07 + netlify.toml.
// v98: Equipo (compartir la cuenta con un empleado) vuelve al Dashboard como
// tarjeta — había quedado solo en Ajustes › Cuenta, a tres toques, cuando la
// fila del inventario que también lo traía dejó de dibujarse; se borra esa
// función muerta — app-03 + app-05.
// v99: destello en el pie del Dashboard al deslizar desde Inventario (reporte
// del usuario 2026-09-08, "empezó desde que le metí muchos datos"): el alto
// del documento se encogía en el MISMO cuadro en que se quita el offset del
// carrusel y salta el scroll — con 400 productos son 36.692 px de golpe.
// Ahora encoger espera un cuadro; crecer sigue siendo inmediato — app-04/06.
// v101: se restaura el deslice entre pestañas EXACTAMENTE como estaba (revert
// de #15). Se había eliminado para ver si era la causa del destello del pie
// del Dashboard; el usuario confirmó que con el gesto fuera el destello SEGUÍA,
// así que el gesto queda descartado como causa y no había razón para perder la
// función. El código de app-04/05/06/07 vuelve byte a byte al estado previo;
// solo la versión del precache avanza, para no numerar hacia atrás.
// v102: el español pasa de rioplatense (voseo) a NEUTRO LATINOAMERICANO con
// "tú" (pedido del usuario 2026-09-09). 166 textos: imperativos (probá→prueba,
// tocá→toca, elegí→elige), presente (tenés→tienes, contás→cuentas), pronombre
// pegado (fijalo→fíjalo, contanos→cuéntanos) y vos→tú/ti/contigo — app-03.
// v103: al borrar un bill se ofrece borrar también sus PAGOS de este mes
// (reporte del usuario 2026-09-09: "borré los dos bills y la barra del
// presupuesto no hizo el cálculo"). El bill es la definición; el pago es un
// recibo aparte, y el presupuesto se calcula desde los recibos — app-03 + app-06.
// v104: un miembro del equipo no podía escanear —"topó el límite"— porque el
// pase sin cupo del dueño era por QUIEN LLAMA, no por cuenta: los escaneos del
// dueño salteaban la transacción sin descontar, el contador quedaba congelado
// en su tope y el empleado chocaba con él. Ahora el pase es de la cuenta —
// netlify/functions.
// v105: la ZONA DE CATÁLOGO se elimina de raíz (pedido del usuario 2026-09-09).
// Se van la 4.ª pestaña y todo lo suyo — publicación, visor de fotos, editor,
// collage, plantillas, canales de pedido, la página pública catalogo.html, el
// link /c/<id>, los fondos de /backdrops y las funciones get-catalog,
// publish-catalog, upload-catalog-photo, enhance-photo, remove-bg y stage-photo.
// El carrusel vuelve a 3 páginas — app-01..07 + dusty.css + netlify + reglas.
// v110: "Gasto por mes" deja de ser un gráfico. El SVG apilado con eje de
// montos, línea punteada del presupuesto y leyenda de tres colores pedía
// saber leer un gráfico para responder "cuánto gasté y cuánto me quedaba";
// ahora cada mes es una tarjeta con su número, una barra contra el tope y
// una frase llana (pedido del usuario 2026-09-09). Mismos cálculos —
// app-03 + app-05 + dusty.css.
// v111: en "Gasto por mes", recién instalado se ven dos tarjetas FANTASMA
// bajo el mes actual — los nombres reales de los dos meses anteriores con
// bloques grises donde irán el monto y la frase, y la barra en verde/ámbar
// apagados. Nunca inventan un número; solo muestran cómo va a quedar en vez
// de dejar la pantalla casi en blanco (pedido del usuario 2026-09-09) —
// app-03 + app-05 + dusty.css.
// v112: las muestras de "Gasto por mes" pasan de 2 a 7 meses y se van con el
// PRIMER recibo (antes se iban recién al aparecer un segundo mes con datos:
// convivían muestras con datos reales). Se desvanecen hacia abajo — la
// opacidad no se veía porque msCardIn termina en opacity:1 y una animación
// le gana al style inline. Probado con 12 meses reales a 320px: la lista
// scrollea y los botones quedan siempre a la vista — app-05 + dusty.css.
// v113: la CÁMARA pasa a rojo (pedido del usuario 2026-09-09) — los dos FAB
// de escanear, Dashboard e Inventario, dejan el verde de siempre (azul en
// los temas App Store) y toman el rojo de la app, con el pulso y el ícono
// acompañando. Como el rojo queda reservado para la cámara, "Conteo" sale
// de ese color y se iguala con "A mano": los dos en violeta — dusty.css.
// v114: "Pedido sugerido" vacío muestra tres filas SOMBRA de cómo se va a ver
// cuando haya productos por pedir (pedido del usuario 2026-09-09) — bloques
// grises, sin nombres ni cantidades inventadas, que se van solas apenas un
// producto llega a nivel crítico. El bloque gris (.ms-skel) pasó a llamarse
// .skel porque ahora lo comparten dos pantallas — app-03 + app-05 + app-06
// + dusty.css.
// v115: las sombras dejan de ser bloques grises y pasan a ser EJEMPLOS de
// verdad —nombres, montos y las mismas frases que una fila real— pero
// DESENFOCADOS y desvanecidos, cada vez más hacia abajo (pedido del usuario
// 2026-09-09: "ejemplos reales pero que no se vean tan nítidos como
// reales"). Los nombres de producto son genéricos, nunca del inventario del
// usuario. Vale para "Gasto por mes" y "Pedido sugerido"; .skel se va —
// app-03 + app-05 + app-06 + dusty.css.
// v116: auditoría general (pedido del usuario 2026-09-09). Se van 7 funciones,
// ~80 líneas de CSS y 18 claves de idioma que ya no usaba nadie; el calendario
// pasa a 6 filas fijas (cambiar de mes movía todo lo de abajo hasta 88px);
// Escape cierra las hojas (calculadora / cierre de mes) como el botón atrás;
// el lápiz del presupuesto y otros botones chicos llegan a 44px de zona
// tocable sin cambiar de tamaño; y la foto de un producto se guarda a 560px
// por los tres caminos por los que puede entrar (eran 400/300/300) —
// app-03 + app-05 + app-06 + app-07 + dusty.css.
// v117: la FOTO del recibo vuelve al día del calendario (se había ido con la
// maqueta que puso el número en todos los días). La celda con recibo es ahora
// una tarjetita redondeada de 17px con sombra y filo de luz —del mismo palo
// que los cuadros del resto de la app, pedido del usuario 2026-09-09— con el
// ×N cuando hay varios y el aro ámbar si además es hoy — app-05 + dusty.css.
// v118: el calendario vuelve a la CUADRÍCULA de casillas de la captura del
// usuario (2026-09-09): cada día con su fondo redondeado de 17px, los días de
// los meses vecinos sin casilla, y hoy con el contorno ámbar rodeando la
// casilla entera en vez del círculo relleno. Además, cuántos recibos tiene el
// mes a la vista, encima del Cierre de mes, a partir de dos —
// app-03 + app-05 + dusty.css.
// v119: la casilla con foto tiene EXACTAMENTE la misma forma que las demás
// (captura ampliada del usuario 2026-09-09: se veía más grande y más
// redonda). Se le saca la sombra proyectada y el aro blanco grueso, que la
// hacían flotar, y el estilo que hace a la <img> llenar la casilla pasa a ir
// también INLINE: con un CSS viejo en caché la foto se dibujaba con su
// proporción original y estiraba la casilla — app-05 + dusty.css.
// v120: las casillas del calendario pasan de 17 a 13px de radio. En una casilla
// de 46x42, 17px dejaba 8px de lado recto: la forma tiraba a óvalo. En las de
// número casi no se veía (su fondo apenas contrasta), pero la de la foto es
// blanca sobre el bloque y ahí saltaba — el usuario lo marcó con una captura
// ampliada. Misma geometría para las dos y el velo un poco más oscuro, para
// que la esquina de la casilla vacía también se vea — dusty.css.
// v121: la esquina de las casillas del calendario baja de 13 a 8px — la
// proporción de la captura que mandó el usuario (~17% del ancho de la
// casilla). Solo el radio: nada más del calendario cambia — dusty.css.
// v122: en el calendario de Recibos, un día con recibo muestra el ICONO de
// recibo en lugar del número, con la foto encima cuando carga; si la foto
// falla, queda el icono (antes la casilla quedaba vacía) — app-05 + css.
// v123: el bloque azul del calendario de Recibos va a SANGRE con los bordes de
// la referencia del usuario (arriba recto, pegado al borde superior y a los
// lados; solo las esquinas de abajo redondeadas) y se quita el buscador por
// monto que iba sobre él. El margen de página pasa de #app a cada .view-page
// (variables --page-pad-*) para que un bloque pueda salirse — css + app-05.
// v124: las cuatro esquinas del bloque azul del calendario iguales (el usuario
// pidió las de arriba como las de abajo, 28px) — css.
// v125: auditoria 2026-09-09 — XSS almacenado cerrado (mediaType de una foto
// de inventario iba sin escapar dentro de un atributo src), mensajes de error
// de escaneo escapados, freno contra pisar los datos cuando localStorage esta
// corrupto, mensaje de "no se pudo conectar" reescrito para el usuario final,
// y privacy.html + delete-account.html + html5-qrcode.min.js agregados al
// paquete de la app instalada — app-03/06 + scripts/build-www.js.
// v126: estado de red visible (auditoria 2026-09-09). El icono de nube pasa de
// dos estados a cuatro — al dia, subiendo, SIN CONEXION y NO SE PUDO GUARDAR —
// y aparece una franja fija sobre la barra de abajo cuando no hay red. Antes un
// sync roto hacia horas se veia igual que una subida en curso, y la app
// funcionaba offline sin decirlo nunca — app-01/02/03/04/07 + css.
// v127-v129: se deshace lo que cambiaba el aspecto de la app (pedido del
// usuario): el zoom vuelve a estar bloqueado, los campos a su tamano de
// siempre, los chips en cero como los demas y sin reglas de tableta. Queda solo
// lo que no se ve: deshacer un borrado en lote, la salida de "sin resultados",
// el aviso al exportar y el bloqueo del doble toque al aplicar un escaneo.
// v130: las fuentes pasan a su propia cache, que NO se borra al publicar.
// Estaban en CACHE_NAME y activate borra toda cache que no sea la del momento,
// asi que cada actualizacion las tiraba y la primera apertura despues volvia a
// pedirle la hoja de estilos a Google — y esa hoja BLOQUEA el dibujado. Medido
// con 253 productos y CPU 4x: con la hoja en cache la app abre en 547ms en 3G
// lento y 722ms sin conexion; sin ella en cache, 13,2s y 13,5s, con el HTML ya
// servido a los 10ms. Todo ese tiempo era un solo pedido a un tercero — sw.
// v131: los 17 campos numericos que no lo declaraban ahora piden el teclado que
// corresponde (inputmode decimal donde se escriben precios y cantidades,
// numerico donde se escriben enteros). Sin eso, en el telefono varios abrian un
// teclado sin punto decimal para escribir un precio. No cambia nada de como se
// ve la app — app-06/08.
// v132: pulido invisible. (a) Area de toque de 48x48 en 15 botones chicos y
// aislados — el lapiz del presupuesto medía 22x22, la X de cerrar la ficha
// 30x30, "Subir foto"/"Quitar foto" 29 de alto. Crece un ::after invisible, no
// el boton: comprobado pixel a pixel que las tres pestanas, la ficha y el cierre
// de mes quedan identicos, y que ningun boton le roba el toque a otro. Los
// botones pegados unos a otros (los de vista, los dias del calendario, los
// chips) quedan afuera a proposito. (b) Vibracion al confirmar: los avisos de
// exito y de error, y cada borrado. Mismo plugin Haptics que ya usaba el cambio
// de pestana, sin permisos nuevos; en el navegador no hace nada — css + app-03/06.
// v133: attachEvents() se partio en cinco archivos nuevos por pantalla
// (app-09..13) mas el trozo del Catalogo que se fue a app-08. Sin el bump, un
// cliente con el shell viejo cacheado se quedaria con el index nuevo pidiendo
// cinco scripts que su cache no tiene, o con el index viejo sin pedirlos: en los
// dos casos attachEvents llamaria a funciones que no existen.
// v140: introduccion nueva de tres pantallas (splash con la camara, bienvenida
// palabra por palabra, primer mes + eleccion Claro/Oscuro) en un nodo fuera de
// #app — startOnboarding en app-06 — y fuera de raiz el modal de idioma y el
// tutorial viejos. Cambios cruzados en app-01/03/04/05/06/07/11 + dusty.css:
// un cliente con app-04 viejo cacheado pediria langChoiceModal(), que ya no existe.
// v141: suscripcion ("primer mes por nuestra cuenta"). Pagina de suscripcion
// (openPaywall, app-06), candado requireWriteAccess en cada accion que escribe,
// franja de solo lectura, listener de meta/billing y access-state en app-02;
// funciones nuevas access-state / create-checkout / stripe-webhook y 402 en las
// de IA. TODO APAGADO hasta DUSTY_BILLING_ENABLED=1 en Netlify. Cambios cruzados
// en app-01..09 + dusty.css: sin el bump, un app-06 viejo no tendria openPaywall
// y el 402 del servidor reventaria en callDustyAI.
// v142: el Dashboard se ve igual con o sin datos. Fuera "Primeros pasos" y
// "Vamos a armar tu inventario" (escondian las baldosas y empujaban a escanear;
// pedido del usuario 2026-09-11: "que entre al dashboard completo y que el
// usuario haga lo que quiera desde ahi") — app-01/03/05/09 + dusty.css.
// v143: "Reports" — el informe del mes (resumen, gastos por categoria, detalle
// de recibos, compras por producto) en PDF generado en el dispositivo, sin
// librerias; se comparte (telefono) o descarga (escritorio). Archivo NUEVO
// app-14-reportes.js (precache + index + build-www) + botones en el Cierre de
// mes y en cada tarjeta de mes — app-03/05/06/07 + css.
// v144: la cabecera de las hojas a pantalla completa (Cierre de mes, calculadora
// de pedido) respeta la barra de estado en la app instalada — dusty.css.
// v145: la tarjeta de presupuesto del Dashboard nunca es blanca — sin
// presupuesto arranca del verde (--tile-ok) en todos los temas — app-05 + css.
// v146: modal de Presupuesto interactivo — la tarjeta del Dashboard arriba (verde/
// ámbar/rojo) que cambia EN VIVO mientras se escribe el monto, atajos (mes pasado,
// promedio, ±100), arrastre como interruptor, y textos más oscuros — app-03/05/09 + css.
// v147: la ficha del recibo es un COMPROBANTE contable (datos extraidos primero,
// tabla de lineas con cant. y p. unit., foto plegada debajo), Imprimir = PDF de los
// datos, y constructor de REPORTES por rango que mezcla dias y meses — app-03/04/05/06/14 + css.
// v149: Valor y Potencial de venta del Inventario son botones que abren su desglose
// (numero grande en su color, formula, barras por categoria, lista por producto con
// su cuenta, ganancia potencial y productos sin precio) — app-03/04/05/07/10 + css.
// v150: DESPEDIDA al eliminar la cuenta (openGoodbye, nodo fuera de #app) con
// el motivo a cambio del mes de regalo (exit-feedback sin sesion +
// retentionOffers por email, canjeado en getAccessState al volver); "quedate
// un mes gratis" de la encuesta previa ahora suma 30 dias de verdad
// (claim-retention); la encuesta ya no pregunta el motivo — app-03/06/07/12 + css.
// v152: el cambio lista / 2 / 3 columnas del desglose de Valor y Potencial ya no
// salta de golpe — entrada escalonada (45 ms por producto, tope en el 12.º) solo
// al cambiar de vista, no en redibujados de fondo — app-05 + css.
// v155: temas CLAROS mas vivos (App Store, Crema, Pastel, Coral, Miel): menos
// blanco arriba y mas cuerpo abajo en baldosas y botones; los oscuros igual -- css.
// v172: fusión de la auditoría de datos 2026-09-12 (rama en la nube) sobre la
// auditoría de Servicios del mismo día: producto terminado con id determinista
// y fusión de duplicados, cotizaciones con productos descuentan y devuelven
// stock, nota de cobro con id 'svc-cobro-*' (deja sin efecto lápidas viejas
// 'svc-due-*'), escáneres con presupuesto de tiempo — app-02/03/08/15/16/17.
const CACHE_NAME = 'patron-shell-v176';
// Fotos en Storage (versionadas por ?v=, inmutables): cache-first con tope —
// la app las muestra sin volver a bajarlas.
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
  '/app-09-eventos-dashboard.js',
  '/app-10-eventos-inventario.js',
  '/app-11-eventos-ajustes.js',
  '/app-12-eventos-cuenta.js',
  '/app-13-eventos-escaneres.js',
  '/app-14-reportes.js',
  '/app-15-servicios.js',
  '/app-16-agente.js',
  '/app-17-cotizaciones.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-512-maskable.png',
  '/apple-touch-icon.png'
];

// Orígenes de fuentes: se cachean por separado (cache-first) porque son
// archivos versionados/inmutables — no hace falta ni tiene sentido pedirlos
// de nuevo en cada carga.
// Van en su PROPIA caché, que no se borra al publicar una versión (auditoría
// 2026-09-09). Estaban en CACHE_NAME, y activate borra toda caché que no sea la
// del momento: cada actualización tiraba las fuentes y la primera apertura
// después volvía a pedirle la hoja de estilos a Google. Esa hoja BLOQUEA el
// dibujado, así que con mala señal la app quedaba en blanco esperándola —
// medido acá sin conexión: 12.470ms de los 13 segundos de arranque se iban en
// ese único pedido, con el HTML ya servido a los 10ms. Las fuentes no dependen
// de la versión de la app; no hay motivo para volver a bajarlas.
const FONT_CACHE = 'patron-fonts-v1';
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
        names.filter(name => name !== CACHE_NAME && name !== PHOTO_CACHE && name !== SHARE_CACHE && name !== FONT_CACHE).map(name => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

/* COMPARTIR UNA FOTO HACIA DUSTY (manifest.json → share_target). Android manda
   la foto como POST multipart a /?compartir=1; ese POST no existe como ruta en
   Netlify, así que si llegara a la red devolvería un error. Se atiende acá:
   la foto se guarda en un caché aparte y se responde con una redirección a la
   app, que al arrancar la levanta y abre el escaneo con ella (ver
   tomarFotoCompartida en app-07). Sin esto, el flujo entero no existe. */
const SHARE_CACHE = 'patron-compartido';
const SHARE_SLOT = '/__compartido__';
async function recibirCompartido(req){
  try{
    const form = await req.formData();
    const fotos = form.getAll('fotos').filter(f => f && f.size > 0);
    if(fotos.length){
      const cache = await caches.open(SHARE_CACHE);
      // Se guarda UNA entrada por foto, numerada, para conservar el orden en que
      // las eligió (un recibo largo puede venir en varias páginas).
      await cache.put(SHARE_SLOT, new Response(String(fotos.length), {
        headers: {'Content-Type':'text/plain'} }));
      for(let i=0;i<fotos.length;i++){
        await cache.put(SHARE_SLOT + '/' + i, new Response(fotos[i], {
          headers: {'Content-Type': fotos[i].type || 'image/jpeg'} }));
      }
    }
  }catch(err){
    console.error('[Dusty] no se pudo recibir la foto compartida:', err);
  }
  // 303: el navegador cambia el POST por un GET a la app, así recargar no
  // reenvía la foto.
  return Response.redirect('/?compartir=listo', 303);
}

self.addEventListener('fetch', event => {
  const req = event.request;

  const urlCompartir = new URL(req.url);
  if (req.method === 'POST' && urlCompartir.origin === self.location.origin
      && urlCompartir.searchParams.get('compartir') === '1') {
    event.respondWith(recibirCompartido(req));
    return;
  }

  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Firebase (auth/firestore/storage), Netlify functions y cualquier otra
  // llamada a la nube quedan sin tocar: ya manejan su propio caso de "sin
  // red" en el código de la app, y no tiene sentido cachear esas respuestas.
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(req, event));
  } else if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(req, FONT_CACHE));
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

/* Tope de espera a la red (auditoría de arranque 2026-09-08). Antes esto hacía
   `await fetch(req)` a secas: la red solo "perdía" si FALLABA. Con señal mala
   pero viva — el wifi de una tienda, datos en un sótano — no falla: tarda. Y
   como el shell son ~15 pedidos al mismo origen (los 8 app-0*.js, el css,
   patron-core, morphdom…), abrir la app se quedaba esperando a todos aunque la
   copia guardada estuviera lista desde el primer instante.
   Ahora, SI HAY COPIA EN CACHÉ, la red tiene 2,5 s para contestar; pasado ese
   tiempo se sirve la copia y la respuesta de red sigue viajando por detrás
   (event.waitUntil) para dejar el caché al día para la próxima apertura. Sin
   copia no hay nada mejor que esperar, así que se espera como siempre.
   Contrapartida asumida: en una red lenta, un archivo puede venir de la red y
   otro del caché en la misma carga. El precache versiona el juego COMPLETO por
   release (CACHE_NAME) y el SW se activa de inmediato (skipWaiting +
   clients.claim), así que esa mezcla solo es posible en la ventana de segundos
   entre un deploy y la actualización del SW — a cambio de sacar un bloqueo que
   hoy se sufre en cada apertura con mala señal. */
/* Se probó cambiar esto a "servir lo guardado y actualizar por detrás"
   (stale-while-revalidate) buscando arrancar más rápido, y NO mejoró nada:
   medido con los 253 productos y CPU 4x, la segunda apertura en 3G lento dio
   448ms con esta versión y 547ms con la otra. Los 13 segundos que se veían
   antes no eran de acá — eran de la hoja de fuentes de Google (ver FONT_CACHE
   más abajo). Se deja como está: cambiar a stale-while-revalidate retrasaría
   una apertura la llegada de cada versión nueva, a cambio de nada. */
const NETWORK_TIMEOUT_MS = 2500;
async function networkFirst(req, event){
  const cache = await caches.open(CACHE_NAME);
  const red = fetch(req).then(fresh => {
    if (fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  });
  const cached = await cache.match(req);
  if (cached) {
    let temporizador;
    const espera = new Promise(r => { temporizador = setTimeout(() => r(null), NETWORK_TIMEOUT_MS); });
    // red.catch(...) => null: un fallo de red también "pierde" la carrera y cae
    // a la copia guardada, igual que antes.
    const ganador = await Promise.race([red.catch(() => null), espera]);
    clearTimeout(temporizador);
    if (ganador) return ganador;
    // La red no llegó a tiempo (o falló): se sirve lo guardado y se deja que la
    // actualización termine sola, sin que nadie la espere.
    if (event && event.waitUntil) event.waitUntil(red.catch(() => {}));
    return cached;
  }
  try {
    return await red;
  } catch (err) {
    // Navegación (recarga/abrir la app) sin red y sin esa URL exacta en
    // caché: se sirve el shell de todos modos, la SPA arranca desde ahí.
    if (req.mode === 'navigate') {
      const shell = await cache.match('/index.html');
      if (shell) return shell;
    }
    throw err;
  }
}

async function cacheFirst(req, nombreCache){
  const cache = await caches.open(nombreCache || CACHE_NAME);
  const cached = await cache.match(req);
  if (cached) return cached;
  const fresh = await fetch(req);
  if (fresh && fresh.ok) cache.put(req, fresh.clone());
  return fresh;
}
