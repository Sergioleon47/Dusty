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
const CACHE_NAME = 'patron-shell-v10';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/dusty.css',
  '/patron-core.js',
  '/morphdom-umd.min.js',
  '/app-01-estado.js',
  '/app-02-nube.js',
  '/app-03-base.js',
  '/app-04-render.js',
  '/app-05-vistas.js',
  '/app-06-modales.js',
  '/app-07-eventos.js',
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
