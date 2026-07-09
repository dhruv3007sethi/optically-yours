// Local-only dev server: serves the static site AND handles POST /api/save-offers
// by writing directly to data/offers.json on disk (no GitHub, no Vercel needed).
// Run with: node dev-server.js
// This file is for local testing only — the real deploy uses api/save-offers.js on Vercel.

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OFFERS_PATH = path.join(ROOT, 'data', 'offers.json');
const PORT = 8080;
const ADMIN_KEY = '181275';
const ALLOWED_PAGE_FILES = [
  'index.html', 'about.html', 'products.html', 'services.html',
  'blogs.html', 'contact.html',
  'blog-astigmatism.html', 'blog-hyperopia.html', 'blog-myopia.html', 'blog-presbyopia.html',
];

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.gif': 'image/gif',
  '.webp': 'image/webp', '.ico': 'image/x-icon',
};

function serveStatic(req, res) {
  let filePath = decodeURIComponent(req.url.split('?')[0]);
  if (filePath === '/') filePath = '/index.html';
  const fullPath = path.join(ROOT, filePath);
  if (!fullPath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(fullPath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function handleSaveOffers(req, res) {
  if (req.headers['x-admin-key'] !== ADMIN_KEY) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    try {
      const { offers } = JSON.parse(body);
      if (!Array.isArray(offers)) throw new Error('"offers" must be an array');
      for (const offer of offers) {
        if (!offer || typeof offer.title !== 'string' || !offer.title.trim()) {
          throw new Error('Each offer requires a non-empty "title"');
        }
        if (typeof offer.image !== 'string' || !offer.image.trim()) {
          throw new Error('Each offer requires an "image"');
        }
      }
      fs.writeFileSync(OFFERS_PATH, JSON.stringify(offers, null, 2) + '\n');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
}

function handleSavePage(req, res) {
  if (req.headers['x-admin-key'] !== ADMIN_KEY) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    try {
      const { file, html } = JSON.parse(body);
      if (!ALLOWED_PAGE_FILES.includes(file)) throw new Error('Unknown or disallowed file');
      if (typeof html !== 'string' || !html.trim()) throw new Error('"html" must be a non-empty string');
      fs.writeFileSync(path.join(ROOT, file), html);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/save-offers') {
    handleSaveOffers(req, res);
    return;
  }
  if (req.method === 'POST' && req.url === '/api/save-page') {
    handleSavePage(req, res);
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Local dev server (with working /api/save-offers) running at http://localhost:${PORT}`);
});
