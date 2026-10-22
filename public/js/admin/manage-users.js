// public/js/admin/manage-users.js
// Handles passenger & driver directories, search, pagination, approval workflows, and status moderation

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('passengersTable')) {
    initPassengerManagement();
  }
  if (document.getElementById('driversTable')) {
    initDriverManagement();
  }
});

// ================================================================
// PASSENGER MANAGEMENT LOGIC
// ================================================================

function initPassengerManagement() {
  let state = {
    page: 1,
    limit: 10,
    search: '',
    status: '',
    totalPages: 1
  };

  let pendingAction = {
    id: null,
    name: '',
    action: '' // 'block' | 'unblock'
  };

  const tbody = document.getElementById('passengersTbody');
  const searchInput = document.getElementById('passengerSearch');
  const statusSelect = document.getElementById('statusFilter');
  const limitSelect = document.getElementById('limitFilter');
  const resetBtn = document.getElementById('btnResetFilters');

  // Modal elements
  const modal = document.getElementById('passengerActionModal');
  const modalTitle = document.getElementById('modalPassengerTitle');
  const modalMsg = document.getElementById('modalPassengerMsg');
  const btnClose = document.getElementById('btnCloseModal');
  const btnCancel = document.getElementById('btnCancelModal');
  const btnConfirm = document.getElementById('btnConfirmPassengerAction');

  function openModal(id, name, action) {
    pendingAction = { id, name, action };
    modalTitle.textContent = action === 'block' ? '🚫 Suspend Passenger' : '✅ Restore Passenger Account';
    modalMsg.innerHTML = action === 'block'
      ? `Are you sure you want to block <strong>${escapeHtml(name)}</strong>?<br><span style="font-size:0.85rem; color:var(--text-muted);">They will be immediately logged out and prevented from booking rides.</span>`
      : `Are you sure you want to unblock <strong>${escapeHtml(name)}</strong>?<br><span style="font-size:0.85rem; color:var(--text-muted);">Their account will be restored to active status immediately.</span>`;

    btnConfirm.className = action === 'block' ? 'btn-danger' : 'btn-accent';
    btnConfirm.textContent = action === 'block' ? 'Confirm Block' : 'Confirm Restore';
    modal.classList.add('active');
  }

  function closeModal() {
    modal.classList.remove('active');
    pendingAction = { id: null, name: '', action: '' };
  }

  btnClose?.addEventListener('click', closeModal);
  btnCancel?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  btnConfirm?.addEventListener('click', async () => {
    if (!pendingAction.id || !pendingAction.action) return;

    btnConfirm.disabled = true;
    btnConfirm.textContent = 'Processing...';

    try {
      const res = await API.put(`/api/admin/passengers/${pendingAction.id}/${pendingAction.action}`);
      if (res.ok && res.success) {
        showToast(res.message || 'Passenger status updated.', 'success');
        closeModal();
        loadPassengers();
      } else {
        showToast(res.message || 'Operation failed.', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Network error.', 'error');
    } finally {
      btnConfirm.disabled = false;
    }
  });

  // Load Passengers from API
  async function loadPassengers() {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted);">Fetching passenger records...</td></tr>';

    try {
      const qs = new URLSearchParams({
        page: state.page,
        limit: state.limit,
        search: state.search,
        status: state.status
      }).toString();

      const res = await API.get(`/api/admin/passengers?${qs}`);
      if (!res.ok || !res.success) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color:#DC2626;">${res.message || 'Failed to load passengers.'}</td></tr>`;
        return;
      }

      // Update KPIs
      if (res.summary) {
        document.getElementById('kpiTotalPassengers').textContent = res.summary.total || 0;
        document.getElementById('kpiActivePassengers').textContent = res.summary.active || 0;
        document.getElementById('kpiBlockedPassengers').textContent = res.summary.blocked || 0;
      }

      state.totalPages = res.pagination?.totalPages || 1;
      renderTable(res.passengers || []);
      renderPagination(res.pagination);

    } catch (err) {
      console.error('[manage-passengers]', err);
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2rem; color:#DC2626;">Network error. Please try again.</td></tr>';
    }
  }

  function renderTable(passengers) {
    if (passengers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2.5rem; color:var(--text-muted);">No passengers found matching your criteria.</td></tr>';
      return;
    }

    tbody.innerHTML = passengers.map(p => {
      const statusClass = p.status === 'active' ? 'active' : 'blocked';
      const joinedDate = p.created_at ? new Date(p.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
      const spentFormatted = `₹${parseFloat(p.total_spent || 0).toFixed(2)}`;

      const actionBtn = p.status === 'blocked'
        ? `<button class="action-btn btn-unblock" data-action="unblock" data-id="${p.passenger_id}" data-name="${escapeHtml(p.name)}">🔓 Restore</button>`
        : `<button class="action-btn btn-block" data-action="block" data-id="${p.passenger_id}" data-name="${escapeHtml(p.name)}">🚫 Block</button>`;

      return `
        <tr id="row-passenger-${p.passenger_id}">
          <td>
            <div style="font-weight:700; color:var(--text-dark);">${escapeHtml(p.name)}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">ID: #${p.passenger_id} (UID: #${p.user_id})</div>
          </td>
          <td>
            <div style="font-weight:600;">📧 ${escapeHtml(p.email)}</div>
            <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">📱 ${escapeHtml(p.mobile)}</div>
          </td>
          <td style="max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(p.default_address)}">
            ${p.default_address ? escapeHtml(p.default_address) : '<span style="color:var(--text-subtle);">None set</span>'}
          </td>
          <td style="font-weight:700;">
            ${p.total_trips} rides
          </td>
          <td style="font-weight:800; color:#059669;">
            ${spentFormatted}
          </td>
          <td>
            <span class="status-pill ${statusClass}">${p.status}</span>
          </td>
          <td style="font-size:0.8rem; color:var(--text-muted);">
            ${joinedDate}
          </td>
          <td style="text-align:right;">
            <div class="action-btn-group" style="justify-content:flex-end;">
              ${actionBtn}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach row button events
    tbody.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-id');
        const name = btn.getAttribute('data-name');
        const action = btn.getAttribute('data-action');
        openModal(id, name, action);
      });
    });
  }

  function renderPagination(pagination) {
    const info = document.getElementById('paginationInfo');
    const controls = document.getElementById('paginationControls');
    if (!pagination) return;

    const { page, limit, total, totalPages } = pagination;
    const start = total === 0 ? 0 : (page - 1) * limit + 1;
    const end = Math.min(page * limit, total);

    info.textContent = `Showing ${start}–${end} of ${total} passengers`;

    let html = `
      <button class="page-btn" ${page <= 1 ? 'disabled' : ''} data-page="${page - 1}">‹</button>
    `;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
        html += `<button class="page-btn ${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
      } else if (i === page - 2 || i === page + 2) {
        html += `<span style="padding:0 0.2rem; color:var(--text-muted);">…</span>`;
      }
    }

    html += `
      <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} data-page="${page + 1}">›</button>
    `;

    controls.innerHTML = html;

    controls.querySelectorAll('button[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetPage = parseInt(btn.getAttribute('data-page'), 10);
        if (targetPage && targetPage !== state.page) {
          state.page = targetPage;
          loadPassengers();
        }
      });
    });
  }

  // Filter events
  let debounceTimer;
  searchInput?.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      state.search = e.target.value.trim();
      state.page = 1;
      loadPassengers();
    }, 300);
  });

  statusSelect?.addEventListener('change', (e) => {
    state.status = e.target.value;
    state.page = 1;
    loadPassengers();
  });

  limitSelect?.addEventListener('change', (e) => {
    state.limit = parseInt(e.target.value, 10) || 10;
    state.page = 1;
    loadPassengers();
  });

  resetBtn?.addEventListener('click', () => {
    state.search = '';
    state.status = '';
    state.limit = 10;
    state.page = 1;
    if (searchInput) searchInput.value = '';
    if (statusSelect) statusSelect.value = '';
    if (limitSelect) limitSelect.value = '10';
    loadPassengers();
  });

  // Initial load
  loadPassengers();
}


