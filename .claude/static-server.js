const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };

http.createServer((req, res) => {
  let p = req.url.split('?')[0];
  // SOLO DEV: guarda un PNG generado en el navegador en la RAÍZ del proyecto
  // (POST /__save-png?name=apple-touch-icon con el base64 como body) — usado
  // para regenerar iconos/og-image con la marca vigente sin herramientas externas.
  if (req.method === 'POST' && p === '/__save-png') {
    const name = String(new URLSearchParams(req.url.split('?')[1] || '').get('name') || '').replace(/[^a-z0-9_-]/gi, '');
    if (!name) { res.writeHead(400); res.end('bad name'); return; }
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      try {
        fs.writeFileSync(path.join(root, name + '.png'), Buffer.from(body, 'base64'));
        res.writeHead(200); res.end('ok');
      } catch (e) { res.writeHead(500); res.end(String(e)); }
    });
    return;
  }
  if (p === '/') p = '/index.html';
  const filePath = path.join(root, decodeURIComponent(p));
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(process.env.PORT || 8934, () => console.log('listening on ' + (process.env.PORT || 8934)));
