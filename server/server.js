// server/server.js
// Raw Node.js HTTP server — no Express or any web framework
// Serves static files from /public and routes API calls

'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

// ── Load .env before anything else ──────────────────────────
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq  = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

// ── Route handlers ───────────────────────────────────────────
const Router         = require('./router');
const authRoute      = require('./routes/auth');
const passengerRoute = require('./routes/passenger');
const driverRoute    = require('./routes/driver');
// Day 7+ routes:
// const adminRoute     = require('./routes/admin');
// const superRoute     = require('./routes/superadmin');

const router = new Router();
authRoute(router);
passengerRoute(router);
driverRoute(router);
// Day 7+:
// adminRoute(router);
// superRoute(router);

// ── MIME types ───────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT       = process.env.SERVER_PORT || 5000;

// ── Helper: send JSON ────────────────────────────────────────
function sendJSON(res, status, data) {
  res.writeHead(status, {
    'Content-Type':                'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

// ── Helper: read body ────────────────────────────────────────
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

// ── Helper: serve static file ────────────────────────────────
function serveStatic(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

// ── HTTP Server ──────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const parsed   = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // ── CORS preflight ──
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    });
    res.end();
    return;
  }

  // ── API routes ──
  if (pathname.startsWith('/api/')) {
    const match = router.match(req);
    if (!match) {
      sendJSON(res, 404, { success: false, message: 'API endpoint not found' });
      return;
    }
    try {
      req.body     = await readBody(req);
      req.sendJSON = (status, data) => sendJSON(res, status, data);
      await match.handler(req, res);
    } catch (err) {
      console.error('[server] API error:', err.message);
      sendJSON(res, 500, { success: false, message: 'Internal server error' });
    }
    return;
  }

  // ── Static files ──
  let filePath = pathname === '/' ? '/index.html' : pathname;
  // Prevent directory traversal
  filePath = path.normalize(path.join(PUBLIC_DIR, filePath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end('Forbidden');
    return;
  }

  // If no extension → try .html
  if (!path.extname(filePath)) filePath += '.html';

  serveStatic(res, filePath);
});

server.listen(PORT, () => {
  console.log(`\n🚖 Cab Booking Server running → http://localhost:${PORT}\n`);
});

module.exports = { sendJSON, readBody }; // exported for route files
