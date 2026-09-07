const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };

http.createServer((req, res) => {
  let p = req.url.split('?')[0];
  // SOLO DEV: guarda una textura de escenario generada en el navegador
  // (POST /__save-backdrop?name=wood con el base64 del jpg como body).
  if (req.method === 'POST' && p === '/__save-backdrop') {
    const name = String(new URLSearchParams(req.url.split('?')[1] || '').get('name') || '').replace(/[^a-z0-9_-]/gi, '');
    if (!name) { res.writeHead(400); res.end('bad name'); return; }
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      try {
        const dir = path.join(root, 'backdrops');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        fs.writeFileSync(path.join(dir, name + '.jpg'), Buffer.from(body, 'base64'));
        res.writeHead(200); res.end('ok');
      } catch (e) { res.writeHead(500); res.end(String(e)); }
    });
    return;
  }
  if (p === '/') p = '/index.html';
  // Emulación local de producción para el catálogo público:
  // - /c/<id> sirve catalogo.html (como el redirect de netlify.toml)
  // - la función get-catalog devuelve un catálogo de MUESTRA (en Netlify la
  //   función real lee Firestore; acá solo queremos ver la página andando)
  if (p.startsWith('/c/')) p = '/catalogo.html';
  if (p === '/.netlify/functions/get-catalog') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      businessName: 'Panadería La Espiga', whatsapp: '5215512345678', lang: 'es',
      channels: { sms: true, call: true, instagram: 'laespiga', facebook: 'laespigapan', tiktok: 'laespiga' },
      items: [
        { name: 'Pan de masa madre', price: 6.5, unit: 'unidad', category: 'Panes', photoUrl: null },
        { name: 'Concha de vainilla', price: 1.25, unit: 'unidad', category: 'Dulce', photoUrl: null },
        { name: 'Baguette', price: 3, unit: 'unidad', category: 'Panes', photoUrl: null },
        { name: 'Torta de tres leches', price: null, unit: null, category: 'Dulce', photoUrl: null }
      ],
      updatedAt: new Date().toISOString()
    }));
    return;
  }
  const filePath = path.join(root, decodeURIComponent(p));
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(process.env.PORT || 8934, () => console.log('listening on ' + (process.env.PORT || 8934)));