// ================================================================
// DRIVER MANAGEMENT LOGIC
// ================================================================

function initDriverManagement() {
  let state = {
    tab: 'all', // 'all' | 'pending' | 'approved' | 'rejected' | 'blocked'
    search: '',
    availability: '',
    driversList: []
  };

  let pendingAction = {
    id: null,
    name: '',
    action: '' // 'approve' | 'reject' | 'block' | 'unblock'
  };

  const tbody = document.getElementById('driversTbody');
  const searchInput = document.getElementById('driverSearch');
  const availSelect = document.getElementById('driverAvailabilityFilter');
  const resetBtn = document.getElementById('btnResetDriverFilters');
  const tabButtons = document.querySelectorAll('.tab-bar .tab-btn');

  // Confirmation Modal elements
  const modal = document.getElementById('driverActionModal');
  const modalTitle = document.getElementById('modalDriverTitle');
  const modalMsg = document.getElementById('modalDriverMsg');
  const btnClose = document.getElementById('btnCloseDriverModal');
  const btnCancel = document.getElementById('btnCancelDriverModal');
  const btnConfirm = document.getElementById('btnConfirmDriverAction');

  // Details Modal elements
  const detailsModal = document.getElementById('driverDetailsModal');
  const detailsContent = document.getElementById('driverDetailsContent');
  const btnCloseDetails = document.getElementById('btnCloseDetailsModal');
  const btnCloseDetailsBottom = document.getElementById('btnCloseDetailsBtn');

  // Check URL params for active tab (e.g. ?tab=pending)
  const urlParams = new URLSearchParams(window.location.search);
  const requestedTab = urlParams.get('tab');
  if (requestedTab && ['all', 'pending', 'approved', 'rejected', 'blocked'].includes(requestedTab)) {
    state.tab = requestedTab;
    tabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === requestedTab);
    });
  }

  function openActionModal(id, name, action) {
    pendingAction = { id, name, action };

    const configs = {
      approve: {
        title: '✅ Approve Driver Partner',
        msg: `Approve documents and grant operational clearance to <strong>${escapeHtml(name)}</strong>?<br><span style="font-size:0.85rem; color:var(--text-muted);">They will be authorized to go online and receive ride dispatches.</span>`,
        btnClass: 'btn-accent',
        btnText: 'Confirm Approval'
      },
      reject: {
        title: '❌ Reject Driver Application',
        msg: `Reject onboarding credentials for <strong>${escapeHtml(name)}</strong>?<br><span style="font-size:0.85rem; color:var(--text-muted);">Their verification status will be marked as rejected.</span>`,
        btnClass: 'btn-danger',
        btnText: 'Confirm Rejection'
      },
      block: {
        title: '🚫 Suspend Driver Account',
        msg: `Suspend driver account for <strong>${escapeHtml(name)}</strong>?<br><span style="font-size:0.85rem; color:var(--text-muted);">The driver will be force-logged out and blocked from the dispatch network.</span>`,
        btnClass: 'btn-danger',
        btnText: 'Confirm Suspension'
      },
      unblock: {
        title: '🔓 Restore Driver Account',
        msg: `Restore account access for <strong>${escapeHtml(name)}</strong>?<br><span style="font-size:0.85rem; color:var(--text-muted);">The driver will regain access to their dashboard.</span>`,
        btnClass: 'btn-accent',
        btnText: 'Confirm Restore'
      }
    };

    const cfg = configs[action] || { title: 'Confirm', msg: 'Are you sure?', btnClass: 'btn-primary', btnText: 'Confirm' };
    modalTitle.textContent = cfg.title;
    modalMsg.innerHTML = cfg.msg;
    btnConfirm.className = cfg.btnClass;
    btnConfirm.textContent = cfg.btnText;
    modal.classList.add('active');
  }

  function closeActionModal() {
    modal.classList.remove('active');
    pendingAction = { id: null, name: '', action: '' };
  }

  btnClose?.addEventListener('click', closeActionModal);
  btnCancel?.addEventListener('click', closeActionModal);
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeActionModal();
  });

  btnConfirm?.addEventListener('click', async () => {
    if (!pendingAction.id || !pendingAction.action) return;

    btnConfirm.disabled = true;
    btnConfirm.textContent = 'Processing...';

    try {
      const res = await API.put(`/api/admin/drivers/${pendingAction.id}/${pendingAction.action}`);
      if (res.ok && res.success) {
        showToast(res.message || 'Driver status updated.', 'success');
        closeActionModal();
        loadDrivers();
      } else {
        showToast(res.message || 'Operation failed.', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Network error.', 'error');
    } finally {
      btnConfirm.disabled = false;
    }
  });

  // Details Modal close handlers
  function closeDetailsModal() {
    detailsModal.classList.remove('active');
  }
  btnCloseDetails?.addEventListener('click', closeDetailsModal);
  btnCloseDetailsBottom?.addEventListener('click', closeDetailsModal);
  detailsModal?.addEventListener('click', (e) => {
    if (e.target === detailsModal) closeDetailsModal();
  });

  function openDetailsModal(driver) {
    if (!driver) return;

    detailsContent.innerHTML = `
      <div style="background:#F6F7F3; padding:1.2rem; border-radius:12px; margin-bottom:1.25rem;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <h3 style="font-size:1.15rem; font-weight:800; color:var(--text-dark); margin:0;">${escapeHtml(driver.name)}</h3>
            <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">Driver ID #${driver.driver_id} · User #${driver.user_id}</div>
          </div>
          <span class="status-pill ${driver.verification_status}">${driver.verification_status}</span>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; margin-bottom:1.25rem;">
        <div>
          <div style="font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); font-weight:700;">License Number</div>
          <div style="font-weight:700; font-size:0.95rem; font-family:monospace; margin-top:2px;">${escapeHtml(driver.license_no)}</div>
        </div>
        <div>
          <div style="font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); font-weight:700;">License Expiry</div>
          <div style="font-weight:700; font-size:0.95rem; margin-top:2px;">${driver.license_expiry ? driver.license_expiry.split('T')[0] : '—'}</div>
        </div>
        <div>
          <div style="font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); font-weight:700;">Mobile Phone</div>
          <div style="font-weight:600; font-size:0.95rem; margin-top:2px;">📱 ${escapeHtml(driver.mobile)}</div>
        </div>
        <div>
          <div style="font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); font-weight:700;">Email Address</div>
          <div style="font-weight:600; font-size:0.95rem; margin-top:2px;">📧 ${escapeHtml(driver.email)}</div>
        </div>
      </div>

      <div style="border-top:1px solid rgba(0,0,0,0.06); padding-top:1rem; margin-bottom:1rem;">
        <div style="font-size:0.8rem; text-transform:uppercase; color:var(--text-muted); font-weight:700; margin-bottom:0.5rem;">Assigned Active Vehicle</div>
        ${driver.vehicle ? `
          <div style="background:#FFFFFF; border:1px solid rgba(0,0,0,0.08); border-radius:10px; padding:0.85rem; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-weight:800; color:var(--text-dark);">${escapeHtml(driver.vehicle.vehicle_number)}</div>
              <div style="font-size:0.8rem; color:var(--text-muted);">${escapeHtml(driver.vehicle.model)}</div>
            </div>
            <span class="badge-vehicle badge-${driver.vehicle.vehicle_type}">${driver.vehicle.vehicle_type}</span>
          </div>
        ` : '<div style="color:var(--text-muted); font-size:0.85rem;">No active vehicle currently assigned to this driver.</div>'}
      </div>

      <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:0.75rem; background:#F6F7F3; border-radius:12px; padding:1rem; text-align:center;">
        <div>
          <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">Completed Trips</div>
          <div style="font-size:1.25rem; font-weight:900; color:var(--text-dark);">${driver.completed_trips || 0}</div>
        </div>
        <div>
          <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">Rating</div>
          <div style="font-size:1.25rem; font-weight:900; color:#F59E0B;">⭐ ${parseFloat(driver.rating || 0).toFixed(2)}</div>
        </div>
        <div>
          <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">Total Earnings</div>
          <div style="font-size:1.25rem; font-weight:900; color:#059669;">₹${parseFloat(driver.total_earnings || 0).toFixed(0)}</div>
        </div>
      </div>
    `;

    detailsModal.classList.add('active');
  }

  // Load Drivers
  async function loadDrivers() {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--text-muted);">Fetching driver partners...</td></tr>';

    try {
      const qs = new URLSearchParams({
        search: state.search,
        status: state.tab === 'all' ? '' : state.tab,
        availability: state.availability
      }).toString();

      const res = await API.get(`/api/admin/drivers?${qs}`);
      if (!res.ok || !res.success) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color:#DC2626;">${res.message || 'Failed to load drivers.'}</td></tr>`;
        return;
      }

      state.driversList = res.drivers || [];

      // Update KPI Pods
      if (res.summary) {
        document.getElementById('kpiTotalDrivers').textContent = res.summary.total || 0;
        document.getElementById('kpiPendingDrivers').textContent = res.summary.pending || 0;
        document.getElementById('kpiApprovedDrivers').textContent = res.summary.approved || 0;
        document.getElementById('kpiOnlineDrivers').textContent = res.summary.online || 0;

        const badge = document.getElementById('tabPendingBadge');
        if (badge) {
          if (res.summary.pending > 0) {
            badge.textContent = res.summary.pending;
            badge.style.display = 'inline-block';
          } else {
            badge.style.display = 'none';
          }
        }
      }

      renderDriversTable(state.driversList);

    } catch (err) {
      console.error('[manage-drivers]', err);
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2rem; color:#DC2626;">Network error. Please try again.</td></tr>';
    }
  }

  function renderDriversTable(drivers) {
    if (drivers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2.5rem; color:var(--text-muted);">No drivers found for this view.</td></tr>';
      return;
    }

    tbody.innerHTML = drivers.map(d => {
      const verifPill = `<span class="status-pill ${d.verification_status}">${d.verification_status}</span>`;
      const availPill = `<span class="status-pill ${d.availability}">${d.availability}</span>`;
      const accPill = `<span class="status-pill ${d.account_status === 'blocked' ? 'blocked' : 'active'}">${d.account_status}</span>`;

      // Vehicle representation
      const vehicleHtml = d.vehicle ? `
        <div>
          <span class="badge-vehicle badge-${d.vehicle.vehicle_type}">${d.vehicle.vehicle_type}</span>
          <div style="font-weight:700; font-size:0.85rem; margin-top:2px;">${escapeHtml(d.vehicle.vehicle_number)}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(d.vehicle.model)}</div>
        </div>
      ` : '<span style="color:var(--text-subtle); font-size:0.82rem;">No vehicle</span>';

      // Star rating
      const stars = '★'.repeat(Math.round(d.rating || 0)) + '☆'.repeat(5 - Math.round(d.rating || 0));

      // Action buttons based on status
      let actionButtons = `
        <button class="action-btn" data-action="details" data-id="${d.driver_id}" title="View Driver Details">🔍 Details</button>
      `;

      if (d.verification_status === 'pending') {
        actionButtons += `
          <button class="action-btn btn-approve" data-action="approve" data-id="${d.driver_id}" data-name="${escapeHtml(d.name)}" title="Approve Credentials">✅ Approve</button>
          <button class="action-btn btn-reject" data-action="reject" data-id="${d.driver_id}" data-name="${escapeHtml(d.name)}" title="Reject Application">❌ Reject</button>
        `;
      } else {
        if (d.account_status === 'blocked') {
          actionButtons += `
            <button class="action-btn btn-unblock" data-action="unblock" data-id="${d.driver_id}" data-name="${escapeHtml(d.name)}" title="Restore Account">🔓 Unblock</button>
          `;
        } else {
          actionButtons += `
            <button class="action-btn btn-block" data-action="block" data-id="${d.driver_id}" data-name="${escapeHtml(d.name)}" title="Suspend Driver">🚫 Block</button>
          `;
        }
      }

      return `
        <tr id="row-driver-${d.driver_id}">
          <td>
            <div style="font-weight:700; color:var(--text-dark);">${escapeHtml(d.name)}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">📧 ${escapeHtml(d.email)}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">📱 ${escapeHtml(d.mobile)}</div>
          </td>
          <td>
            <div style="font-weight:700; font-family:monospace; font-size:0.88rem;">${escapeHtml(d.license_no)}</div>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Exp: ${d.license_expiry ? d.license_expiry.split('T')[0] : '—'}</div>
          </td>
          <td>
            ${vehicleHtml}
          </td>
          <td>
            <div style="font-weight:800; color:var(--text-dark); display:flex; align-items:center; gap:0.25rem;">
              <span class="rating-stars">${stars}</span>
              <span>${parseFloat(d.rating || 0).toFixed(1)}</span>
            </div>
            <div style="font-size:0.78rem; color:var(--text-muted); margin-top:2px;">${d.completed_trips || 0} completed rides</div>
          </td>
          <td>${verifPill}</td>
          <td>${availPill}</td>
          <td>${accPill}</td>
          <td style="text-align:right;">
            <div class="action-btn-group" style="justify-content:flex-end;">
              ${actionButtons}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach actions
    tbody.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-id'), 10);
        const name = btn.getAttribute('data-name');
        const action = btn.getAttribute('data-action');

        if (action === 'details') {
          const driver = state.driversList.find(d => d.driver_id === id);
          openDetailsModal(driver);
        } else {
          openActionModal(id, name, action);
        }
      });
    });
  }

  // Tab switching
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.tab = btn.getAttribute('data-tab');
      loadDrivers();
    });
  });

  // Filter handlers
  let debounceTimer;
  searchInput?.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      state.search = e.target.value.trim();
      loadDrivers();
    }, 300);
  });

  availSelect?.addEventListener('change', (e) => {
    state.availability = e.target.value;
    loadDrivers();
  });

  resetBtn?.addEventListener('click', () => {
    state.search = '';
    state.availability = '';
    state.tab = 'all';
    if (searchInput) searchInput.value = '';
    if (availSelect) availSelect.value = '';
    tabButtons.forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === 'all'));
    loadDrivers();
  });

  loadDrivers();
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
