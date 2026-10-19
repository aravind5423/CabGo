// server/routes/auth.js
// Auth routes: register, login, logout, /me
// Will be fully implemented on Day 2

'use strict';

/**
 * @param {import('../router')} router
 */
module.exports = function authRoute(router) {
  // Health check
  router.get('/api/health', async (req, res) => {
    req.sendJSON(200, { success: true, message: '🚖 Cab Booking API is running', timestamp: new Date().toISOString() });
  });

  // Placeholder — full implementation on Day 2
  router.post('/api/auth/register', async (req, res) => {
    req.sendJSON(501, { success: false, message: 'Register endpoint coming on Day 2' });
  });

  router.post('/api/auth/login', async (req, res) => {
    req.sendJSON(501, { success: false, message: 'Login endpoint coming on Day 2' });
  });

  router.post('/api/auth/logout', async (req, res) => {
    req.sendJSON(200, { success: true, message: 'Logged out' });
  });

  router.get('/api/auth/me', async (req, res) => {
    req.sendJSON(501, { success: false, message: '/me endpoint coming on Day 2' });
  });
};
