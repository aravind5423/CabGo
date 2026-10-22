// public/js/admin/manage-trips.js
// Live trip monitoring, route inspection, search filters, and admin force-completion

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  initTripManagement();
});

function initTripManagement() {
  let tripsList = [];
  let pendingTripId = null;

  const tbody = document.getElementById('tripsTbody');
  const searchInput = document.getElementById('tripSearch');
  const statusSelect = document.getElementById('tripStatusFilter');
  const fromDateInput = document.getElementById('tripFromDate');
  const toDateInput = document.getElementById('tripToDate');
  const resetBtn = document.getElementById('btnResetTripFilters');

  // Complete Trip Modal elements
  const completeModal = document.getElementById('completeTripModal');
  const completeMsg = document.getElementById('modalCompleteMsg');
  const btnCloseComplete = document.getElementById('btnCloseCompleteModal');
  const btnCancelComplete = document.getElementById('btnCancelCompleteModal');
  const btnConfirmComplete = document.getElementById('btnConfirmCompleteTrip');

  // Details Modal elements
  const detailsModal = document.getElementById('tripDetailsModal');
  const detailsContent = document.getElementById('tripDetailsContent');
  const btnCloseDetails = document.getElementById('btnCloseDetailsTripModal');
  const btnCloseDetailsBottom = document.getElementById('btnCloseDetailsTripBtn');

  function openCompleteModal(tripId, fare) {
    pendingTripId = tripId;
    completeMsg.innerHTML = `
      Are you sure you want to manually mark <strong>Trip #${tripId}</strong> as completed?<br><br>
      <div style="background:#F6F7F3; padding:0.85rem; border-radius:8px; font-size:0.88rem;">
        <strong>Recorded Fare:</strong> ₹${parseFloat(fare || 0).toFixed(2)}<br>
        <span style="color:var(--text-muted); font-size:0.8rem;">Status will be updated to completed, payment will be marked settled, and timestamps finalized.</span>
      </div>
    `;
    completeModal.classList.add('active');
  }

  function closeCompleteModal() {
    completeModal.classList.remove('active');
    pendingTripId = null;
  }

  btnCloseComplete?.addEventListener('click', closeCompleteModal);
  btnCancelComplete?.addEventListener('click', closeCompleteModal);
  completeModal?.addEventListener('click', (e) => {
    if (e.target === completeModal) closeCompleteModal();
  });

  btnConfirmComplete?.addEventListener('click', async () => {
    if (!pendingTripId) return;

    btnConfirmComplete.disabled = true;
    btnConfirmComplete.textContent = 'Completing...';

    try {
      const res = await API.put(`/api/admin/trips/${pendingTripId}/complete`);
      if (res.ok && res.success) {
        showToast(res.message || 'Trip successfully marked as completed.', 'success');
        closeCompleteModal();
        loadTrips();
      } else {
        showToast(res.message || 'Failed to complete trip.', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Network error.', 'error');
    } finally {
      btnConfirmComplete.disabled = false;
      btnConfirmComplete.textContent = 'Complete Trip';
    }
  });

  // Details Modal handlers
  function closeDetailsModal() {
    detailsModal.classList.remove('active');
  }
  btnCloseDetails?.addEventListener('click', closeDetailsModal);
  btnCloseDetailsBottom?.addEventListener('click', closeDetailsModal);
  detailsModal?.addEventListener('click', (e) => {
    if (e.target === detailsModal) closeDetailsModal();
  });

  function openDetailsModal(trip) {
    if (!trip) return;

    const startDate = trip.start_time ? new Date(trip.start_time).toLocaleString() : 'Not started';
    const endDate = trip.end_time ? new Date(trip.end_time).toLocaleString() : 'In progress';
    const reqDate = trip.requested_at ? new Date(trip.requested_at).toLocaleString() : '—';
    const fareFormatted = `₹${parseFloat(trip.fare || 0).toFixed(2)}`;

    detailsContent.innerHTML = `
      <div style="background:#F6F7F3; padding:1.2rem; border-radius:12px; margin-bottom:1.25rem;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <h3 style="font-size:1.15rem; font-weight:800; color:var(--text-dark); margin:0;">Trip #${trip.trip_id}</h3>
            <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">Booking Request #${trip.request_id} · Requested: ${reqDate}</div>
          </div>
          <span class="status-pill ${trip.trip_status}">${trip.trip_status.replace('_', ' ')}</span>
        </div>
      </div>

      <!-- Route Card -->
      <div style="background:#FFFFFF; border:1px solid rgba(0,0,0,0.08); border-radius:12px; padding:1.1rem; margin-bottom:1.2rem;">
        <div style="font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); font-weight:700; margin-bottom:0.6rem;">Route Itinerary</div>
        <div style="display:flex; align-items:flex-start; gap:0.6rem; margin-bottom:0.75rem;">
          <span style="font-size:1rem;">🟢</span>
          <div>
            <div style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">PICKUP LOCATION</div>
            <div style="font-weight:700; color:var(--text-dark);">${escapeHtml(trip.pickup_location)}</div>
          </div>
        </div>
        <div style="display:flex; align-items:flex-start; gap:0.6rem;">
          <span style="font-size:1rem;">🔴</span>
          <div>
            <div style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">DESTINATION</div>
            <div style="font-weight:700; color:var(--text-dark);">${escapeHtml(trip.destination)}</div>
          </div>
        </div>
      </div>

      <!-- Rider & Driver Grid -->
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; margin-bottom:1.2rem;">
        <div style="background:#F6F7F3; border-radius:10px; padding:0.95rem;">
          <div style="font-size:0.72rem; text-transform:uppercase; color:var(--text-muted); font-weight:700;">Passenger</div>
          <div style="font-weight:800; color:var(--text-dark); margin-top:3px;">${escapeHtml(trip.passenger_name)}</div>
          <div style="font-size:0.8rem; color:var(--text-muted);">📱 ${escapeHtml(trip.passenger_mobile)}</div>
          <div style="font-size:0.78rem; color:var(--text-muted);">📧 ${escapeHtml(trip.passenger_email)}</div>
        </div>

        <div style="background:#F6F7F3; border-radius:10px; padding:0.95rem;">
          <div style="font-size:0.72rem; text-transform:uppercase; color:var(--text-muted); font-weight:700;">Driver Partner</div>
          <div style="font-weight:800; color:var(--text-dark); margin-top:3px;">${escapeHtml(trip.driver_name)}</div>
          <div style="font-size:0.8rem; color:var(--text-muted);">📱 ${escapeHtml(trip.driver_mobile)}</div>
          <div style="font-size:0.8rem; font-weight:700; margin-top:2px;">
            ${escapeHtml(trip.vehicle_number)} · <span class="badge-vehicle badge-${trip.vehicle_type}">${trip.vehicle_type}</span>
          </div>
        </div>
      </div>

      <!-- Fare & Times Grid -->
      <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:0.75rem; background:#F6F7F3; border-radius:12px; padding:1rem; text-align:center; margin-bottom:1.2rem;">
        <div>
          <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">Trip Fare</div>
          <div style="font-size:1.35rem; font-weight:900; color:#059669;">${fareFormatted}</div>
        </div>
        <div>
          <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">Distance</div>
          <div style="font-size:1.35rem; font-weight:900; color:var(--text-dark);">${trip.distance_km ? `${trip.distance_km} km` : '—'}</div>
        </div>
        <div>
          <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">Payment</div>
          <div style="font-size:1rem; font-weight:800; color:var(--text-dark); margin-top:4px;">
            ${trip.payment ? `${trip.payment.payment_status} (${trip.payment.payment_method})` : 'Pending'}
          </div>
        </div>
      </div>

      <!-- Review if rated -->
      ${trip.rating ? `
        <div style="background:#FFFBEB; border:1px solid #FDE68A; border-radius:10px; padding:0.85rem;">
          <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.25rem;">
            <span style="color:#F59E0B; font-weight:800; font-size:1.1rem;">★ ${trip.rating.rating}/5</span>
            <span style="font-size:0.8rem; color:#92400E; font-weight:700;">Passenger Review</span>
          </div>
          <div style="font-size:0.88rem; color:#78350F; font-style:italic;">"${escapeHtml(trip.rating.comment || 'No comment left.')}"</div>
        </div>
      ` : ''}
    `;

    detailsModal.classList.add('active');
  }

  // Load Trips from API
  async function loadTrips() {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted);">Fetching trip dispatches...</td></tr>';

    try {
      const qs = new URLSearchParams({
        status: statusSelect.value,
        search: searchInput.value.trim(),
        from: fromDateInput.value,
        to: toDateInput.value
      }).toString();

      const res = await API.get(`/api/admin/trips?${qs}`);
      if (!res.ok || !res.success) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color:#DC2626;">${res.message || 'Failed to load trips.'}</td></tr>`;
        return;
      }

      tripsList = res.trips || [];

      // Update KPI Cards
      if (res.summary) {
        document.getElementById('kpiTotalTrips').textContent = res.summary.total || 0;
        document.getElementById('kpiActiveTrips').textContent = (res.summary.in_progress || 0) + (res.summary.accepted || 0);
        document.getElementById('kpiCompletedTrips').textContent = res.summary.completed || 0;

        const revFormatted = new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          maximumFractionDigits: 0
        }).format(res.summary.total_revenue || 0);
        document.getElementById('kpiTotalRevenue').textContent = revFormatted;
      }

      renderTripsTable(tripsList);

    } catch (err) {
      console.error('[manage-trips]', err);
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2rem; color:#DC2626;">Network error. Please try again.</td></tr>';
    }
  }

  function renderTripsTable(trips) {
    if (trips.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2.5rem; color:var(--text-muted);">No trips match the current filter criteria.</td></tr>';
      return;
    }

    tbody.innerHTML = trips.map(t => {
      const statusClass = t.trip_status;
      const statusText = statusClass.replace('_', ' ');

      const statusPill = statusClass === 'in_progress'
        ? `<span class="status-pill ${statusClass}"><span class="pulse-dot"></span>In Progress</span>`
        : `<span class="status-pill ${statusClass}">${statusText}</span>`;

      const fareFormatted = t.fare ? `₹${parseFloat(t.fare).toFixed(2)}` : '—';
      const distFormatted = t.distance_km ? `${parseFloat(t.distance_km).toFixed(1)} km` : '—';

      const paymentBadge = t.payment
        ? `<span style="font-weight:700; font-size:0.78rem; text-transform:uppercase; color:#059669;">✓ ${t.payment.payment_method} (${t.payment.payment_status})</span>`
        : `<span style="font-weight:600; font-size:0.78rem; color:#D97706;">Pending</span>`;

      const dateStr = t.requested_at ? new Date(t.requested_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

      const canForceComplete = ['in_progress', 'accepted'].includes(t.trip_status);

      return `
        <tr id="row-trip-${t.trip_id}">
          <td>
            <div style="font-weight:800; color:var(--text-dark);">#${t.trip_id}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${dateStr}</div>
          </td>
          <td>
            <div style="font-size:0.85rem; font-weight:700; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              🟢 ${escapeHtml(t.pickup_location)}
            </div>
            <div style="font-size:0.82rem; color:var(--text-muted); max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:2px;">
              🔴 ${escapeHtml(t.destination)}
            </div>
          </td>
          <td>
            <div style="font-weight:700;">${escapeHtml(t.passenger_name)}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">📱 ${escapeHtml(t.passenger_mobile)}</div>
          </td>
          <td>
            <div style="font-weight:700;">${escapeHtml(t.driver_name)}</div>
            <div style="display:flex; align-items:center; gap:0.35rem; margin-top:2px;">
              <span class="badge-vehicle badge-${t.vehicle_type}">${t.vehicle_type}</span>
              <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted);">${escapeHtml(t.vehicle_number)}</span>
            </div>
          </td>
          <td>
            <div style="font-weight:800; color:#059669; font-size:0.95rem;">${fareFormatted}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${distFormatted}</div>
          </td>
          <td>
            ${paymentBadge}
          </td>
          <td>
            ${statusPill}
          </td>
          <td style="text-align:right;">
            <div class="action-btn-group" style="justify-content:flex-end;">
              <button class="action-btn" data-action="details" data-id="${t.trip_id}" title="View Trip Details">
                🔍 Details
              </button>
              ${canForceComplete ? `
                <button class="action-btn btn-approve" data-action="complete" data-id="${t.trip_id}" data-fare="${t.fare || 0}" title="Force complete ongoing trip">
                  ⚡ Complete
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-id'), 10);
        const action = btn.getAttribute('data-action');

        if (action === 'details') {
          const trip = tripsList.find(t => t.trip_id === id);
          openDetailsModal(trip);
        } else if (action === 'complete') {
          const fare = btn.getAttribute('data-fare');
          openCompleteModal(id, fare);
        }
      });
    });
  }

  // Filter Event Listeners
  let debounceTimer;
  searchInput?.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(loadTrips, 300);
  });

  statusSelect?.addEventListener('change', loadTrips);
  fromDateInput?.addEventListener('change', loadTrips);
  toDateInput?.addEventListener('change', loadTrips);

  resetBtn?.addEventListener('click', () => {
    searchInput.value = '';
    statusSelect.value = '';
    fromDateInput.value = '';
    toDateInput.value = '';
    loadTrips();
  });

  loadTrips();
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
