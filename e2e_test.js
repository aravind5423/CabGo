'use strict';
// Full E2E lifecycle test: Register → Login → Search Fare → Book → Accept → Start → Complete → Rate → Settings
const http  = require('http');
const { spawn } = require('child_process');

let serverProc;

async function startServer() {
  return new Promise((resolve, reject) => {
    serverProc = spawn(process.execPath, ['server/server.js'], { stdio: ['ignore','pipe','pipe'], cwd: __dirname });
    let ready = false;
    serverProc.stdout.on('data', d => {
      const s = d.toString();
      process.stdout.write('[SRV] ' + s);
      if (!ready && s.includes('running')) { ready = true; setTimeout(resolve, 800); }
    });
    serverProc.stderr.on('data', d => process.stderr.write('[SRV ERR] ' + d.toString()));
    setTimeout(() => { if (!ready) reject(new Error('Server did not start in time')); }, 6000);
  });
}

async function api(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost', port: 5000, path, method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function pass(label) { console.log('\x1b[32m  ✅ PASS\x1b[0m', label); }
function fail(label, detail) { console.log('\x1b[31m  ❌ FAIL\x1b[0m', label, '-', detail); process.exitCode = 1; }
function section(title) { console.log('\n\x1b[1m' + title + '\x1b[0m'); }

(async () => {
  try {
    await startServer();

    // ── 1. Health ─────────────────────────────────────────────
    section('1. Health Check');
    const health = await api('GET', '/api/health');
    health.status === 200 && health.body.success
      ? pass('GET /api/health → 200')
      : fail('GET /api/health', JSON.stringify(health.body));

    // ── 2. Register new passenger ─────────────────────────────
    section('2. Register new passenger');
    const ts    = Date.now();
    const email = `testpass_${ts}@test.com`;
    const reg   = await api('POST', '/api/auth/register', {
      name: 'Test Passenger', email, password: 'Test@1234',
      mobile: '9876543210', role: 'passenger',
    });
    reg.status === 201 && reg.body.success
      ? pass('POST /api/auth/register → 201')
      : fail('POST /api/auth/register', JSON.stringify(reg.body));

    // ── 3. Login as registered user ───────────────────────────
    section('3. Login (newly registered passenger)');
    const loginNew = await api('POST', '/api/auth/login', { email, password: 'Test@1234' });
    loginNew.status === 200 && loginNew.body.token
      ? pass('POST /api/auth/login → 200 + token')
      : fail('POST /api/auth/login', JSON.stringify(loginNew.body));
    const newToken = loginNew.body.token;

    // ── 4. Login as seeded passenger1 ─────────────────────────
    section('4. Login (seeded passenger1)');
    const loginP = await api('POST', '/api/auth/login', { email: 'passenger1@cab.com', password: 'Pass@123' });
    loginP.status === 200 && loginP.body.token
      ? pass('POST /api/auth/login (passenger1) → 200 + token')
      : fail('POST /api/auth/login (passenger1)', JSON.stringify(loginP.body));
    const pToken = loginP.body.token;

    // ── 5. Ride search (fare options) ─────────────────────────
    section('5. Ride Search — Fare Estimate (haversine fallback)');
    const search = await api('GET', '/api/rides/search?pickup=Anna+Nagar&destination=T+Nagar&type=sedan', null, pToken);
    if (search.status === 200 && search.body.fareOptions && search.body.fareOptions.length > 0) {
      pass(`GET /api/rides/search → ${search.body.fareOptions.length} options, dist: ${search.body.fareOptions[0].estimated_km} km, fare: ₹${search.body.fareOptions[0].estimated_fare}`);
    } else {
      fail('GET /api/rides/search', JSON.stringify(search.body));
    }

    // ── 6. Book a ride (new user, fresh account) ──────────────
    section('6. Book Ride');
    const book = await api('POST', '/api/rides/book', {
      pickup_location: 'Anna Nagar', destination: 'T Nagar', vehicle_type: 'sedan',
    }, newToken);
    const requestId = book.body.request_id;
    book.status === 201 && requestId
      ? pass(`POST /api/rides/book → 201, request_id: ${requestId}`)
      : fail('POST /api/rides/book', JSON.stringify(book.body));

    // ── 7. Login as driver1 ───────────────────────────────────
    section('7. Login (driver1)');
    const loginD = await api('POST', '/api/auth/login', { email: 'driver1@cab.com', password: 'Driver@123' });
    loginD.status === 200 && loginD.body.token
      ? pass('POST /api/auth/login (driver1) → 200 + token')
      : fail('POST /api/auth/login (driver1)', JSON.stringify(loginD.body));
    const dToken = loginD.body.token;

    // ── 8. Driver goes online ─────────────────────────────────
    section('8. Driver goes Online');
    const online = await api('PUT', '/api/driver/availability', { availability: 'online' }, dToken);
    online.status === 200 && online.body.success
      ? pass('PUT /api/driver/availability → online')
      : fail('PUT /api/driver/availability', JSON.stringify(online.body));

    // ── 9. Driver sees ride requests ──────────────────────────
    section('9. Driver views ride requests');
    const rideReqs = await api('GET', '/api/driver/ride-requests', null, dToken);
    rideReqs.status === 200 && Array.isArray(rideReqs.body.requests)
      ? pass(`GET /api/driver/ride-requests → ${rideReqs.body.requests.length} request(s)`)
      : fail('GET /api/driver/ride-requests', JSON.stringify(rideReqs.body));

    // ── 10. Driver accepts the new ride ───────────────────────
    section('10. Driver accepts ride');
    const accept = await api('PUT', `/api/driver/ride-requests/${requestId}/accept`, {}, dToken);
    const tripId = accept.body.trip_id;
    accept.status === 200 && tripId
      ? pass(`PUT /api/driver/ride-requests/${requestId}/accept → trip_id: ${tripId}`)
      : fail(`PUT /api/driver/ride-requests/${requestId}/accept`, JSON.stringify(accept.body));

    // ── 11. Driver starts trip ────────────────────────────────
    section('11. Driver starts trip');
    const start = await api('PUT', `/api/driver/trips/${tripId}/start`, {}, dToken);
    start.status === 200 && start.body.success
      ? pass(`PUT /api/driver/trips/${tripId}/start → in_progress`)
      : fail(`PUT /api/driver/trips/${tripId}/start`, JSON.stringify(start.body));

    // ── 12. Passenger checks ride status ──────────────────────
    section('12. Passenger checks ride status');
    await new Promise(r => setTimeout(r, 500)); // brief pause
    const status = await api('GET', `/api/rides/status/${requestId}`, null, newToken);
    status.status === 200 && status.body.success
      ? pass(`GET /api/rides/status/${requestId} → ${status.body.status || status.body.ride?.status}`)
      : fail(`GET /api/rides/status/${requestId}`, JSON.stringify(status.body));

    // ── 13. Driver completes trip ─────────────────────────────
    section('13. Driver completes trip');
    const complete = await api('PUT', `/api/driver/trips/${tripId}/complete`, {
      distance_km: 7.1, payment_method: 'upi',
    }, dToken);
    complete.status === 200 && complete.body.success
      ? pass(`PUT /api/driver/trips/${tripId}/complete → fare: ₹${complete.body.fare}`)
      : fail(`PUT /api/driver/trips/${tripId}/complete`, JSON.stringify(complete.body));

    // ── 14. Passenger submits rating ──────────────────────────
    section('14. Passenger submits driver rating');
    const rate = await api('POST', '/api/ratings', {
      trip_id: tripId, rating: 5, comment: 'Excellent driver, very smooth ride!',
    }, newToken);
    rate.status === 201 && rate.body.success
      ? pass('POST /api/ratings → 201 rating stored')
      : fail('POST /api/ratings', JSON.stringify(rate.body));

    // ── 15. Passenger dashboard ───────────────────────────────
    section('15. Passenger dashboard');
    const dash = await api('GET', '/api/passenger/dashboard', null, newToken);
    dash.status === 200 && dash.body.stats
      ? pass(`GET /api/passenger/dashboard → total_rides: ${dash.body.stats.total_rides}`)
      : fail('GET /api/passenger/dashboard', JSON.stringify(dash.body));

    // ── 16. Driver earnings ───────────────────────────────────
    section('16. Driver earnings');
    const earn = await api('GET', '/api/driver/earnings', null, dToken);
    earn.status === 200 && earn.body.success
      ? pass(`GET /api/driver/earnings → total: ₹${earn.body.summary?.total_earnings}`)
      : fail('GET /api/driver/earnings', JSON.stringify(earn.body));

    // ── 17. Admin login & stats ───────────────────────────────
    section('17. Admin login & stats');
    const loginA = await api('POST', '/api/auth/login', { email: 'admin@cab.com', password: 'Admin@123' });
    const aToken = loginA.body.token;
    loginA.status === 200 && aToken ? pass('Admin login') : fail('Admin login', JSON.stringify(loginA.body));

    const adminStats = await api('GET', '/api/admin/stats', null, aToken);
    adminStats.status === 200 && adminStats.body.success
      ? pass(`GET /api/admin/stats → trips: ${adminStats.body.stats?.trips?.total}`)
      : fail('GET /api/admin/stats', JSON.stringify(adminStats.body));

    // ── 18. Super Admin login & settings ─────────────────────
    section('18. Super Admin — settings');
    const loginSA = await api('POST', '/api/auth/login', { email: 'superadmin@cab.com', password: 'SuperAdmin@123' });
    const saToken  = loginSA.body.token;
    loginSA.status === 200 && saToken ? pass('SuperAdmin login') : fail('SuperAdmin login', JSON.stringify(loginSA.body));

    const settings = await api('GET', '/api/superadmin/settings', null, saToken);
    settings.status === 200 && settings.body.settings
      ? pass(`GET /api/superadmin/settings → commission_rate: ${settings.body.settings.commission_rate}`)
      : fail('GET /api/superadmin/settings', JSON.stringify(settings.body));

    // ── 19. Super Admin update settings ──────────────────────
    section('19. Super Admin — update settings');
    const upd = await api('PUT', '/api/superadmin/settings', { commission_rate: 16, maintenance_mode: false }, saToken);
    upd.status === 200 && upd.body.success
      ? pass('PUT /api/superadmin/settings → updated')
      : fail('PUT /api/superadmin/settings', JSON.stringify(upd.body));

    // ── 20. System logs ───────────────────────────────────────
    section('20. Super Admin — system logs');
    const logs = await api('GET', '/api/superadmin/logs', null, saToken);
    logs.status === 200 && Array.isArray(logs.body.logs)
      ? pass(`GET /api/superadmin/logs → ${logs.body.logs.length} log entries`)
      : fail('GET /api/superadmin/logs', JSON.stringify(logs.body));

    console.log('\n\x1b[1m═══════════════════════════════════\x1b[0m');
    if (process.exitCode === 1) {
      console.log('\x1b[31m  SOME TESTS FAILED — see above\x1b[0m');
    } else {
      console.log('\x1b[32m  ALL 20 TESTS PASSED — E2E complete!\x1b[0m');
    }
    console.log('\x1b[1m═══════════════════════════════════\x1b[0m\n');

  } catch (err) {
    console.error('Fatal test error:', err);
    process.exitCode = 1;
  } finally {
    if (serverProc) serverProc.kill();
    setTimeout(() => process.exit(process.exitCode || 0), 500);
  }
})();
