// public/js/superadmin/dashboard.js
// Executive governance telemetry, role distribution donut, audit action bar chart, and operator roster

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  initSuperadminDashboard();

  document.getElementById('btnRefresh')?.addEventListener('click', () => {
    initSuperadminDashboard(true);
  });

  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    try {
      await API.post('/api/auth/logout');
    } catch (e) {
      // ignore network errors on logout
    }
    sessionStorage.clear();
    window.location.href = '/login.html';
  });
});

async function initSuperadminDashboard(isManualRefresh = false) {
  const updateEl = document.getElementById('lastUpdated');
  if (updateEl) updateEl.textContent = 'Updating metrics…';

  try {
    const res = await API.get('/api/superadmin/overview');
    if (!res.ok || !res.success) {
      if (typeof showToast === 'function') showToast(res.message || 'Failed to load telemetry.', 'error');
      if (updateEl) updateEl.textContent = 'Error loading telemetry';
      return;
    }

    renderKPIs(res.stats);
    drawRoleDonutChart(res.chart_data?.role_dist || [], res.stats?.users?.total || 0);
    drawActionsBarChart(res.chart_data?.top_actions || []);
    renderAdminsOverview(res.admins || []);
    renderRecentAuditFeed(res.recent_logs || []);

    if (updateEl) {
      const now = new Date();
      updateEl.textContent = `Updated ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    }

    if (isManualRefresh && typeof showToast === 'function') {
      showToast('Telemetry and audit feed updated.', 'success');
    }

  } catch (err) {
    console.error('[superadmin/dashboard]', err);
    if (typeof showToast === 'function') showToast('Network error while retrieving telemetry.', 'error');
    if (updateEl) updateEl.textContent = 'Connection error';
  }
}

// ── Render Global KPI Pods ─────────────────────────────────────
function renderKPIs(stats) {
  if (!stats) return;

  // 1. Users
  setText('kpiTotalUsers', stats.users?.total ?? 0);
  setText('kpiPassengersCount', stats.users?.passengers ?? 0);
  setText('kpiDriversCount', stats.users?.drivers ?? 0);
  setText('kpiNewUsers7d', `+${stats.users?.new_7d ?? 0}`);

  // 2. Admins
  setText('kpiTotalAdmins', stats.admins?.total ?? 0);
  setText('kpiActiveAdmins', stats.admins?.active ?? 0);
  setText('kpiSuperAdmins', stats.admins?.superadmins ?? 0);
  setText('kpiInactiveAdmins', stats.admins?.inactive ?? 0);

  // 3. Fleet
  setText('kpiTotalVehicles', stats.fleet?.total ?? 0);
  setText('kpiActiveVehicles', stats.fleet?.active ?? 0);
  setText('kpiOnlineDrivers', stats.drivers?.online ?? 0);

  // 4. Trips & GMV
  const rev = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(stats.trips?.revenue || 0);
  setText('kpiRevenue', rev);
  setText('kpiCompletedTrips', stats.trips?.completed ?? 0);
  setText('kpiActiveTrips', stats.trips?.active ?? 0);

  // 5. Audit logs
  setText('kpiTotalLogs', stats.audit?.total_logs ?? 0);
  setText('kpiLogsToday', stats.audit?.logs_today ?? 0);
  setText('kpiDistinctIPs', stats.audit?.distinct_ips ?? 0);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── Render Operators Overview Table ────────────────────────────
function renderAdminsOverview(admins) {
  const tbody = document.getElementById('adminsOverviewTbody');
  if (!tbody) return;

  if (!admins || admins.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No administrators provisioned yet.</td></tr>';
    return;
  }

  tbody.innerHTML = admins.slice(0, 6).map(a => {
    const isSuper = a.role === 'superadmin';
    const roleBadge = isSuper
      ? '<span class="role-badge-super">👑 Superadmin</span>'
      : '<span class="role-badge-admin">🛡️ Admin</span>';

    const statusBadge = a.status === 'active'
      ? '<span class="badge badge-active">Active</span>'
      : '<span class="badge badge-inactive">Inactive</span>';

    const permCount = a.permissions_count || (a.permissions ? a.permissions.length : 0);
    const permBadge = isSuper
      ? '<span style="font-size:0.75rem; font-weight:700; color:#92400E;">Full Root Access</span>'
      : `<span style="font-size:0.75rem; font-weight:700; background:#F3F4F6; padding:0.15rem 0.5rem; border-radius:9999px;">${permCount} capability${permCount === 1 ? '' : 'ies'}</span>`;

    return `
      <tr>
        <td>
          <div style="font-weight:700; color:var(--text-dark);">${escapeHtml(a.name || 'Unnamed')}</div>
          <div style="font-size:0.78rem; color:var(--text-muted);">${escapeHtml(a.email || '')}</div>
        </td>
        <td>${roleBadge}</td>
        <td>${statusBadge}</td>
        <td>${permBadge}</td>
        <td style="text-align:right;">
          <a href="/superadmin/permissions.html" class="action-btn" style="padding:0.25rem 0.65rem; font-size:0.75rem; border-radius:var(--radius-pill); text-decoration:none;">
            Privileges ⚙️
          </a>
        </td>
      </tr>
    `;
  }).join('');
}

// ── Render Recent Audit Feed ───────────────────────────────────
function renderRecentAuditFeed(logs) {
  const container = document.getElementById('recentAuditFeed');
  if (!container) return;

  if (!logs || logs.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-muted); font-size:0.85rem;">No recent audit activity recorded.</div>';
    return;
  }

  container.innerHTML = logs.map(l => {
    const act = (l.action || '').toUpperCase();
    let tagClass = '';
    let icon = '📜';

    if (act.includes('CREATE') || act.includes('ADD') || act.includes('REGISTER') || act.includes('GRANT')) {
      tagClass = 'create';
      icon = '➕';
    } else if (act.includes('DELETE') || act.includes('REVOKE') || act.includes('BLOCK') || act.includes('REJECT')) {
      tagClass = 'security';
      icon = '🛑';
    } else if (act.includes('LOGIN') || act.includes('LOGOUT') || act.includes('AUTH')) {
      tagClass = 'auth';
      icon = '🔑';
    } else if (act.includes('UPDATE') || act.includes('EDIT') || act.includes('APPROVE') || act.includes('ACTIVATE')) {
      tagClass = 'update';
      icon = '⚙️';
    }

    const timeStr = formatRelativeTime(l.created_at);

    return `
      <div class="audit-feed-item">
        <div class="audit-icon">${icon}</div>
        <div class="audit-body">
          <div class="audit-meta-row">
            <span class="audit-action-tag ${tagClass}">${escapeHtml(l.action || 'EVENT')}</span>
            <span class="audit-time">${timeStr}</span>
          </div>
          <div class="audit-desc">${escapeHtml(l.description || 'System event occurred')}</div>
          <div class="audit-ip">Actor: <strong>${escapeHtml(l.user_name || 'System')}</strong> (${escapeHtml(l.user_role || 'system')}) · IP: ${escapeHtml(l.ip_address || '127.0.0.1')}</div>
        </div>
      </div>
    `;
  }).join('');
}

// ── Vanilla Canvas 2D Donut Chart (Role Distribution) ──────────
function drawRoleDonutChart(data, totalCount) {
  const canvas = document.getElementById('roleDonutCanvas');
  const legendEl = document.getElementById('roleChartLegend');
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

  const fallbackData = [
    { label: 'Passengers', count: 0, color: '#3B82F6' },
    { label: 'Drivers', count: 0, color: '#10B981' },
    { label: 'Admins', count: 0, color: '#6366F1' },
    { label: 'Superadmins', count: 0, color: '#F59E0B' }
  ];

  const items = (data && data.length > 0) ? data : fallbackData;
  const sum = items.reduce((acc, it) => acc + (it.count || 0), 0);

  const centerX = w / 2;
  const centerY = h / 2;
  const outerRadius = Math.min(centerX, centerY) - 20;
  const innerRadius = outerRadius * 0.65;

  if (sum === 0) {
    // Empty ring placeholder
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
    ctx.arc(centerX, centerY, innerRadius, Math.PI * 2, 0, true);
    ctx.fillStyle = '#E5E7EB';
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#656D76';
    ctx.font = '600 13px Inter, sans-serif';
    ctx.fillText('No users yet', centerX, centerY);
    return;
  }

  let startAngle = -Math.PI / 2;

  items.forEach(item => {
    const val = item.count || 0;
    if (val === 0) return;
    const sliceAngle = (val / sum) * (Math.PI * 2);

    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius, startAngle, startAngle + sliceAngle);
    ctx.arc(centerX, centerY, innerRadius, startAngle + sliceAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = item.color || '#3B82F6';
    ctx.fill();

    startAngle += sliceAngle;
  });

  // Center Text (Total count)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#111315';
  ctx.font = '900 24px Outfit, sans-serif';
  ctx.fillText(totalCount || sum, centerX, centerY - 8);

  ctx.fillStyle = '#656D76';
  ctx.font = '600 11px Inter, sans-serif';
  ctx.fillText('TOTAL USERS', centerX, centerY + 14);

  // Render HTML Legend
  if (legendEl) {
    legendEl.innerHTML = items.map(item => `
      <div class="legend-item">
        <span class="legend-dot" style="background:${item.color};"></span>
        <span>${escapeHtml(item.label)}: <strong>${item.count || 0}</strong></span>
      </div>
    `).join('');
  }
}

// ── Vanilla Canvas 2D Bar Chart (Top Actions) ──────────────────
function drawActionsBarChart(actions) {
  const canvas = document.getElementById('actionsBarCanvas');
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

  if (!actions || actions.length === 0) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#656D76';
    ctx.font = '600 13px Inter, sans-serif';
    ctx.fillText('No system actions recorded yet', w / 2, h / 2);
    return;
  }

  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 40;
  const chartW = w - paddingLeft - paddingRight;
  const chartH = h - paddingTop - paddingBottom;

  const maxVal = Math.max(...actions.map(a => a.count || 0), 5);
  const barCount = actions.length;
  const barWidth = Math.min(48, (chartW / barCount) * 0.65);
  const gap = (chartW - (barWidth * barCount)) / (barCount + 1);

  // Grid lines (3 horizontal lines)
  ctx.strokeStyle = '#F1F3ED';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i++) {
    const y = paddingTop + (chartH / 3) * i;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(w - paddingRight, y);
    ctx.stroke();

    const val = Math.round(maxVal - (maxVal / 3) * i);
    ctx.fillStyle = '#8C9688';
    ctx.font = '500 10px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(val.toString(), paddingLeft - 8, y);
  }

  // Draw Bars
  actions.forEach((a, i) => {
    const x = paddingLeft + gap + i * (barWidth + gap);
    const barH = (a.count / maxVal) * chartH;
    const y = paddingTop + chartH - barH;

    // Bar rectangle
    ctx.fillStyle = '#111315';
    roundRect(ctx, x, y, barWidth, barH, 6);
    ctx.fill();

    // Value label above bar
    ctx.fillStyle = '#111315';
    ctx.font = '700 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(a.count.toString(), x + barWidth / 2, y - 4);

    // Label below X axis
    ctx.fillStyle = '#656D76';
    ctx.font = '600 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const shortAction = (a.action || '').length > 9
      ? (a.action.slice(0, 8) + '…')
      : a.action;
    ctx.fillText(shortAction, x + barWidth / 2, paddingTop + chartH + 8);
  });
}

function roundRect(ctx, x, y, width, height, radius) {
  if (height <= 0) return;
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x, y);
  ctx.closePath();
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  const now = new Date();
  const diffSec = Math.floor((now - d) / 1000);

  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;

  return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
