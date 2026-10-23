// public/js/superadmin/permissions.js
// RBAC Capability Matrix, granular privilege toggles, and access governance

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  initPermissionsMatrix();
});

function initPermissionsMatrix() {
  let adminsList = [];
  let selectedAdminId = null;
  let currentPermissions = [];

  const dropdown        = document.getElementById('adminSelectDropdown');
  const targetName      = document.getElementById('targetAdminName');
  const targetSub       = document.getElementById('targetAdminSubtitle');
  const tbody           = document.getElementById('permissionsTableBody');
  const btnGrantAll     = document.getElementById('btnGrantAll');
  const btnRevokeAll    = document.getElementById('btnRevokeAll');

  const PERMISSION_DEFINITIONS = [
    {
      key: 'manage_users',
      name: 'Passenger Governance',
      icon: '👥',
      description: 'Audit passenger profiles, inspect trip histories, and enforce account blocking or unblocking.',
      apis: 'GET /api/admin/passengers, PUT .../block, PUT .../unblock'
    },
    {
      key: 'manage_drivers',
      name: 'Driver Compliance & Onboarding',
      icon: '🚘',
      description: 'Review driving licenses, approve or reject applications, and suspend driver accounts.',
      apis: 'GET /api/admin/drivers, PUT .../approve, PUT .../reject, PUT .../block'
    },
    {
      key: 'manage_vehicles',
      name: 'Fleet Fleet Operations',
      icon: '🚙',
      description: 'Inspect vehicle registration numbers, models, seating capacity, and toggle fleet active status.',
      apis: 'GET /api/admin/vehicles, PUT .../status'
    },
    {
      key: 'manage_trips',
      name: 'Dispatch & Trip Lifecycle',
      icon: '🗺️',
      description: 'Real-time transit tracking, route inspection, fare reconciliation, and operational force-completion.',
      apis: 'GET /api/admin/trips, PUT .../complete'
    },
    {
      key: 'manage_fares',
      name: 'Fare Rules & Service Areas',
      icon: '⚡',
      description: 'Configure vehicle pricing algorithms, base fares, per-km rates, and urban boundary geofences.',
      apis: 'CRUD /api/admin/fare-rules, CRUD /api/admin/service-areas'
    },
    {
      key: 'view_reports',
      name: 'Financial & Telemetry Analytics',
      icon: '📈',
      description: 'View gross revenue reports, payment channel distributions, trip completion rates, and driver performance leagues.',
      apis: 'GET /api/admin/reports/revenue, .../trips, .../drivers'
    },
    {
      key: 'manage_system',
      name: 'System Governance & Logs',
      icon: '⚙️',
      description: 'Audit system logs, inspect operator activities, and manage platform-wide runtime settings.',
      apis: 'GET /api/superadmin/logs, /api/superadmin/settings'
    }
  ];

  // ── Load Admins & Select Target ────────────────────────────────
  async function loadAdminsDropdown() {
    try {
      const res = await API.get('/api/superadmin/admins');
      if (!res.ok || !res.success) {
        showToast(res.message || 'Failed to load administrators.', 'error');
        return;
      }

      adminsList = res.admins || [];

      if (adminsList.length === 0) {
        dropdown.innerHTML = '<option value="">No administrators found</option>';
        return;
      }

      dropdown.innerHTML = adminsList.map(a => `
        <option value="${a.user_id}">
          ${a.role === 'superadmin' ? '👑' : '🛡️'} ${escapeHtml(a.name)} (${escapeHtml(a.email)})
        </option>
      `).join('');

      // Check URL query param ?admin_id=X
      const urlParams = new URLSearchParams(window.location.search);
      const paramId = parseInt(urlParams.get('admin_id'), 10);

      if (paramId && adminsList.some(a => a.user_id === paramId)) {
        dropdown.value = paramId;
      } else {
        dropdown.value = adminsList[0].user_id;
      }

      selectedAdminId = parseInt(dropdown.value, 10);
      await loadAdminPermissions(selectedAdminId);

    } catch (err) {
      console.error('[superadmin/permissions/init]', err);
      showToast('Network error while retrieving administrator accounts.', 'error');
    }
  }

  dropdown?.addEventListener('change', async () => {
    selectedAdminId = parseInt(dropdown.value, 10);
    await loadAdminPermissions(selectedAdminId);
  });

  // ── Fetch Permissions for Target Admin ─────────────────────────
  async function loadAdminPermissions(adminId) {
    if (!adminId) return;

    try {
      const res = await API.get(`/api/superadmin/permissions/${adminId}`);
      if (!res.ok || !res.success) {
        showToast(res.message || 'Failed to fetch admin permissions.', 'error');
        return;
      }

      const admin = res.admin;
      currentPermissions = res.assigned_permissions || [];

      // Update Hero Card
      const isSuper = admin.role === 'superadmin';
      targetName.innerHTML = `${escapeHtml(admin.name)} ${isSuper ? '<span class="role-badge-super" style="margin-left:8px;">👑 Super Admin</span>' : '<span class="role-badge-admin" style="margin-left:8px;">🛡️ Operations Admin</span>'}`;
      targetSub.textContent = `${admin.email} · Account Status: ${admin.role.toUpperCase()} · ${currentPermissions.length} / ${PERMISSION_DEFINITIONS.length} Privileges Granted`;

      renderMatrixTable(isSuper);

    } catch (err) {
      console.error('[superadmin/permissions/load]', err);
      showToast('Network error loading permissions.', 'error');
    }
  }

  // ── Render Permissions Matrix Table ────────────────────────────
  function renderMatrixTable(isSuper = false) {
    if (!tbody) return;

    tbody.innerHTML = PERMISSION_DEFINITIONS.map(def => {
      const isGranted = isSuper || currentPermissions.includes(def.key);
      const statusBadge = isGranted ?
        '<span class="status-pill status-pill-active" style="display:inline-flex; align-items:center; gap:4px;"><span>✅</span> Granted</span>' :
        '<span class="status-pill status-pill-inactive" style="display:inline-flex; align-items:center; gap:4px;"><span>🔒</span> Revoked</span>';

      const actionBtn = isSuper ?
        '<span style="font-size:0.8rem; font-weight:700; color:var(--text-muted);">Root SuperAdmin</span>' :
        (isGranted ?
          `<button class="matrix-toggle-btn btn-granted btn-toggle-perm" data-perm="${def.key}" data-action="revoke">
            🚫 Revoke
          </button>` :
          `<button class="matrix-toggle-btn btn-revoked btn-toggle-perm" data-perm="${def.key}" data-action="grant">
            ➕ Grant
          </button>`);

      return `
        <tr>
          <td>
            <div class="perm-icon-pod">${def.icon}</div>
          </td>
          <td>
            <div style="font-weight:800; color:var(--text-dark);">${escapeHtml(def.name)}</div>
            <div style="font-size:0.75rem; font-family:monospace; color:var(--text-muted);">${def.key}</div>
          </td>
          <td style="font-size:0.85rem; color:var(--text-dark); max-width:280px; line-height:1.4;">
            ${escapeHtml(def.description)}
          </td>
          <td style="font-size:0.75rem; font-family:monospace; color:var(--text-muted); max-width:220px;">
            ${escapeHtml(def.apis)}
          </td>
          <td>${statusBadge}</td>
          <td style="text-align:right;">${actionBtn}</td>
        </tr>
      `;
    }).join('');

    attachToggleEvents();
  }

  function attachToggleEvents() {
    document.querySelectorAll('.btn-toggle-perm').forEach(btn => {
      btn.addEventListener('click', async () => {
        const permKey = btn.getAttribute('data-perm');
        const action = btn.getAttribute('data-action');

        btn.disabled = true;

        if (action === 'grant') {
          await grantPermission(selectedAdminId, permKey);
        } else {
          await revokePermission(selectedAdminId, permKey);
        }
      });
    });
  }

  // ── Grant / Revoke Handlers ────────────────────────────────────
  async function grantPermission(adminId, permKey) {
    try {
      const res = await API.post(`/api/superadmin/permissions/${adminId}`, { permission_name: permKey });
      if (res.ok && res.success) {
        showToast(`Privilege '${permKey}' granted successfully.`, 'success');
        await loadAdminPermissions(adminId);
      } else {
        showToast(res.message || 'Failed to grant permission.', 'error');
      }
    } catch {
      showToast('Error granting permission.', 'error');
    }
  }

  async function revokePermission(adminId, permKey) {
    try {
      const res = await API.delete(`/api/superadmin/permissions/${adminId}?permission_name=${encodeURIComponent(permKey)}`);
      if (res.ok && res.success) {
        showToast(`Privilege '${permKey}' revoked successfully.`, 'info');
        await loadAdminPermissions(adminId);
      } else {
        showToast(res.message || 'Failed to revoke permission.', 'error');
      }
    } catch {
      showToast('Error revoking permission.', 'error');
    }
  }

  // ── Grant All & Revoke All ─────────────────────────────────────
  btnGrantAll?.addEventListener('click', async () => {
    if (!selectedAdminId) return;

    btnGrantAll.disabled = true;
    for (const def of PERMISSION_DEFINITIONS) {
      if (!currentPermissions.includes(def.key)) {
        await API.post(`/api/superadmin/permissions/${selectedAdminId}`, { permission_name: def.key });
      }
    }
    btnGrantAll.disabled = false;
    showToast('All permissions granted to administrator.', 'success');
    await loadAdminPermissions(selectedAdminId);
  });

  btnRevokeAll?.addEventListener('click', async () => {
    if (!selectedAdminId) return;

    btnRevokeAll.disabled = true;
    for (const perm of currentPermissions) {
      await API.delete(`/api/superadmin/permissions/${selectedAdminId}?permission_name=${encodeURIComponent(perm)}`);
    }
    btnRevokeAll.disabled = false;
    showToast('All permissions revoked from administrator.', 'info');
    await loadAdminPermissions(selectedAdminId);
  });

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
  loadAdminsDropdown();
}
