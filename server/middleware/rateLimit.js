// server/middleware/rateLimit.js
// In-memory sliding-window IP rate limiter to protect against brute-force and DoS attacks

'use strict';

// Storage: key -> { count: number, resetTime: number }
const buckets = new Map();

// Configuration
const AUTH_WINDOW_MS = 60 * 1000;    // 1 minute
const AUTH_MAX_REQ   = 20;           // max 20 auth attempts per minute

const API_WINDOW_MS  = 60 * 1000;    // 1 minute
const API_MAX_REQ    = 150;          // max 150 general API calls per minute

/**
 * Determine rate limits for an incoming request path
 */
function getLimitsForPath(pathname) {
  if (pathname.startsWith('/api/auth/login') || pathname.startsWith('/api/auth/register')) {
    return { windowMs: AUTH_WINDOW_MS, max: AUTH_MAX_REQ, type: 'auth' };
  }
  return { windowMs: API_WINDOW_MS, max: API_MAX_REQ, type: 'api' };
}

/**
 * Check if the request from the specified IP is within limits
 * @param {string} ip
 * @param {string} pathname
 * @returns {{ allowed: boolean, limit: number, remaining: number, resetTime: number }}
 */
function checkRateLimit(ip, pathname) {
  const { windowMs, max, type } = getLimitsForPath(pathname);
  const now = Date.now();
  const bucketKey = `${type}:${ip}`;

  let record = buckets.get(bucketKey);

  if (!record || now >= record.resetTime) {
    // New or expired window
    record = {
      count: 1,
      resetTime: now + windowMs
    };
    buckets.set(bucketKey, record);
    return {
      allowed: true,
      limit: max,
      remaining: max - 1,
      resetTime: record.resetTime
    };
  }

  // Active window
  record.count += 1;
  const remaining = Math.max(0, max - record.count);
  const allowed = record.count <= max;

  return {
    allowed,
    limit: max,
    remaining,
    resetTime: record.resetTime
  };
}

/**
 * Periodic eviction of expired buckets to prevent memory accumulation
 */
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of buckets.entries()) {
    if (now >= record.resetTime) {
      buckets.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Allow Node.js process to exit gracefully without waiting for cleanup timer
if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

/**
 * Reset rate limit buckets (useful for test suites)
 */
function resetRateLimits() {
  buckets.clear();
}

module.exports = {
  checkRateLimit,
  resetRateLimits
};
