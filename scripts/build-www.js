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
