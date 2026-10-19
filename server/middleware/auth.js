// server/middleware/auth.js
// HMAC-SHA256 token validation + role extraction
// Token format: base64(header).base64(payload).HMAC_signature

'use strict';

const crypto = require('crypto');

const SECRET = process.env.TOKEN_SECRET || 'cab_booking_secret_change_me';

// ---------- Token creation ----------
function createToken(payload) {
  const header  = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body    = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig     = crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

// ---------- Token verification ----------
function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    // Check expiry
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------- Middleware: extract token from Authorization header ----------
function authenticate(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  return verifyToken(token);
}

// ---------- Role guard helper ----------
function requireRole(roles) {
  return function (req) {
    const payload = authenticate(req);
    if (!payload) return { ok: false, status: 401, message: 'Unauthorized' };
    if (roles && !roles.includes(payload.role)) {
      return { ok: false, status: 403, message: 'Forbidden' };
    }
    return { ok: true, user: payload };
  };
}

module.exports = { createToken, verifyToken, authenticate, requireRole };
