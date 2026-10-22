// public/js/admin/dashboard.js
// Fetches admin KPI telemetry, populates tables, and renders vanilla Canvas 2D charts

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  initDashboard();

  document.getElementById('btnRefresh')?.addEventListener('click', () => {
    initDashboard(true);
  });
});

async function initDashboard(isManualRefresh = false) {
  const updateEl = document.getElementById('lastUpdated');
  if (updateEl) updateEl.textContent = 'Refreshing...';

  try {
    const res = await API.get('/api/admin/stats');
    if (!res.ok || !res.success) {
      if (typeof showToast === 'function') showToast(res.message || 'Failed to load telemetry', 'error');
      return;
    }

    renderKPIs(res.stats);
    renderRecentTrips(res.recent_trips || []);
    renderActivityLogs(res.recent_logs || []);
    drawTrendChart(res.chart_data?.trends || []);
    drawDonutChart(res.chart_data?.vehicle_dist || []);

    if (updateEl) {
      const now = new Date();
      updateEl.textContent = `Updated ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    }

    if (isManualRefresh && typeof showToast === 'function') {
      showToast('Dashboard metrics updated.', 'success');
    }

  } catch (err) {
    console.error('[admin/dashboard]', err);
    if (typeof showToast === 'function') showToast('Network error while loading metrics.', 'error');
  }
}

// ── Render KPI Cards ───────────────────────────────────────────
function renderKPIs(stats) {
  if (!stats) return;

  // Drivers
  document.getElementById('statDriversTotal').textContent = stats.drivers.total || 0;
  document.getElementById('statDriversOnline').textContent = `${stats.drivers.online || 0} online`;
  document.getElementById('statDriversPending').textContent = `${stats.drivers.pending || 0} pending`;

  // Passengers
  document.getElementById('statPassengersTotal').textContent = stats.passengers.total || 0;
  document.getElementById('statPassengersActive').textContent = `${stats.passengers.active || 0} active`;
  document.getElementById('statPassengers7d').textContent = `+${stats.passengers.new_7d || 0}`;

  // Fleet
  document.getElementById('statFleetTotal').textContent = stats.fleet.total || 0;
  document.getElementById('statFleetActive').textContent = `${stats.fleet.active || 0} operational`;

  // Trips
  document.getElementById('statTripsCompleted').textContent = stats.trips.completed || 0;
  document.getElementById('statTripsActive').textContent = `${stats.trips.active || 0} en route`;

  // Revenue
  const revFormatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(stats.trips.revenue || 0);
  document.getElementById('statRevenue').textContent = revFormatted;

  // Pending Alert
  const pendingCount = stats.drivers.pending || 0;
  const alertEl = document.getElementById('pendingDriverAlert');
  if (alertEl) {
    if (pendingCount > 0) {
      document.getElementById('pendingAlertText').textContent = `${pendingCount} driver${pendingCount > 1 ? 's' : ''}`;
      alertEl.style.display = 'flex';
    } else {
      alertEl.style.display = 'none';
    }
  }
}

// ── Render Recent Trips ────────────────────────────────────────
function renderRecentTrips(trips) {
  const tbody = document.getElementById('recentTripsTbody');
  if (!tbody) return;

  if (trips.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No trips recorded yet.</td></tr>';
    return;
  }

  tbody.innerHTML = trips.map(t => {
    const statusClass = t.status || 'pending';
    const statusLabel = statusClass.replace('_', ' ');
    const fareFormatted = t.fare ? `₹${parseFloat(t.fare).toFixed(2)}` : '—';

    return `
      <tr>
        <td>
          <div style="font-weight:700;">#${t.trip_id}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${t.passenger_name || 'Passenger'}</div>
        </td>
        <td>
          <div style="font-size:0.85rem; font-weight:600; max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            🟢 ${escapeHtml(t.pickup)}
          </div>
          <div style="font-size:0.8rem; color:var(--text-muted); max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            🔴 ${escapeHtml(t.destination)}
          </div>
        </td>
        <td>
          <span class="badge-vehicle badge-${t.vehicle_type || 'sedan'}">${t.vehicle_type || 'sedan'}</span>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">${t.vehicle_number || ''}</div>
        </td>
        <td style="font-weight:800; color:var(--text-dark);">
          ${fareFormatted}
        </td>
        <td>
          <span class="status-pill ${statusClass}">${statusLabel}</span>
        </td>
      </tr>
    `;
  }).join('');
}

// ── Render Activity Feed ───────────────────────────────────────
function renderActivityLogs(logs) {
  const container = document.getElementById('activityFeedList');
  if (!container) return;

  if (logs.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-muted);">No recent logs.</div>';
    return;
  }

  const icons = {
    BLOCK_PASSENGER: '🚫',
    UNBLOCK_PASSENGER: '✅',
    DRIVER_APPROVE: '🛡️',
    DRIVER_REJECT: '❌',
    DRIVER_BLOCK: '🛑',
    DRIVER_UNBLOCK: '🔓',
    UPDATE_VEHICLE_STATUS: '🚙',
    ADMIN_FORCE_COMPLETE_TRIP: '🏁',
    SYSTEM_INIT: '⚙️',
    LOGIN: '🔑',
    REGISTER: '👤'
  };

  container.innerHTML = logs.map(l => {
    const icon = icons[l.action] || '📌';
    const dateStr = l.created_at ? new Date(l.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

    return `
      <div class="activity-item">
        <div class="activity-icon">${icon}</div>
        <div class="activity-body">
          <div class="activity-title">${escapeHtml(l.action.replace(/_/g, ' '))}</div>
          <div class="activity-desc">${escapeHtml(l.description || '')}</div>
          <div class="activity-time">${dateStr} · By ${escapeHtml(l.user || 'System')}</div>
        </div>
      </div>
    `;
  }).join('');
}

// ── Canvas Chart 1: 7-Day Activity Trend Bar Chart ─────────────
function drawTrendChart(data) {
  const canvas = document.getElementById('trendChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Handle HiDPI screens
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;

  ctx.clearRect(0, 0, w, h);

  // If no data, render graceful placeholder chart
  const sampleDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  let items = data.length > 0 ? data : sampleDays.map(d => ({ date: d, trips: Math.floor(Math.random() * 8) + 2 }));

  const maxVal = Math.max(...items.map(i => i.trips), 5);
  const padding = { top: 30, right: 20, bottom: 40, left: 35 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  // Draw subtle horizontal grid lines
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
  ctx.lineWidth = 1;
  const gridLines = 4;
  for (let i = 0; i <= gridLines; i++) {
    const y = padding.top + (chartH / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();

    // Y Axis label
    ctx.fillStyle = '#8C95A0';
    ctx.font = '10px Plus Jakarta Sans, sans-serif';
    ctx.textAlign = 'right';
    const val = Math.round(maxVal - (maxVal / gridLines) * i);
    ctx.fillText(String(val), padding.left - 6, y + 3);
  }

  // Draw Bars
  const colWidth = chartW / items.length;
  const barWidth = Math.min(colWidth * 0.5, 36);

  items.forEach((item, index) => {
    const x = padding.left + index * colWidth + (colWidth - barWidth) / 2;
    const barH = (item.trips / maxVal) * chartH;
    const y = padding.top + chartH - barH;

    // Gradient bar fill
    const grad = ctx.createLinearGradient(0, y, 0, y + barH);
    grad.addColorStop(0, '#111315');
    grad.addColorStop(1, '#2A2E35');

    ctx.fillStyle = grad;
    // Rounded top bar
    drawRoundedRect(ctx, x, y, barWidth, Math.max(barH, 4), 6);
    ctx.fill();

    // Value on top of bar
    ctx.fillStyle = '#111315';
    ctx.font = 'bold 11px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(item.trips), x + barWidth / 2, y - 6);

    // X Axis Day Label
    ctx.fillStyle = '#656D76';
    ctx.font = '600 11px Plus Jakarta Sans, sans-serif';
    const dayLabel = item.date ? (item.date.includes('-') ? item.date.slice(5) : item.date) : '';
    ctx.fillText(dayLabel, x + barWidth / 2, h - 14);
  });
}

// ── Canvas Chart 2: Fleet Category Doughnut Chart ──────────────
function drawDonutChart(data) {
  const canvas = document.getElementById('fleetPieChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;

  ctx.clearRect(0, 0, w, h);

  const colorMap = {
    sedan:     '#4338CA',
    suv:       '#BE185D',
    hatchback: '#15803D',
    auto:      '#B45309',
    bike:      '#7E22CE'
  };

  const defaultData = [
    { type: 'sedan', count: 4 },
    { type: 'suv', count: 3 },
    { type: 'hatchback', count: 2 },
    { type: 'auto', count: 1 }
  ];

  const items = (data && data.length > 0) ? data : defaultData;
  const total = items.reduce((acc, curr) => acc + curr.count, 0) || 1;

  const centerX = w * 0.38;
  const centerY = h * 0.5;
  const outerRadius = Math.min(centerX, centerY) - 20;
  const innerRadius = outerRadius * 0.58;

  let startAngle = -Math.PI / 2;

  items.forEach(item => {
    const sliceAngle = (item.count / total) * (Math.PI * 2);
    const endAngle = startAngle + sliceAngle;

    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
    ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
    ctx.closePath();

    ctx.fillStyle = colorMap[item.type] || '#111315';
    ctx.fill();

    startAngle = endAngle;
  });

  // Center text
  ctx.fillStyle = '#111315';
  ctx.font = '900 18px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(total), centerX, centerY - 8);

  ctx.fillStyle = '#656D76';
  ctx.font = '600 10px Plus Jakarta Sans, sans-serif';
  ctx.fillText('VEHICLES', centerX, centerY + 12);

  // Legend on right
  const legendX = w * 0.68;
  let legendY = 40;

  items.forEach(item => {
    const color = colorMap[item.type] || '#111315';

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(legendX, legendY, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#111315';
    ctx.font = '700 12px Plus Jakarta Sans, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const percent = Math.round((item.count / total) * 100);
    ctx.fillText(`${capitalize(item.type)} (${percent}%)`, legendX + 12, legendY);

    legendY += 24;
  });
}

// ── Helper Utilities ───────────────────────────────────────────
function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
