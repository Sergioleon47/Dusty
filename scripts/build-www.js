// Copia el app shell estático (el mismo que precachea sw.js) a www/ — la carpeta
// que Capacitor empaqueta dentro del APK como "webDir". No hay bundler ni paso de
// compilación real: index.html/patron-core.js se editan tal cual siempre en la
// raíz del repo, esto solo los junta con los demás assets estáticos en un solo
// lugar para que Capacitor no se lleve netlify/, marketing/, node_modules/, etc.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WWW = path.join(ROOT, 'www');

const FILES = [
  'index.html',
  'dusty.css',
  'patron-core.js',
  'nudgy-core.js',
  'morphdom-umd.min.js',
  'app-01-estado.js',
  'app-02-nube.js',
  'app-03-base.js',
  'app-04-render.js',
  'app-05-vistas.js',
  'app-06-modales.js',
  'app-07-eventos.js',
  'app-08-produccion.js',
  // 2026-09-11: faltaban desde que attachEvents() se partió en cinco archivos
  // (SW v133) — el paquete de la app instalada se armaba SIN los eventos del
  // Dashboard, Inventario, Ajustes, Cuenta y escáneres. Cualquier archivo nuevo
  // de la app va acá, en index.html y en PRECACHE_URLS de sw.js: los tres.
  'app-09-eventos-dashboard.js',
  'app-10-eventos-inventario.js',
  'app-11-eventos-ajustes.js',
  'app-12-eventos-cuenta.js',
  'app-13-eventos-escaneres.js',
  'app-14-reportes.js',
  'app-15-servicios.js',
  'manifest.json',
  // AUDITORÍA 2026-09-09: faltaban en el paquete. privacy.html y
  // delete-account.html se enlazan desde Ajustes › Cuenta y daban 404 DENTRO
  // de la app instalada (Google Play exige que la política sea accesible);
  // html5-qrcode.min.js hacía que el escáner de códigos de barras dependiera
  // de internet y de un CDN, en una app que se publicita como offline.
  'privacy.html',
  'delete-account.html',
  'html5-qrcode.min.js',
  'sw.js',
  'icon-192.png',
  'icon-512.png',
  'icon-512-maskable.png',
  'apple-touch-icon.png'
];

fs.rmSync(WWW, { recursive: true, force: true });
fs.mkdirSync(WWW, { recursive: true });

for (const file of FILES) {
  fs.copyFileSync(path.join(ROOT, file), path.join(WWW, file));
}

console.log(`Copiados ${FILES.length} archivos a www/`);
