'use strict';
// Full API lifecycle test:
// Register → Login → Quote → Book → Accept → Start → Complete → Rate → History → Admin/Superadmin flows
// Run with: npm test
const http  = require('http');
const { spawn } = require('child_process');

let serverProc;
const PORT = 5000;

async function startServer() {
  return new Promise((resolve, reject) => {
    serverProc = spawn(process.execPath, ['server/server.js'], { stdio: ['ignore', 'pipe', 'pipe'], cwd: __dirname });
    let ready = false;
    serverProc.stdout.on('data', d => {
      const s = d.toString();
      process.stdout.write('[SRV] ' + s);
      if (!ready && s.includes('running')) { ready = true; setTimeout(resolve, 800); }
    });
    serverProc.stderr.on('data', d => process.stderr.write('[SRV ERR] ' + d.toString()));
    setTimeout(() => { if (!ready) reject(new Error('Server did not start in time')); }, 8000);
  });
}

async function api(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost', port: PORT, path, method,
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
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

let passed = 0, failed = 0;
function pass(label) { passed++; console.log('\x1b[32m  ✅ PASS\x1b[0m', label); }
function fail(label, detail) { failed++; console.log('\x1b[31m  ❌ FAIL\x1b[0m', label, '-', detail); process.exitCode = 1; }
function check(cond, label, detail) { cond ? pass(label) : fail(label, detail); }
function section(title) { console.log('\n\x1b[1m' + title + '\x1b[0m'); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  try {
    await startServer();
    const ts = Date.now();

    section('1. Health');
    const health = await api('GET', '/api/health');
    check(health.status === 200 && health.body.success, 'GET /api/health → 200', JSON.stringify(health.body));

    section('2. Register passenger (returns token)');
    const pEmail = `testpass_${ts}@test.com`;
    const reg = await api('POST', '/api/auth/register', { name: 'Test Passenger', email: pEmail, password: 'Test@1234', mobile: '9876543210', role: 'passenger' });
    check(reg.status === 201 && reg.body.token && reg.body.user?.role === 'passenger', 'POST /api/auth/register → 201 + token', JSON.stringify(reg.body));

    section('3. Login with real password / reject wrong password');
    const loginNew = await api('POST', '/api/auth/login', { email: pEmail, password: 'Test@1234' });
    check(loginNew.status === 200 && loginNew.body.token, 'login new passenger → 200', JSON.stringify(loginNew.body));
    const newToken = loginNew.body.token;
    const badLogin = await api('POST', '/api/auth/login', { email: pEmail, password: 'password123' });
    check(badLogin.status === 401, 'demo shortcut password rejected for non-demo account → 401', JSON.stringify(badLogin.body));

    section('4. Demo account login via handle');
    const loginP = await api('POST', '/api/auth/login', { email: 'passenger1', password: 'password123' });
    check(loginP.status === 200 && loginP.body.user?.email === 'passenger1@cab.com', 'login "passenger1" + demo password → 200', JSON.stringify(loginP.body));

    section('5. Fare quote');
    const search = await api('GET', '/api/rides/search?pickup=Anna+Nagar&destination=T+Nagar', null, newToken);
    check(search.status === 200 && Array.isArray(search.body.fareOptions) && search.body.fareOptions.length >= 1 && typeof search.body.availableDrivers === 'number',
      `GET /api/rides/search → ${search.body.fareOptions?.length} options, ${search.body.estimated_km} km, drivers online: ${search.body.availableDrivers}`, JSON.stringify(search.body));

    section('6. Book ride');
    const book = await api('POST', '/api/rides/book', { pickup_location: 'Anna Nagar', destination: 'T Nagar', vehicle_type: 'sedan' }, newToken);
    const requestId = book.body.request_id;
    check(book.status === 201 && requestId, `POST /api/rides/book → 201, request_id ${requestId}`, JSON.stringify(book.body));
    const dup = await api('POST', '/api/rides/book', { pickup_location: 'Anna Nagar', destination: 'T Nagar', vehicle_type: 'sedan' }, newToken);
    check(dup.status === 409, 'second booking while one is active → 409', JSON.stringify(dup.body));

    section('7. Driver login & go online');
    const loginD = await api('POST', '/api/auth/login', { email: 'driver1@cab.com', password: 'Driver@123' });
    check(loginD.status === 200 && loginD.body.token, 'login driver1 → 200', JSON.stringify(loginD.body));
    const dToken = loginD.body.token;
    const online = await api('PUT', '/api/driver/availability', { availability: 'online' }, dToken);
    check(online.status === 200 && online.body.availability === 'online', 'PUT /api/driver/availability → online', JSON.stringify(online.body));

    section('8. Driver dashboard & requests');
    const dDash = await api('GET', '/api/driver/dashboard', null, dToken);
    check(dDash.status === 200 && dDash.body.stats && 'today_trips' in dDash.body.stats, 'GET /api/driver/dashboard → stats incl. today_trips', JSON.stringify(dDash.body).slice(0, 200));
    const rideReqs = await api('GET', '/api/driver/ride-requests', null, dToken);
    check(rideReqs.status === 200 && rideReqs.body.requests?.some(r => r.request_id === requestId), 'GET /api/driver/ride-requests includes new request', JSON.stringify(rideReqs.body).slice(0, 200));

    section('9. Accept → start → status → complete');
    const accept = await api('PUT', `/api/driver/ride-requests/${requestId}/accept`, {}, dToken);
    const tripId = accept.body.trip_id;
    check(accept.status === 200 && tripId, `accept → trip_id ${tripId}`, JSON.stringify(accept.body));
    const accept2 = await api('PUT', `/api/driver/ride-requests/${requestId}/accept`, {}, dToken);
    check(accept2.status === 409, 'accepting again → 409', JSON.stringify(accept2.body));
    const start = await api('PUT', `/api/driver/trips/${tripId}/start`, {}, dToken);
    check(start.status === 200 && start.body.status === 'in_progress', 'start → in_progress', JSON.stringify(start.body));
    await sleep(300);
    const status = await api('GET', `/api/rides/status/${requestId}`, null, newToken);
    check(status.status === 200 && status.body.trip?.trip_status === 'in_progress' && status.body.trip?.driver_name, 'passenger status shows in_progress trip with driver', JSON.stringify(status.body).slice(0, 200));
    const complete = await api('PUT', `/api/driver/trips/${tripId}/complete`, { distance_km: 7.1, payment_method: 'upi' }, dToken);
    check(complete.status === 200 && complete.body.status === 'completed', `complete → fare ₹${complete.body.fare}`, JSON.stringify(complete.body));

    section('10. Payment record uses UPI');
    const receipt = await api('GET', `/api/payments/trip/${tripId}`, null, newToken);
    check(receipt.status === 200 && receipt.body.payment?.payment_method === 'upi' && receipt.body.payment?.payment_status === 'completed', 'GET /api/payments/trip/:id → upi completed', JSON.stringify(receipt.body).slice(0, 200));

    section('11. Rating');
    const rate = await api('POST', '/api/ratings', { trip_id: tripId, rating: 5, comment: 'Excellent driver' }, newToken);
    check(rate.status === 201, 'POST /api/ratings → 201', JSON.stringify(rate.body));
    const rated = await api('GET', `/api/ratings/trip/${tripId}`, null, newToken);
    check(rated.status === 200 && rated.body.rated === true, 'GET /api/ratings/trip/:id → rated', JSON.stringify(rated.body));
    const rateAgain = await api('POST', '/api/ratings', { trip_id: tripId, rating: 4 }, newToken);
    check(rateAgain.status === 409, 'duplicate rating → 409', JSON.stringify(rateAgain.body));

    section('12. Passenger dashboard, history & profile');
    const dash = await api('GET', '/api/passenger/dashboard', null, newToken);
    check(dash.status === 200 && dash.body.stats?.total_rides === 1 && Number(dash.body.stats?.total_spent) > 0, `dashboard → total_rides ${dash.body.stats?.total_rides}, spent ₹${dash.body.stats?.total_spent}`, JSON.stringify(dash.body).slice(0, 200));
    const hist = await api('GET', '/api/rides/history', null, newToken);
    const histRow = hist.body.history?.find(h => h.request_id === requestId);
    check(hist.status === 200 && histRow && histRow.rating === 5 && histRow.payment_method === 'upi', 'history row has driver, payment and rating', JSON.stringify(histRow));
    const prof = await api('PUT', '/api/passenger/profile', { name: 'Test Passenger', mobile: '9876543210', default_address: 'Anna Nagar' }, newToken);
    check(prof.status === 200, 'PUT /api/passenger/profile → 200', JSON.stringify(prof.body));
    const profGet = await api('GET', '/api/passenger/profile', null, newToken);
    check(profGet.status === 200 && profGet.body.profile?.default_address === 'Anna Nagar', 'GET /api/passenger/profile reflects update', JSON.stringify(profGet.body));

    section('13. Driver earnings & vehicles');
    const earn = await api('GET', '/api/driver/earnings?period=all', null, dToken);
    check(earn.status === 200 && earn.body.summary && earn.body.trips?.some(t => t.trip_id === tripId), `earnings → ₹${earn.body.summary?.total_earnings}`, JSON.stringify(earn.body).slice(0, 200));
    const vehAdd = await api('POST', '/api/driver/vehicles', { vehicle_number: `TN-TEST-${String(ts).slice(-5)}`, vehicle_type: 'sedan', model: 'Test Car' }, dToken);
    const vehId = vehAdd.body.vehicle?.vehicle_id;
    check(vehAdd.status === 201 && vehId, 'POST /api/driver/vehicles → 201', JSON.stringify(vehAdd.body));
    const vehDel = await api('DELETE', `/api/driver/vehicles/${vehId}`, null, dToken);
    check(vehDel.status === 200, 'DELETE /api/driver/vehicles/:id → 200', JSON.stringify(vehDel.body));

    section('14. New driver must be verified before going online');
    const drEmail = `testdriver_${ts}@test.com`;
    const regD = await api('POST', '/api/auth/register', { name: 'Test Driver', email: drEmail, password: 'Test@1234', mobile: '9876543211', role: 'driver', license_no: 'TN-99-TEST', license_expiry: '2030-01-01' });
    check(regD.status === 201 && regD.body.token, 'register driver → 201 + token', JSON.stringify(regD.body));
    const newDToken = regD.body.token;
    const earlyOnline = await api('PUT', '/api/driver/availability', { availability: 'online' }, newDToken);
    check(earlyOnline.status === 403, 'pending driver going online → 403', JSON.stringify(earlyOnline.body));

    section('15. Admin verifies driver');
    const loginA = await api('POST', '/api/auth/login', { email: 'admin@cab.com', password: 'Admin@123' });
    const aToken = loginA.body.token;
    check(loginA.status === 200 && aToken, 'admin login', JSON.stringify(loginA.body));
    const drivers = await api('GET', '/api/admin/drivers?verification=pending', null, aToken);
    const pendingDriver = drivers.body.drivers?.find(d => d.email === drEmail);
    check(drivers.status === 200 && pendingDriver, 'GET /api/admin/drivers?verification=pending lists new driver', JSON.stringify(drivers.body).slice(0, 200));
    const approve = await api('PUT', `/api/admin/drivers/${pendingDriver?.driver_id}/approve`, {}, aToken);
    check(approve.status === 200, 'PUT /api/admin/drivers/:id/approve → 200', JSON.stringify(approve.body));
    const nowOnline = await api('PUT', '/api/driver/availability', { availability: 'online' }, newDToken);
    check(nowOnline.status === 200, 'approved driver going online → 200', JSON.stringify(nowOnline.body));
    await api('PUT', '/api/driver/availability', { availability: 'offline' }, newDToken);

    section('16. Admin stats & fare rules');
    const adminStats = await api('GET', '/api/admin/stats', null, aToken);
    check(adminStats.status === 200 && adminStats.body.stats?.trips && Array.isArray(adminStats.body.recent_trips), `GET /api/admin/stats → trips ${adminStats.body.stats?.trips?.total}`, JSON.stringify(adminStats.body).slice(0, 200));
    const fares = await api('GET', '/api/admin/fare-rules', null, aToken);
    const sedanRule = fares.body.rules?.find(r => r.vehicle_type === 'sedan');
    check(fares.status === 200 && sedanRule, 'GET /api/admin/fare-rules → sedan rule', JSON.stringify(fares.body).slice(0, 200));
    const fareUpd = await api('PUT', `/api/admin/fare-rules/${sedanRule?.fare_id}`, { base_fare: sedanRule?.base_fare }, aToken);
    check(fareUpd.status === 200, 'PUT /api/admin/fare-rules/:id → 200', JSON.stringify(fareUpd.body));
    const forbidden = await api('GET', '/api/admin/stats', null, newToken);
    check(forbidden.status === 403, 'passenger calling admin API → 403', JSON.stringify(forbidden.body));

    section('17. Superadmin overview, settings & logs');
    const loginSA = await api('POST', '/api/auth/login', { email: 'superadmin@cab.com', password: 'SuperAdmin@123' });
    const saToken = loginSA.body.token;
    check(loginSA.status === 200 && saToken, 'superadmin login', JSON.stringify(loginSA.body));
    const overview = await api('GET', '/api/superadmin/overview', null, saToken);
    check(overview.status === 200 && overview.body.stats?.users && Array.isArray(overview.body.admins), 'GET /api/superadmin/overview → stats + admins', JSON.stringify(overview.body).slice(0, 200));
    const settings = await api('GET', '/api/superadmin/settings', null, saToken);
    check(settings.status === 200 && 'driver_commission_pct' in (settings.body.settings || {}), `GET /api/superadmin/settings → commission ${settings.body.settings?.driver_commission_pct}%`, JSON.stringify(settings.body));
    const upd = await api('PUT', '/api/superadmin/settings', { driver_commission_pct: settings.body.settings?.driver_commission_pct ?? 15, maintenance_mode: false }, saToken);
    check(upd.status === 200 && upd.body.settings?.maintenance_mode === false, 'PUT /api/superadmin/settings → 200', JSON.stringify(upd.body).slice(0, 200));
    const logs = await api('GET', '/api/superadmin/logs?limit=20', null, saToken);
    check(logs.status === 200 && Array.isArray(logs.body.logs) && logs.body.pagination, `GET /api/superadmin/logs → ${logs.body.logs?.length} entries`, JSON.stringify(logs.body).slice(0, 200));
    const admins = await api('GET', '/api/superadmin/admins', null, saToken);
    check(admins.status === 200 && Array.isArray(admins.body.admins) && Array.isArray(admins.body.available_permissions), 'GET /api/superadmin/admins → list + permissions', JSON.stringify(admins.body).slice(0, 200));

    console.log('\n\x1b[1m═══════════════════════════════════\x1b[0m');
    if (failed > 0) console.log(`\x1b[31m  ${failed} FAILED, ${passed} passed\x1b[0m`);
    else console.log(`\x1b[32m  ALL ${passed} TESTS PASSED — E2E complete!\x1b[0m`);
    console.log('\x1b[1m═══════════════════════════════════\x1b[0m\n');

  } catch (err) {
    console.error('Fatal test error:', err);
    process.exitCode = 1;
  } finally {
    if (serverProc) serverProc.kill();
    setTimeout(() => process.exit(process.exitCode || 0), 500);
  }
})();
