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
  'patron-core.js',
  'manifest.json',
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
