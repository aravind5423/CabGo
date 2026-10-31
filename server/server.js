// server/server.js
// Express HTTP server with helmet, cors, rate limiting, Socket.IO, and static file serving.
// Backwards-compatible: attaches req.sendJSON shim so all existing raw-HTTP route handlers
// continue to work without modification.

'use strict';

// ── Load .env before anything else ──────────────────────────
const fs   = require('fs');
const path = require('path');
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

const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const http    = require('http');

// ── In-house middleware ──────────────────────────────────────
const { checkRateLimit } = require('./middleware/rateLimit');

// ── Route handlers ───────────────────────────────────────────
const authRoute      = require('./routes/auth');
const passengerRoute = require('./routes/passenger');
const driverRoute    = require('./routes/driver');
const ratingsRoute   = require('./routes/ratings');
const paymentsRoute  = require('./routes/payments');
const adminRoute     = require('./routes/admin');
const superRoute     = require('./routes/superadmin');
const streamRoute    = require('./routes/stream');

// ── Custom router (unchanged — all routes still use this API) ─
const Router = require('./router');
const router = new Router();
authRoute(router);
passengerRoute(router);
driverRoute(router);
ratingsRoute(router);
paymentsRoute(router);
adminRoute(router);
superRoute(router);
streamRoute(router);

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT       = parseInt(process.env.SERVER_PORT, 10) || 5000;

// ── Security Helper: recursive input sanitization ─────────────
function sanitizeInput(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    return obj.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }
  if (Array.isArray(obj)) return obj.map(sanitizeInput);
  if (typeof obj === 'object') {
    const clean = {};
    for (const [key, val] of Object.entries(obj)) clean[key] = sanitizeInput(val);
    return clean;
  }
  return obj;
}

// ── sendJSON helper (used by route files via req.sendJSON shim) ─
function sendJSON(res, status, data, extraHeaders = {}) {
  // If Express res is already sent, skip
  if (res.headersSent) return;
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options':        'DENY',
    ...extraHeaders,
  });
  res.status(status).json(data);
}

// ── Helper: read body (kept for module.exports compatibility) ──
function readBody(req) {
  // With Express json() middleware body is already on req.body
  return Promise.resolve(req.body || {});
}

// ── Express App ──────────────────────────────────────────────
const app = express();

// Security headers via helmet (replaces manual header setting)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // Allow inline scripts in existing HTML pages
}));

// CORS — allow all origins (matching original behaviour)
app.use(cors({
  origin:  '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Parse JSON bodies; sanitize after parsing
app.use(express.json({ limit: '1mb' }));
app.use((req, _res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeInput(req.body);
  }
  next();
});

// ── req.sendJSON shim ─────────────────────────────────────────
// All existing route handlers call req.sendJSON(status, data).
// This middleware attaches it so routes need zero changes.
app.use((req, res, next) => {
  req.sendJSON = (status, data, extraHeaders) => sendJSON(res, status, data, extraHeaders);
  next();
});

// ── In-memory rate limiter (preserved from original) ─────────
app.use('/api', (req, res, next) => {
  const isSSE = req.path.startsWith('/stream/');
  if (isSSE) return next(); // SSE connections bypass rate limiting

  const clientIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
  const rateCheck = checkRateLimit(clientIp, req.path);
  if (!rateCheck.allowed) {
    const retryAfterSec = Math.max(1, Math.ceil((rateCheck.resetTime - Date.now()) / 1000));
    res.set({
      'Retry-After':        String(retryAfterSec),
      'X-RateLimit-Limit':  String(rateCheck.limit),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset':  String(Math.ceil(rateCheck.resetTime / 1000)),
    });
    return res.status(429).json({
      success: false,
      message: 'Too many requests. Rate limit exceeded, please try again shortly.',
    });
  }
  next();
});

// ── API routes (custom Router adaptor) ───────────────────────
// The custom Router stores routes as {method, regex, keys, handler}.
// We delegate matching to it so all route files stay unchanged.
app.use('/api', async (req, res, next) => {
  // Patch req.url so custom Router sees the full /api/... path
  const fullReq = { ...req, url: '/api' + req.path, method: req.method, headers: req.headers };
  // We need the real req to stay patched, so mutate req.url temporarily
  const origUrl = req.url;
  req.url = '/api' + req.path;

  const match = router.match(req);
  req.url = origUrl; // restore

  if (!match) return next(); // let Express handle 404 below

  try {
    await match.handler(req, res);
  } catch (err) {
    console.error('[server] API error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
});

// ── 404 for unmatched /api/* ──────────────────────────────────
app.use('/api', (_req, res) => {
  res.status(404).json({ success: false, message: 'API endpoint not found' });
});

// ── Static files (/public) ────────────────────────────────────
// Serve index.html for bare "/" and extension-less paths (SPA-friendly)
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));
app.get('/', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

// ── HTTP Server ──────────────────────────────────────────────
const server = http.createServer(app);

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
