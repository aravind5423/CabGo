// public/js/superadmin/manage-admins.js
// Administration account directory, RBAC provisioning, credential management, and lifecycle controls

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  initManageAdmins();
});

function initManageAdmins() {
  let adminsList = [];
  let pendingDeleteId = null;

  // DOM elements
  const tbody              = document.getElementById('adminsTableBody');
  const searchInput        = document.getElementById('adminSearchInput');
  const filterStatus       = document.getElementById('filterAdminStatus');
  const filterRole         = document.getElementById('filterAdminRole');
  const btnOpenCreateModal = document.getElementById('btnOpenCreateAdminModal');

  // Modal elements
  const adminModal         = document.getElementById('adminModal');
  const modalAdminTitle    = document.getElementById('modalAdminTitle');
  const btnCloseAdminModal = document.getElementById('btnCloseAdminModal');
  const btnCancelAdminModal= document.getElementById('btnCancelAdminModal');
  const adminForm          = document.getElementById('adminForm');
  const adminFormId        = document.getElementById('adminFormId');
  const adminName          = document.getElementById('adminName');
  const adminEmail         = document.getElementById('adminEmail');
  const adminMobile        = document.getElementById('adminMobile');
  const adminPassword      = document.getElementById('adminPassword');
  const passwordHelpText   = document.getElementById('passwordHelpText');
  const modalAdminAlert    = document.getElementById('modalAdminAlert');
  const btnSaveAdmin       = document.getElementById('btnSaveAdmin');

  // Delete modal elements
  const deleteModal        = document.getElementById('deleteModal');
  const deleteModalMsg     = document.getElementById('deleteModalMsg');
  const btnCloseDelete     = document.getElementById('btnCloseDeleteModal');
  const btnCancelDelete    = document.getElementById('btnCancelDelete');
  const btnConfirmDelete   = document.getElementById('btnConfirmDelete');

  // ── Fetch Administrators ───────────────────────────────────────
  async function loadAdmins() {
    try {
      const res = await API.get('/api/superadmin/admins');
      if (!res.ok || !res.success) {
        showToast(res.message || 'Failed to load administrator accounts.', 'error');
        return;
      }

      adminsList = res.admins || [];
      updateKPIs(adminsList);
      renderAdminsTable();

    } catch (err) {
      console.error('[superadmin/admins/fetch]', err);
      showToast('Network error while retrieving administrators.', 'error');
    }
  }

  function updateKPIs(admins) {
    const total = admins.length;
    const active = admins.filter(a => a.status === 'active').length;
    const inactive = total - active;
    const superCount = admins.filter(a => a.role === 'superadmin').length;

    const elTotal = document.getElementById('kpiTotalAdmins');
    const elActive = document.getElementById('kpiActiveAdmins');
    const elInactive = document.getElementById('kpiInactiveAdmins');
    const elSuper = document.getElementById('kpiSuperAdmins');

    if (elTotal) elTotal.textContent = total;
    if (elActive) elActive.textContent = active;
    if (elInactive) elInactive.textContent = inactive;
    if (elSuper) elSuper.textContent = superCount;
  }

  // ── Render Administrators Table ────────────────────────────────
  function renderAdminsTable() {
    if (!tbody) return;

    const query = (searchInput?.value || '').toLowerCase().trim();
    const statusVal = filterStatus?.value || 'all';
    const roleVal = filterRole?.value || 'all';

    const filtered = adminsList.filter(a => {
      const matchQuery = !query ||
        (a.name && a.name.toLowerCase().includes(query)) ||
        (a.email && a.email.toLowerCase().includes(query)) ||
        (a.mobile && a.mobile.includes(query)) ||
        (a.user_id && a.user_id.toString().includes(query));

      const matchStatus = statusVal === 'all' || a.status === statusVal;
      const matchRole   = roleVal === 'all' || a.role === roleVal;

      return matchQuery && matchStatus && matchRole;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">No administrator accounts match the selected filters.</td></tr>';
      return;
    }

    const currentUserId = getCurrentUserId();

    tbody.innerHTML = filtered.map(a => {
      const isSuper = a.role === 'superadmin';
      const roleBadge = isSuper ?
        '<span class="role-badge-super">👑 Super Admin</span>' :
        '<span class="role-badge-admin">🛡️ Operations Admin</span>';

      const statusBadge = a.status === 'active' ?
        '<span class="status-pill status-pill-active">Active</span>' :
        '<span class="status-pill status-pill-inactive">Inactive</span>';

      const dateStr = a.created_at ? new Date(a.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';

      const perms = Array.isArray(a.permissions) ? a.permissions : [];
      const permChips = isSuper ?
        '<span class="perm-chip highlight">⚡ All System Privileges</span>' :
        (perms.length > 0 ?
          perms.map(p => `<span class="perm-chip">${formatPermName(p)}</span>`).join('') :
          '<span style="font-size:0.75rem; color:var(--text-muted);">No specific permissions assigned</span>');

      const isSelf = currentUserId && a.user_id === currentUserId;

      return `
        <tr>
          <td style="font-weight:800; font-family:var(--font-heading);">#${a.user_id}</td>
          <td>
            <div style="font-weight:800; color:var(--text-dark);">${escapeHtml(a.name)} ${isSelf ? '<span style="font-size:0.75rem; color:var(--text-muted);">(You)</span>' : ''}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(a.email)} · ${escapeHtml(a.mobile)}</div>
          </td>
          <td>${roleBadge}</td>
          <td>${statusBadge}</td>
          <td style="max-width:280px;">${permChips}</td>
          <td style="font-size:0.83rem; color:var(--text-muted);">${dateStr}</td>
          <td style="text-align:right;">
            <div style="display:inline-flex; align-items:center; gap:0.4rem;">
              <button class="action-btn btn-edit-admin" data-id="${a.user_id}" title="Edit Profile & Permissions" style="padding:0.35rem 0.65rem; font-size:0.8rem;">
                ✏️ Edit
              </button>
              
              <a href="/superadmin/permissions.html?admin_id=${a.user_id}" class="action-btn" title="Manage RBAC Matrix" style="padding:0.35rem 0.65rem; font-size:0.8rem; text-decoration:none;">
                🔐 RBAC
              </a>

              ${!isSelf ? `
                <button class="action-btn btn-toggle-status" data-id="${a.user_id}" data-status="${a.status}" title="${a.status === 'active' ? 'Deactivate' : 'Activate'}" style="padding:0.35rem 0.65rem; font-size:0.8rem;">
                  ${a.status === 'active' ? '⏸️' : '▶️'}
                </button>

                <button class="action-btn btn-delete-admin" data-id="${a.user_id}" data-name="${escapeHtml(a.name)}" title="Delete Account" style="padding:0.35rem 0.65rem; font-size:0.8rem; color:#EF4444;">
                  🗑️
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    attachTableEvents();
  }

  function formatPermName(perm) {
    const map = {
      manage_users: '👥 Passengers',
      manage_drivers: '🚘 Drivers',
      manage_vehicles: '🚙 Fleet',
      manage_trips: '🗺️ Trips',
      manage_fares: '⚡ Fares',
      view_reports: '📈 Reports',
      manage_system: '⚙️ System'
    };
    return map[perm] || perm;
  }

  function attachTableEvents() {
    // Edit buttons
    document.querySelectorAll('.btn-edit-admin').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-id'), 10);
        openEditAdminModal(id);
      });
    });

    // Toggle status buttons
    document.querySelectorAll('.btn-toggle-status').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.getAttribute('data-id'), 10);
        const current = btn.getAttribute('data-status');
        const endpoint = current === 'active' ? `/api/superadmin/admins/${id}/deactivate` : `/api/superadmin/admins/${id}/activate`;

        btn.disabled = true;
        try {
          const res = await API.put(endpoint);
          if (res.ok && res.success) {
            showToast(`Administrator account ${current === 'active' ? 'deactivated' : 'activated'} successfully.`, 'success');
            await loadAdmins();
          } else {
            showToast(res.message || 'Action failed.', 'error');
            btn.disabled = false;
          }
        } catch {
          showToast('Failed to change administrator status.', 'error');
          btn.disabled = false;
        }
      });
    });

    // Delete buttons
    document.querySelectorAll('.btn-delete-admin').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-id'), 10);
        const name = btn.getAttribute('data-name');
        openDeleteModal(id, name);
      });
    });
  }

  // ── Open Create / Edit Modal ──────────────────────────────────
  function openCreateAdminModal() {
    adminForm.reset();
    adminFormId.value = '';
    modalAdminTitle.textContent = 'Provision New Administrator';
    adminPassword.required = true;
    if (passwordHelpText) passwordHelpText.style.display = 'none';
    hideAlert('modalAdminAlert');
    adminModal.classList.add('active');
  }

  function openEditAdminModal(adminId) {
    const admin = adminsList.find(a => a.user_id === adminId);
    if (!admin) return;

    adminForm.reset();
    adminFormId.value = admin.user_id;
    modalAdminTitle.textContent = `Edit Administrator: ${admin.name}`;
    adminName.value = admin.name || '';
    adminEmail.value = admin.email || '';
    adminMobile.value = admin.mobile || '';

    // Password optional on edit
    adminPassword.value = '';
    adminPassword.required = false;
    if (passwordHelpText) passwordHelpText.style.display = 'block';

    // Set permission checkboxes
    const perms = Array.isArray(admin.permissions) ? admin.permissions : [];
    document.querySelectorAll('input[name="permissions"]').forEach(cb => {
      cb.checked = perms.includes(cb.value);
    });

    hideAlert('modalAdminAlert');
    adminModal.classList.add('active');
  }

  function closeAdminModal() {
    adminModal.classList.remove('active');
    adminForm.reset();
    adminFormId.value = '';
  }

  btnOpenCreateModal?.addEventListener('click', openCreateAdminModal);
  btnCloseAdminModal?.addEventListener('click', closeAdminModal);
  btnCancelAdminModal?.addEventListener('click', closeAdminModal);
  adminModal?.addEventListener('click', (e) => {
    if (e.target === adminModal) closeAdminModal();
  });

  // ── Save Admin Submission ─────────────────────────────────────
  adminForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = adminFormId.value;
    const isEdit = Boolean(id);

    const name = adminName.value.trim();
    const email = adminEmail.value.trim();
    const mobile = adminMobile.value.trim();
    const password = adminPassword.value;

    const checkedPerms = Array.from(document.querySelectorAll('input[name="permissions"]:checked')).map(cb => cb.value);

    if (!name || !email || !mobile) {
      showAlert('modalAdminAlert', 'Please complete all required fields.', 'error');
      return;
    }

    if (!isEdit && (!password || password.length < 6)) {
      showAlert('modalAdminAlert', 'Password must be at least 6 characters.', 'error');
      return;
    }

    setButtonLoading(btnSaveAdmin, true, 'Save Administrator');
    hideAlert('modalAdminAlert');

    try {
      let res;
      if (isEdit) {
        const payload = { name, email, mobile, permissions: checkedPerms };
        res = await API.put(`/api/superadmin/admins/${id}`, payload);
      } else {
        const payload = { name, email, mobile, password, permissions: checkedPerms };
        res = await API.post('/api/superadmin/admins', payload);
      }

      setButtonLoading(btnSaveAdmin, false, 'Save Administrator');

      if (res.ok && res.success) {
        showToast(res.message || `Administrator ${isEdit ? 'updated' : 'provisioned'} successfully.`, 'success');
        closeAdminModal();
        await loadAdmins();
      } else {
        showAlert('modalAdminAlert', res.message || 'Operation failed.', 'error');
      }

    } catch (err) {
      setButtonLoading(btnSaveAdmin, false, 'Save Administrator');
      showAlert('modalAdminAlert', 'Network communication error.', 'error');
    }
  });

  // ── Delete Confirmation Modal ─────────────────────────────────
  function openDeleteModal(adminId, name) {
    pendingDeleteId = adminId;
    deleteModalMsg.innerHTML = `Are you sure you want to permanently delete administrator account <strong>${escapeHtml(name)}</strong> (ID #${adminId})?<br><br><span style="color:#EF4444; font-size:0.85rem;">This action cannot be undone and will revoke all access.</span>`;
    deleteModal.classList.add('active');
  }

  function closeDeleteModal() {
    deleteModal.classList.remove('active');
    pendingDeleteId = null;
  }

  btnCloseDelete?.addEventListener('click', closeDeleteModal);
  btnCancelDelete?.addEventListener('click', closeDeleteModal);
  deleteModal?.addEventListener('click', (e) => {
    if (e.target === deleteModal) closeDeleteModal();
  });

  btnConfirmDelete?.addEventListener('click', async () => {
    if (!pendingDeleteId) return;

    btnConfirmDelete.disabled = true;
    try {
      const res = await API.delete(`/api/superadmin/admins/${pendingDeleteId}`);
      if (res.ok && res.success) {
        showToast('Administrator account deleted successfully.', 'success');
        closeDeleteModal();
        await loadAdmins();
      } else {
        showToast(res.message || 'Failed to delete administrator.', 'error');
      }
    } catch {
      showToast('Error during account deletion.', 'error');
    } finally {
      btnConfirmDelete.disabled = false;
    }
  });

  // ── Filters & Search Handlers ─────────────────────────────────
  searchInput?.addEventListener('input', renderAdminsTable);
  filterStatus?.addEventListener('change', renderAdminsTable);
  filterRole?.addEventListener('change', renderAdminsTable);

  function getCurrentUserId() {
    try {
      const token = sessionStorage.getItem('cab_token');
      if (!token) return null;
      const parts = token.split('.');
      if (parts.length < 2) return null;
      const payload = JSON.parse(atob(parts[1]));
      return payload.user_id || null;
    } catch {
      return null;
    }
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
  loadAdmins();
}
