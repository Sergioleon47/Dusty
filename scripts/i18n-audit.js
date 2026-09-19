// scripts/i18n-audit.js — claves de I18N (app-03) muertas, asimétricas o pedidas sin existir.
// Uso: npm run i18n:audit. Sale con código 1 si hay algo que arreglar.
// 1) carga el objeto I18N real en un vm (no regex sobre el archivo), 2) busca cada
// clave como literal exacto en todo el código, y trata como usadas las que caen bajo un
// prefijo/sufijo dinámico (t('x_'+k), t(`x_${k}`), t(k+'_sub')) — esas se listan
// aparte para revisarlas a ojo, porque un sufijo genérico como _sub puede salvar de más.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'app-03-base.js'), 'utf8');
// Solo el objeto I18N: desde "const I18N = {" hasta el "};" que lo cierra (línea 1714).
const start = src.indexOf('const I18N = {');
const endIdx = src.indexOf('\n};', start) + 3;
const objSrc = src.slice(start, endIdx).replace('const I18N =', 'I18N =');
const sb = {}; vm.createContext(sb); vm.runInContext(objSrc, sb);
const es = sb.I18N.es, en = sb.I18N.en;
const keys = new Set([...Object.keys(es), ...Object.keys(en)]);

// Código a escanear (sin el propio bloque I18N, sin tests, sin node_modules/www/android/ios).
const files = [];
for (const f of fs.readdirSync(ROOT)) {
  if (/\.(js|html)$/.test(f) && !/\.test\.js$/.test(f) && !/\.min\.js$/.test(f)) files.push(path.join(ROOT, f));
}
for (const f of fs.readdirSync(path.join(ROOT, 'netlify/functions'))) if (f.endsWith('.js')) files.push(path.join(ROOT, 'netlify/functions', f));
for (const f of fs.readdirSync(path.join(ROOT, 'netlify/functions/lib'))) if (f.endsWith('.js') && !f.endsWith('.test.js')) files.push(path.join(ROOT, 'netlify/functions/lib', f));
let code = '';
for (const f of files) {
  let c = fs.readFileSync(f, 'utf8');
  if (f.endsWith('app-03-base.js')) c = c.slice(0, start) + c.slice(endIdx);
  code += '\n/*FILE ' + f + '*/\n' + c;
}

// Prefijos dinámicos: t('abc_' + ...), t("abc_"+...), t(`abc_${...}`), y también
// 'abc_'+ usados fuera de t() (p. ej. const k = 'svc_'+x; t(k)).
const prefixes = new Set();
for (const m of code.matchAll(/t\(\s*['"]([A-Za-z0-9_]+?)['"]\s*\+/g)) prefixes.add(m[1]);
for (const m of code.matchAll(/t\(\s*`([A-Za-z0-9_]+?)\$\{/g)) prefixes.add(m[1]);
for (const m of code.matchAll(/['"]([A-Za-z0-9]+_)['"]\s*\+/g)) prefixes.add(m[1]);
for (const m of code.matchAll(/`([A-Za-z0-9]+_)\$\{/g)) prefixes.add(m[1]);
// Sufijos dinámicos: t(x + '_sub'), t(`${x}_title`)
const suffixes = new Set();
for (const m of code.matchAll(/\+\s*['"](_[A-Za-z0-9_]+?)['"]\s*\)/g)) suffixes.add(m[1]);
for (const m of code.matchAll(/\$\{[^}]+\}(_[A-Za-z0-9_]+?)`/g)) suffixes.add(m[1]);

const literalUsed = new Set();
for (const m of code.matchAll(/['"`]([A-Za-z][A-Za-z0-9_]*)['"`]/g)) literalUsed.add(m[1]);

const dead = [], byPrefix = [], onlyEs = [], onlyEn = [];
for (const k of [...keys].sort()) {
  if (!(k in es)) onlyEn.push(k);
  if (!(k in en)) onlyEs.push(k);
  if (literalUsed.has(k)) continue;
  const p = [...prefixes].find(p => k.startsWith(p));
  const s = [...suffixes].find(s => k.endsWith(s));
  if (p || s) { byPrefix.push(k + '  (' + (p ? 'prefijo ' + p : 'sufijo ' + s) + ')'); continue; }
  dead.push(k);
}
// Claves pedidas con literal directo t('x') que no existen en ningún idioma.
const missing = new Set();
for (const m of code.matchAll(/\bt\(\s*['"]([A-Za-z][A-Za-z0-9_]*)['"]\s*\)/g)) if (!keys.has(m[1])) missing.add(m[1]);

console.log('claves es:', Object.keys(es).length, ' en:', Object.keys(en).length, ' unión:', keys.size);
console.log('\n== Solo en ES (falta en EN):', onlyEs.length); console.log(onlyEs.join('\n'));
console.log('\n== Solo en EN (falta en ES):', onlyEn.length); console.log(onlyEn.join('\n'));
console.log('\n== Pedidas por t(\'…\') y NO definidas:', missing.size); console.log([...missing].join('\n'));
console.log('\n== Sin literal exacto pero cubiertas por prefijo/sufijo dinámico:', byPrefix.length); console.log(byPrefix.join('\n'));
console.log('\n== MUERTAS (sin literal ni prefijo):', dead.length); console.log(dead.join('\n'));
if (dead.length || onlyEs.length || onlyEn.length || missing.size) process.exit(1);
