// server/sseBroker.js
// Raw Node.js Server-Sent Events (SSE) connection broker & real-time event dispatcher
// Built strictly with Node.js built-in modules only — no Socket.io or external frameworks

'use strict';

// ── In-Memory SSE Connection Registries ───────────────────────
// tripSubscribers: Map<tripId, Set<{ res, req, userId, role }>>
const tripSubscribers = new Map();

// driverSubscribers: Map<driverId, Set<{ res, req, userId, vehicleType }>>
const driverSubscribers = new Map();

// adminSubscribers: Set<{ res, req, userId }>
const adminSubscribers = new Set();

// ── Format SSE frame ─────────────────────────────────────────
function formatSSE(eventName, data) {
  const payload = typeof data === 'string' ? data : JSON.stringify(data);
  return `event: ${eventName}\ndata: ${payload}\n\n`;
}

// ── Send event to a single stream ────────────────────────────
function sendEvent(res, eventName, data) {
  try {
    if (!res.writableEnded) {
      res.write(formatSSE(eventName, data));
    }
  } catch (err) {
    console.warn('[SSE sendEvent error]:', err.message);
  }
}

// ── Initialize an SSE Response Stream ─────────────────────────
function initSSEStream(req, res, initialComment = 'connected') {
  res.writeHead(200, {
    'Content-Type':                'text/event-stream; charset=utf-8',
    'Cache-Control':               'no-cache, no-transform',
    'Connection':                  'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':'Content-Type, Authorization',
    'X-Accel-Buffering':           'no', // disables reverse-proxy buffering
  });

  // Initial comment to flush HTTP headers immediately
  res.write(`: ${initialComment}\n\n`);

  // Disable socket timeout for long-lived push connection
  if (req.socket) {
    req.socket.setTimeout(0);
    req.socket.setNoDelay(true);
    req.socket.setKeepAlive(true);
  }
}

// ── Trip Subscription Management ─────────────────────────────
function subscribeToTrip(tripId, clientInfo) {
  const tId = String(tripId);
  if (!tripSubscribers.has(tId)) {
    tripSubscribers.set(tId, new Set());
  }
  const set = tripSubscribers.get(tId);
  set.add(clientInfo);

  // Auto cleanup on disconnect
  clientInfo.req.on('close', () => {
    set.delete(clientInfo);
    if (set.size === 0) {
      tripSubscribers.delete(tId);
    }
  });
}

function broadcastToTrip(tripId, eventName, data) {
  const tId = String(tripId);
  const set = tripSubscribers.get(tId);
  if (!set || set.size === 0) return 0;

  let sent = 0;
  for (const client of set) {
    if (!client.res.writableEnded) {
      sendEvent(client.res, eventName, data);
      sent++;
    }
  }
  return sent;
}

// ── Driver Dispatch Subscription Management ──────────────────
function subscribeDriver(driverId, clientInfo) {
  const dId = String(driverId);
  if (!driverSubscribers.has(dId)) {
    driverSubscribers.set(dId, new Set());
  }
  const set = driverSubscribers.get(dId);
  set.add(clientInfo);

  clientInfo.req.on('close', () => {
    set.delete(clientInfo);
    if (set.size === 0) {
      driverSubscribers.delete(dId);
    }
  });
}

function broadcastToDriver(driverId, eventName, data) {
  const dId = String(driverId);
  const set = driverSubscribers.get(dId);
  if (!set || set.size === 0) return 0;

  let sent = 0;
  for (const client of set) {
    if (!client.res.writableEnded) {
      sendEvent(client.res, eventName, data);
      sent++;
    }
  }
  return sent;
}

function broadcastDispatchToAllDrivers(eventName, data, targetVehicleType = null) {
  let sent = 0;
  for (const [, set] of driverSubscribers.entries()) {
    for (const client of set) {
      if (
        !client.res.writableEnded &&
        (!targetVehicleType || !client.vehicleType || client.vehicleType === targetVehicleType)
      ) {
        sendEvent(client.res, eventName, data);
        sent++;
      }
    }
  }
  return sent;
}

// ── Admin Subscription Management ────────────────────────────
function subscribeAdmin(clientInfo) {
  adminSubscribers.add(clientInfo);
  clientInfo.req.on('close', () => {
    adminSubscribers.delete(clientInfo);
  });
}

function broadcastToAdmins(eventName, data) {
  let sent = 0;
  for (const client of adminSubscribers) {
    if (!client.res.writableEnded) {
      sendEvent(client.res, eventName, data);
      sent++;
    }
  }
  return sent;
}

// ── 15-Second Keepalive Heartbeat ─────────────────────────────
// Prevents NAT routers, load balancers, and idle browser connections from closing
const heartbeatInterval = setInterval(() => {
  const ping = ': ping\n\n';

  // Ping trip clients
  for (const [, set] of tripSubscribers.entries()) {
    for (const client of set) {
      if (!client.res.writableEnded) {
        try { client.res.write(ping); } catch (e) { set.delete(client); }
      }
    }
  }

  // Ping driver clients
  for (const [, set] of driverSubscribers.entries()) {
    for (const client of set) {
      if (!client.res.writableEnded) {
        try { client.res.write(ping); } catch (e) { set.delete(client); }
      }
    }
  }

  // Ping admin clients
  for (const client of adminSubscribers) {
    if (!client.res.writableEnded) {
      try { client.res.write(ping); } catch (e) { adminSubscribers.delete(client); }
    }
  }
}, 15000);

if (heartbeatInterval.unref) {
  heartbeatInterval.unref(); // allow clean process exit during tests
}

module.exports = {
  initSSEStream,
  sendEvent,
  formatSSE,
  subscribeToTrip,
  broadcastToTrip,
  subscribeDriver,
  broadcastToDriver,
  broadcastDispatchToAllDrivers,
  subscribeAdmin,
  broadcastToAdmins,
};
