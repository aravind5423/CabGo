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

// ── Middleware & Security ─────────────────────────────────────
const { checkRateLimit } = require('./middleware/rateLimit');

// ── Route handlers ───────────────────────────────────────────
const Router         = require('./router');
const authRoute      = require('./routes/auth');
const passengerRoute = require('./routes/passenger');
const driverRoute    = require('./routes/driver');
const ratingsRoute   = require('./routes/ratings');
const paymentsRoute  = require('./routes/payments');
const adminRoute     = require('./routes/admin');
const superRoute     = require('./routes/superadmin');
const streamRoute    = require('./routes/stream');

const router = new Router();
authRoute(router);
passengerRoute(router);
driverRoute(router);
ratingsRoute(router);
paymentsRoute(router);
adminRoute(router);
superRoute(router);
streamRoute(router);

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

// ── Security Helper: resolve client IP ────────────────────────
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

// ── Security Helper: recursive input sanitization ─────────────
function sanitizeInput(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    return obj.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeInput);
  }
  if (typeof obj === 'object') {
    const clean = {};
    for (const [key, val] of Object.entries(obj)) {
      clean[key] = sanitizeInput(val);
    }
    return clean;
  }
  return obj;
}

// ── Helper: send JSON with enhanced CORS & Security Headers ───
function sendJSON(res, status, data, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type':                 'application/json',
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'X-Content-Type-Options':       'nosniff',
    'X-Frame-Options':              'DENY',
    ...extraHeaders
  });
  res.end(JSON.stringify(data));
}

// ── Helper: read body with sanitization ───────────────────────
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      try {
        const parsed = raw ? JSON.parse(raw) : {};
        resolve(sanitizeInput(parsed));
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
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff'
    });
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
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Max-Age':       '86400',
    });
    res.end();
    return;
  }

  // ── API routes ──
  if (pathname.startsWith('/api/')) {
    // 1. In-memory IP rate limiting (bypass for persistent SSE streams)
    const clientIp = getClientIp(req);
    const isSSE = pathname.startsWith('/api/stream/');
    const rateCheck = isSSE ? { allowed: true } : checkRateLimit(clientIp, pathname);

    if (!rateCheck.allowed) {
      const retryAfterSec = Math.max(1, Math.ceil((rateCheck.resetTime - Date.now()) / 1000));
      sendJSON(res, 429, {
        success: false,
        message: 'Too many requests. Rate limit exceeded, please try again shortly.'
      }, {
        'Retry-After': String(retryAfterSec),
        'X-RateLimit-Limit': String(rateCheck.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(rateCheck.resetTime / 1000))
      });
      return;
    }

    const match = router.match(req);
    if (!match) {
      sendJSON(res, 404, { success: false, message: 'API endpoint not found' });
      return;
    }
    try {
      req.body     = await readBody(req);
      req.sendJSON = (status, data, extraHeaders) => sendJSON(res, status, data, extraHeaders);
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

// ── Socket.IO Real-Time Engine Integration ────────────────────
let io = null;
try {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }
  });

  io.on('connection', (socket) => {
    // console.log('[Socket.IO] Client connected:', socket.id);

    // Join room helpers
    socket.on('join:trip', (tripId) => {
      socket.join(`trip:${tripId}`);
    });

    socket.on('join:driver', (driverId) => {
      socket.join(`driver:${driverId}`);
    });

    // Driver location telemetry heartbeat
    socket.on('driver:ping_location', (data) => {
      if (data && data.tripId) {
        io.to(`trip:${data.tripId}`).emit('driver:location_tick', data);
      } else {
        io.emit('driver:location_tick', data);
      }
    });

    socket.on('disconnect', () => {
      // client disconnected
    });
  });
} catch (err) {
  console.warn('[Socket.IO] Initialization warning:', err.message);
}

server.listen(PORT, () => {
  console.log(`\n🚖 Cab Booking Server running → http://localhost:${PORT}\n`);
});

module.exports = { server, io, sendJSON, readBody }; // exported for route files
