// public/js/admin/reports.js
// Business Analytics, Fleet Telemetry, Canvas Visualizations, and CSV Export

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  initReportsModule();
});

function initReportsModule() {
  let currentTab = 'revenue';
  let revenueData = null;
  let tripsData = null;
  let driversData = null;

  // Filter & Control references
  const fromDateInput = document.getElementById('reportFromDate');
  const toDateInput   = document.getElementById('reportToDate');
  const presetPills   = document.querySelectorAll('.preset-pill');
  const tabBtns       = document.querySelectorAll('.tab-btn');
  const btnExportCsv  = document.getElementById('btnExportCsv');
  const btnRefresh    = document.getElementById('btnRefresh');

  // Table search & filter inputs
  const revenueSearchInput = document.getElementById('revenueSearchInput');
  const filterTripStatus   = document.getElementById('filterTripStatus');
  const filterTripVehicle  = document.getElementById('filterTripVehicle');
  const driverSearchInput  = document.getElementById('driverSearchInput');
  const filterDriverStatus = document.getElementById('filterDriverStatus');
  const sortDriverBy       = document.getElementById('sortDriverBy');

  // Initialize date range to default (Last 30 Days)
  applyDatePreset('30');

  // ── Tab Navigation ─────────────────────────────────────────────
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      currentTab = btn.getAttribute('data-tab');

      const targetPanel = document.getElementById(`panel${capitalize(currentTab)}`);
      if (targetPanel) targetPanel.classList.add('active');

      loadActiveTabData();
    });
  });

  // ── Date Presets ───────────────────────────────────────────────
  presetPills.forEach(pill => {
    pill.addEventListener('click', () => {
      presetPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      const days = pill.getAttribute('data-days');
      applyDatePreset(days);
      loadActiveTabData();
    });
  });

  function applyDatePreset(preset) {
    const today = new Date();
    const todayStr = formatDateISO(today);

    if (preset === '7') {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      fromDateInput.value = formatDateISO(past);
      toDateInput.value = todayStr;
    } else if (preset === '30') {
      const past = new Date();
      past.setDate(past.getDate() - 30);
      fromDateInput.value = formatDateISO(past);
      toDateInput.value = todayStr;
    } else if (preset === 'month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      fromDateInput.value = formatDateISO(firstDay);
      toDateInput.value = todayStr;
    } else if (preset === 'all') {
      fromDateInput.value = '';
      toDateInput.value = '';
    }
  }

  function formatDateISO(d) {
    return d.toISOString().split('T')[0];
  }

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  fromDateInput?.addEventListener('change', () => {
    presetPills.forEach(p => p.classList.remove('active'));
    loadActiveTabData();
  });
  toDateInput?.addEventListener('change', () => {
    presetPills.forEach(p => p.classList.remove('active'));
    loadActiveTabData();
  });

  btnRefresh?.addEventListener('click', () => {
    loadActiveTabData();
  });

  // ── Dispatch Data Fetching ────────────────────────────────────
  function loadActiveTabData() {
    if (currentTab === 'revenue') {
      fetchRevenueReport();
    } else if (currentTab === 'trips') {
      fetchTripsReport();
    } else if (currentTab === 'drivers') {
      fetchDriversReport();
    }
  }

  // ==============================================================
  // 1. REVENUE REPORT
  // ==============================================================
  async function fetchRevenueReport() {
    const from = fromDateInput.value;
    const to = toDateInput.value;
    let url = '/api/admin/reports/revenue?';
    if (from) url += `from=${encodeURIComponent(from)}&`;
    if (to) url += `to=${encodeURIComponent(to)}&`;

    try {
      const res = await API.get(url);
      if (!res.ok || !res.success) {
        showToast(res.message || 'Failed to fetch revenue analytics.', 'error');
        return;
      }

      revenueData = res;
      renderRevenueKPIs(res.summary);
      renderRevenueTrendChart(res.daily_trends || []);
      renderVehicleYield(res.vehicle_breakdown || []);
      renderPaymentChannels(res.summary.payment_methods || {});
      renderRevenueTransactionsTable(res.transactions || []);

    } catch (err) {
      console.error('[reports/revenue]', err);
      showToast('Network error while retrieving revenue report.', 'error');
    }
  }

  function renderRevenueKPIs(summary = {}) {
    const total = parseFloat(summary.total_revenue || 0);
    const trips = parseInt(summary.total_completed_trips, 10) || 0;
    const avgFare = parseFloat(summary.avg_fare || 0);
    const dist = parseFloat(summary.total_distance_km || 0);

    const elTotal = document.getElementById('kpiRevenueTotal');
    const elTrips = document.getElementById('kpiRevenueTrips');
    const elAvg   = document.getElementById('kpiRevenueAvgFare');
    const elDist  = document.getElementById('kpiRevenueDistance');

    if (elTotal) elTotal.textContent = `₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (elTrips) elTrips.textContent = trips.toLocaleString('en-IN');
    if (elAvg) elAvg.textContent = `₹${avgFare.toFixed(2)}`;
    if (elDist) elDist.textContent = `${dist.toFixed(1)} km`;
  }

  function renderVehicleYield(breakdown = []) {
    const container = document.getElementById('vehicleYieldContainer');
    if (!container) return;

    if (breakdown.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-muted);">No vehicle yield data for selected timeframe.</div>';
      return;
    }

    const typeIcons = {
      sedan: '🚗',
      suv: '🚙',
      hatchback: '🚘',
      auto: '🛺',
      bike: '🏍️'
    };

    container.innerHTML = breakdown.map(item => {
      const icon = typeIcons[item.vehicle_type.toLowerCase()] || '🚖';
      const pct = Math.min(100, Math.max(0, parseFloat(item.percentage || 0)));
      const rev = parseFloat(item.revenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

      return `
        <div style="margin-bottom: 0.9rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.88rem; font-weight:700;">
            <span style="display:flex; align-items:center; gap:0.4rem; text-transform:capitalize;">
              <span>${icon}</span> ${item.vehicle_type} (${item.trip_count} trips)
            </span>
            <span style="font-family:var(--font-heading); color:var(--text-dark);">
              ₹${rev} <span style="font-size:0.75rem; color:var(--text-muted); font-weight:500;">(${pct}%)</span>
            </span>
          </div>
          <div class="progress-bar-track">
            <div class="progress-bar-fill" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderPaymentChannels(methods = {}) {
    const container = document.getElementById('paymentMethodsContainer');
    if (!container) return;

    const cash = methods.cash || { amount: 0, count: 0 };
    const card = methods.card || { amount: 0, count: 0 };
    const wallet = methods.wallet || { amount: 0, count: 0 };

    const totalAmt = (cash.amount || 0) + (card.amount || 0) + (wallet.amount || 0);

    const calcPct = (amt) => totalAmt > 0 ? ((amt / totalAmt) * 100).toFixed(1) : '0.0';

    container.innerHTML = `
      <div class="stat-row-pod">
        <div class="stat-row-label">
          <span>💵</span> Cash On Delivery
        </div>
        <div class="stat-row-val">
          ₹${parseFloat(cash.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          <span style="font-size:0.75rem; color:var(--text-muted); font-weight:500;">(${cash.count} txns · ${calcPct(cash.amount)}%)</span>
        </div>
      </div>

      <div class="stat-row-pod">
        <div class="stat-row-label">
          <span>💳</span> Credit / Debit Cards
        </div>
        <div class="stat-row-val">
          ₹${parseFloat(card.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          <span style="font-size:0.75rem; color:var(--text-muted); font-weight:500;">(${card.count} txns · ${calcPct(card.amount)}%)</span>
        </div>
      </div>

      <div class="stat-row-pod">
        <div class="stat-row-label">
          <span>👛</span> Digital Wallet / UPI
        </div>
        <div class="stat-row-val">
          ₹${parseFloat(wallet.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          <span style="font-size:0.75rem; color:var(--text-muted); font-weight:500;">(${wallet.count} txns · ${calcPct(wallet.amount)}%)</span>
        </div>
      </div>
    `;
  }

  function renderRevenueTransactionsTable(records = []) {
    const tbody = document.getElementById('revenueTableBody');
    if (!tbody) return;

    const query = (revenueSearchInput?.value || '').toLowerCase().trim();
    const filtered = query ? records.filter(r => 
      (r.passenger_name && r.passenger_name.toLowerCase().includes(query)) ||
      (r.driver_name && r.driver_name.toLowerCase().includes(query)) ||
      (r.vehicle_number && r.vehicle_number.toLowerCase().includes(query)) ||
      (r.trip_id && r.trip_id.toString().includes(query)) ||
      (r.pickup && r.pickup.toLowerCase().includes(query)) ||
      (r.destination && r.destination.toLowerCase().includes(query))
    ) : records;

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:2rem; color:var(--text-muted);">No transactions match your search filter.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(tx => {
      const dateStr = tx.date ? new Date(tx.date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
      const methodBadgeClass = tx.payment_method === 'wallet' ? 'status-pill-active' : (tx.payment_method === 'card' ? 'status-pill-info' : 'status-pill-pending');

      return `
        <tr>
          <td style="font-weight:800; font-family:var(--font-heading);">#${tx.trip_id}</td>
          <td style="font-size:0.85rem; color:var(--text-muted);">${dateStr}</td>
          <td>
            <div style="font-weight:700; color:var(--text-dark);">${escapeHtml(tx.passenger_name || 'Anonymous')}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(tx.passenger_mobile || '')}</div>
          </td>
          <td>
            <div style="font-weight:700; color:var(--text-dark);">${escapeHtml(tx.driver_name || 'Unassigned')}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(tx.driver_email || '')}</div>
          </td>
          <td>
            <div style="font-weight:600; text-transform:capitalize;">${escapeHtml(tx.vehicle_type)}</div>
            <div style="font-size:0.75rem; color:var(--text-muted); font-family:monospace;">${escapeHtml(tx.vehicle_number)}</div>
          </td>
          <td style="font-size:0.83rem; max-width:200px;">
            <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">📍 ${escapeHtml(tx.pickup)}</div>
            <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--text-muted); margin-top:2px;">🏁 ${escapeHtml(tx.destination)}</div>
          </td>
          <td style="font-weight:700;">${parseFloat(tx.distance_km || 0).toFixed(1)} km</td>
          <td style="font-weight:900; font-family:var(--font-heading); color:var(--text-dark); font-size:1.05rem;">
            ₹${parseFloat(tx.amount || 0).toFixed(2)}
          </td>
          <td>
            <span class="status-pill ${methodBadgeClass}" style="text-transform:uppercase; font-size:0.72rem;">
              ${escapeHtml(tx.payment_method)}
            </span>
          </td>
        </tr>
      `;
    }).join('');
  }

  revenueSearchInput?.addEventListener('input', () => {
    if (revenueData && revenueData.transactions) {
      renderRevenueTransactionsTable(revenueData.transactions);
    }
  });

  // ── Vanilla Canvas Chart: Daily Revenue Bar Chart ──────────────
  function renderRevenueTrendChart(trends = []) {
    const canvas = document.getElementById('revenueTrendCanvas');
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

    if (trends.length === 0) {
      ctx.fillStyle = '#656D76';
      ctx.font = '500 14px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No revenue data recorded for this time interval.', w / 2, h / 2);
      return;
    }

    const padding = { top: 25, right: 20, bottom: 45, left: 60 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    const maxVal = Math.max(...trends.map(t => t.revenue), 100);
    const yMax = Math.ceil(maxVal * 1.15 / 100) * 100;

    // Draw horizontal grid lines & Y labels
    const gridSteps = 4;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#656D76';
    ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'right';

    for (let i = 0; i <= gridSteps; i++) {
      const yVal = (yMax / gridSteps) * i;
      const yPos = padding.top + chartH - (i / gridSteps) * chartH;

      ctx.beginPath();
      ctx.moveTo(padding.left, yPos);
      ctx.lineTo(w - padding.right, yPos);
      ctx.stroke();

      ctx.fillText(`₹${Math.round(yVal)}`, padding.left - 10, yPos + 4);
    }

    // Draw bars
    const barWidth = Math.min(42, Math.max(14, (chartW / trends.length) - 10));
    const step = chartW / trends.length;

    trends.forEach((item, index) => {
      const x = padding.left + index * step + (step - barWidth) / 2;
      const barH = (item.revenue / yMax) * chartH;
      const y = padding.top + chartH - barH;

      // Create bar gradient
      const grad = ctx.createLinearGradient(x, y, x, y + barH);
      grad.addColorStop(0, '#D4F038');
      grad.addColorStop(1, '#A8C920');

      ctx.fillStyle = grad;
      ctx.beginPath();
      // Rounded top
      const r = Math.min(6, barWidth / 2);
      ctx.moveTo(x, y + barH);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.lineTo(x + barWidth - r, y);
      ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + r);
      ctx.lineTo(x + barWidth, y + barH);
      ctx.closePath();
      ctx.fill();

      // Top value label
      if (item.revenue > 0) {
        ctx.fillStyle = '#111315';
        ctx.font = '700 10px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`₹${Math.round(item.revenue)}`, x + barWidth / 2, Math.max(padding.top + 10, y - 6));
      }

      // X date label
      ctx.fillStyle = '#656D76';
      ctx.font = '600 10px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      const label = item.date.slice(5); // e.g. "10-23"
      ctx.fillText(label, x + barWidth / 2, padding.top + chartH + 20);
    });
  }


  // ==============================================================
  // 2. TRIPS REPORT
  // ==============================================================
  async function fetchTripsReport() {
    const from = fromDateInput.value;
    const to = toDateInput.value;
    const status = filterTripStatus?.value || 'all';
    const vehicleType = filterTripVehicle?.value || 'all';

    let url = `/api/admin/reports/trips?status=${encodeURIComponent(status)}&vehicle_type=${encodeURIComponent(vehicleType)}&`;
    if (from) url += `from=${encodeURIComponent(from)}&`;
    if (to) url += `to=${encodeURIComponent(to)}&`;

    try {
      const res = await API.get(url);
      if (!res.ok || !res.success) {
        showToast(res.message || 'Failed to fetch trips telemetry.', 'error');
        return;
      }

      tripsData = res;
      renderTripsKPIs(res.summary);
      renderTripsVolumeChart(res.daily_trends || []);
      renderTripsTable(res.trips || []);

    } catch (err) {
      console.error('[reports/trips]', err);
      showToast('Network error while retrieving trips report.', 'error');
    }
  }

  function renderTripsKPIs(summary = {}) {
    const total = parseInt(summary.total_trips, 10) || 0;
    const compRate = parseFloat(summary.completion_rate || 0);
    const cancRate = parseFloat(summary.cancellation_rate || 0);
    const active = parseInt(summary.active_trips, 10) || 0;

    const elTotal = document.getElementById('kpiTripsTotal');
    const elCompRate = document.getElementById('kpiTripsCompletionRate');
    const elCompCount = document.getElementById('kpiTripsCompletedCount');
    const elCancRate = document.getElementById('kpiTripsCancellationRate');
    const elCancCount = document.getElementById('kpiTripsCancelledCount');
    const elActive = document.getElementById('kpiTripsActive');

    if (elTotal) elTotal.textContent = total.toLocaleString('en-IN');
    if (elCompRate) elCompRate.textContent = `${compRate.toFixed(1)}%`;
    if (elCompCount) elCompCount.textContent = `${summary.completed_trips || 0} completed successfully`;
    if (elCancRate) elCancRate.textContent = `${cancRate.toFixed(1)}%`;
    if (elCancCount) elCancCount.textContent = `${summary.cancelled_trips || 0} dropped / cancelled`;
    if (elActive) elActive.textContent = active.toLocaleString('en-IN');
  }

  function renderTripsTable(trips = []) {
    const tbody = document.getElementById('tripsTableBody');
    if (!tbody) return;

    if (trips.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:2rem; color:var(--text-muted);">No trip telemetry records match current filters.</td></tr>';
      return;
    }

    const statusClasses = {
      completed: 'status-pill-active',
      in_progress: 'status-pill-pending',
      accepted: 'status-pill-info',
      cancelled: 'status-pill-inactive'
    };

    tbody.innerHTML = trips.map(t => {
      const statusClass = statusClasses[t.status] || 'status-pill-pending';
      const timeStr = t.start_time ? new Date(t.start_time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';

      return `
        <tr>
          <td style="font-weight:800; font-family:var(--font-heading);">#${t.trip_id}</td>
          <td><span class="status-pill ${statusClass}" style="text-transform:capitalize;">${t.status.replace('_', ' ')}</span></td>
          <td>
            <div style="font-weight:700; text-transform:capitalize;">${escapeHtml(t.vehicle_type)}</div>
            <div style="font-size:0.75rem; color:var(--text-muted); font-family:monospace;">${escapeHtml(t.vehicle_number)}</div>
          </td>
          <td style="font-weight:600;">${escapeHtml(t.passenger_name || 'Passenger')}</td>
          <td style="font-weight:600;">${escapeHtml(t.driver_name || 'Driver')}</td>
          <td style="font-size:0.83rem; max-width:180px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">📍 ${escapeHtml(t.pickup)}</td>
          <td style="font-size:0.83rem; max-width:180px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--text-muted);">🏁 ${escapeHtml(t.destination)}</td>
          <td style="font-weight:700;">${parseFloat(t.distance_km || 0).toFixed(1)} km</td>
          <td style="font-weight:800; font-family:var(--font-heading); font-size:1.05rem;">₹${parseFloat(t.fare || 0).toFixed(2)}</td>
          <td style="font-size:0.82rem; color:var(--text-muted);">${timeStr}</td>
        </tr>
      `;
    }).join('');
  }

  filterTripStatus?.addEventListener('change', fetchTripsReport);
  filterTripVehicle?.addEventListener('change', fetchTripsReport);

  // ── Vanilla Canvas Chart: Trips Volume (Completed vs Cancelled) ─
  function renderTripsVolumeChart(dailyTrends = []) {
    const canvas = document.getElementById('tripsVolumeCanvas');
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

    if (dailyTrends.length === 0) {
      ctx.fillStyle = '#656D76';
      ctx.font = '500 14px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No trip activity logs recorded for this timeframe.', w / 2, h / 2);
      return;
    }

    const padding = { top: 25, right: 20, bottom: 45, left: 45 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    const maxVal = Math.max(...dailyTrends.map(t => Math.max(t.completed, t.cancelled, t.total)), 5);
    const yMax = Math.ceil(maxVal * 1.2);

    const gridSteps = 4;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#656D76';
    ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'right';

    for (let i = 0; i <= gridSteps; i++) {
      const yVal = Math.round((yMax / gridSteps) * i);
      const yPos = padding.top + chartH - (i / gridSteps) * chartH;

      ctx.beginPath();
      ctx.moveTo(padding.left, yPos);
      ctx.lineTo(w - padding.right, yPos);
      ctx.stroke();

      ctx.fillText(`${yVal}`, padding.left - 8, yPos + 4);
    }

    const step = chartW / dailyTrends.length;
    const barWidth = Math.min(24, Math.max(8, (step - 8) / 2));

    dailyTrends.forEach((item, index) => {
      const groupCenter = padding.left + index * step + step / 2;

      // Completed Bar (Green)
      const xComp = groupCenter - barWidth - 2;
      const hComp = (item.completed / yMax) * chartH;
      const yComp = padding.top + chartH - hComp;

      ctx.fillStyle = '#10B981';
      ctx.beginPath();
      ctx.roundRect(xComp, yComp, barWidth, hComp, [4, 4, 0, 0]);
      ctx.fill();

      // Cancelled Bar (Red)
      const xCanc = groupCenter + 2;
      const hCanc = (item.cancelled / yMax) * chartH;
      const yCanc = padding.top + chartH - hCanc;

      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.roundRect(xCanc, yCanc, barWidth, hCanc, [4, 4, 0, 0]);
      ctx.fill();

      // X Label
      ctx.fillStyle = '#656D76';
      ctx.font = '600 10px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(item.date.slice(5), groupCenter, padding.top + chartH + 20);
    });
  }


  // ==============================================================
  // 3. DRIVER PERFORMANCE REPORT
  // ==============================================================
  async function fetchDriversReport() {
    const status = filterDriverStatus?.value || 'all';
    const sort = sortDriverBy?.value || 'revenue';

    const url = `/api/admin/reports/drivers?status=${encodeURIComponent(status)}&sort=${encodeURIComponent(sort)}`;

    try {
      const res = await API.get(url);
      if (!res.ok || !res.success) {
        showToast(res.message || 'Failed to fetch driver performance metrics.', 'error');
        return;
      }

      driversData = res;
      renderDriversKPIs(res.summary);
      renderDriversTable(res.drivers || []);

    } catch (err) {
      console.error('[reports/drivers]', err);
      showToast('Network error while retrieving driver rankings.', 'error');
    }
  }

  function renderDriversKPIs(summary = {}) {
    const total = parseInt(summary.total_drivers, 10) || 0;
    const approved = parseInt(summary.approved_drivers, 10) || 0;
    const online = parseInt(summary.online_drivers, 10) || 0;
    const rating = parseFloat(summary.avg_fleet_rating || 0);

    const elTotal = document.getElementById('kpiDriversTotal');
    const elAppr  = document.getElementById('kpiDriversApproved');
    const elOnl   = document.getElementById('kpiDriversOnline');
    const elRate  = document.getElementById('kpiDriversRating');

    if (elTotal) elTotal.textContent = total.toLocaleString('en-IN');
    if (elAppr) elAppr.textContent = approved.toLocaleString('en-IN');
    if (elOnl) elOnl.textContent = online.toLocaleString('en-IN');
    if (elRate) elRate.textContent = rating.toFixed(2);
  }

  function renderDriversTable(drivers = []) {
    const tbody = document.getElementById('driversTableBody');
    if (!tbody) return;

    const query = (driverSearchInput?.value || '').toLowerCase().trim();
    const filtered = query ? drivers.filter(d =>
      (d.name && d.name.toLowerCase().includes(query)) ||
      (d.email && d.email.toLowerCase().includes(query)) ||
      (d.mobile && d.mobile.toLowerCase().includes(query)) ||
      (d.license_no && d.license_no.toLowerCase().includes(query))
    ) : drivers;

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:2rem; color:var(--text-muted);">No drivers match the criteria.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map((d, index) => {
      const rank = index + 1;
      const rankBadgeClass = rank === 1 ? 'top-1' : (rank === 2 ? 'top-2' : (rank === 3 ? 'top-3' : ''));
      const statusPillClass = d.verification_status === 'approved' ? 'status-pill-active' : (d.verification_status === 'pending' ? 'status-pill-pending' : 'status-pill-inactive');
      const compRate = parseFloat(d.completion_rate || 0);

      return `
        <tr>
          <td><span class="rank-badge ${rankBadgeClass}">${rank}</span></td>
          <td>
            <div style="font-weight:800; color:var(--text-dark);">${escapeHtml(d.name)}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(d.mobile)} · ${escapeHtml(d.email)}</div>
          </td>
          <td>
            <span class="status-pill ${statusPillClass}" style="text-transform:capitalize; margin-bottom:4px;">
              ${d.verification_status}
            </span>
            <div style="font-size:0.75rem; font-family:monospace; color:var(--text-muted);">${escapeHtml(d.license_no)}</div>
          </td>
          <td>
            ${d.vehicle ? `
              <div style="font-weight:700; text-transform:capitalize;">${escapeHtml(d.vehicle.type)} (${escapeHtml(d.vehicle.model || '')})</div>
              <div style="font-size:0.75rem; font-family:monospace; color:var(--text-muted);">${escapeHtml(d.vehicle.number)}</div>
            ` : '<span style="color:var(--text-muted); font-size:0.8rem;">No vehicle active</span>'}
          </td>
          <td style="font-weight:800; font-family:var(--font-heading); color:#10B981;">
            ${d.completed_trips}
          </td>
          <td style="font-weight:700; color:#EF4444;">
            ${d.cancelled_trips}
          </td>
          <td>
            <div style="font-weight:700; font-size:0.88rem;">${compRate.toFixed(1)}%</div>
            <div class="progress-bar-track" style="max-width:100px;">
              <div class="progress-bar-fill" style="width:${compRate}%;"></div>
            </div>
          </td>
          <td style="font-weight:900; font-family:var(--font-heading); color:var(--text-dark); font-size:1.05rem;">
            ₹${parseFloat(d.total_revenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </td>
          <td>
            <div style="display:flex; align-items:center; gap:0.3rem; font-weight:800; color:#F59E0B;">
              ⭐ ${parseFloat(d.rating || 0).toFixed(2)}
            </div>
            <div style="font-size:0.72rem; color:var(--text-muted);">${d.review_count || 0} reviews</div>
          </td>
        </tr>
      `;
    }).join('');
  }

  driverSearchInput?.addEventListener('input', () => {
    if (driversData && driversData.drivers) {
      renderDriversTable(driversData.drivers);
    }
  });

  filterDriverStatus?.addEventListener('change', fetchDriversReport);
  sortDriverBy?.addEventListener('change', fetchDriversReport);


  // ==============================================================
  // 4. CSV EXPORT ENGINE (DOM BLOB DOWNLOAD)
  // ==============================================================
  btnExportCsv?.addEventListener('click', () => {
    exportCurrentReportToCSV();
  });

  function exportCurrentReportToCSV() {
    let csvContent = '';
    let filename = '';

    if (currentTab === 'revenue') {
      if (!revenueData || !revenueData.transactions || revenueData.transactions.length === 0) {
        showToast('No revenue records available to export.', 'warning');
        return;
      }
      filename = `cabgo_revenue_report_${new Date().toISOString().slice(0, 10)}.csv`;
      
      const headers = ['Trip ID', 'Date', 'Passenger Name', 'Passenger Mobile', 'Driver Name', 'Vehicle Type', 'Vehicle Number', 'Pickup Location', 'Destination', 'Distance (km)', 'Settlement Fare (INR)', 'Payment Method', 'Payment Status'];
      const rows = revenueData.transactions.map(t => [
        t.trip_id,
        t.date || '',
        escapeCsv(t.passenger_name),
        escapeCsv(t.passenger_mobile),
        escapeCsv(t.driver_name),
        escapeCsv(t.vehicle_type),
        escapeCsv(t.vehicle_number),
        escapeCsv(t.pickup),
        escapeCsv(t.destination),
        t.distance_km,
        t.amount,
        t.payment_method,
        t.payment_status
      ]);

      csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');

    } else if (currentTab === 'trips') {
      if (!tripsData || !tripsData.trips || tripsData.trips.length === 0) {
        showToast('No trip telemetry records available to export.', 'warning');
        return;
      }
      filename = `cabgo_trips_telemetry_${new Date().toISOString().slice(0, 10)}.csv`;

      const headers = ['Trip ID', 'Status', 'Vehicle Type', 'Vehicle Number', 'Passenger', 'Driver', 'Pickup', 'Destination', 'Distance (km)', 'Fare (INR)', 'Start Time', 'End Time'];
      const rows = tripsData.trips.map(t => [
        t.trip_id,
        t.status,
        escapeCsv(t.vehicle_type),
        escapeCsv(t.vehicle_number),
        escapeCsv(t.passenger_name),
        escapeCsv(t.driver_name),
        escapeCsv(t.pickup),
        escapeCsv(t.destination),
        t.distance_km,
        t.fare,
        t.start_time || '',
        t.end_time || ''
      ]);

      csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');

    } else if (currentTab === 'drivers') {
      if (!driversData || !driversData.drivers || driversData.drivers.length === 0) {
        showToast('No driver performance records available to export.', 'warning');
        return;
      }
      filename = `cabgo_driver_performance_${new Date().toISOString().slice(0, 10)}.csv`;

      const headers = ['Rank', 'Driver Name', 'Email', 'Mobile', 'License No', 'Verification Status', 'Availability', 'Vehicle Number', 'Vehicle Type', 'Completed Trips', 'Cancelled Trips', 'Completion Rate (%)', 'Total Revenue (INR)', 'Rating', 'Review Count'];
      const rows = driversData.drivers.map((d, index) => [
        index + 1,
        escapeCsv(d.name),
        escapeCsv(d.email),
        escapeCsv(d.mobile),
        escapeCsv(d.license_no),
        d.verification_status,
        d.availability,
        escapeCsv(d.vehicle ? d.vehicle.number : ''),
        escapeCsv(d.vehicle ? d.vehicle.type : ''),
        d.completed_trips,
        d.cancelled_trips,
        d.completion_rate,
        d.total_revenue,
        d.rating,
        d.review_count
      ]);

      csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    }

    if (!csvContent) return;

    // Trigger DOM Blob Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Exported ${filename} successfully!`, 'success');
  }

  function escapeCsv(val) {
    if (val === null || val === undefined) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
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

  // Initial load
  loadActiveTabData();
}
