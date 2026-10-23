// public/js/superadmin/system-logs.js
// Operational audit trail, filtering, pagination, CSV export, and log payload inspection

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  initSystemLogs();
});

function initSystemLogs() {
  let currentPage = 1;
  let currentLimit = 50;
  let logsList = [];
  let currentSummary = null;
  let currentPagination = null;

  // DOM Elements
  const tbody             = document.getElementById('logsTableBody');
  const inputUser         = document.getElementById('inputLogUser');
  const inputAction       = document.getElementById('inputLogAction');
  const inputFrom         = document.getElementById('inputLogFrom');
  const inputTo           = document.getElementById('inputLogTo');
  const selectLimit       = document.getElementById('selectLogLimit');
  const btnApply          = document.getElementById('btnApplyFilters');
  const btnReset          = document.getElementById('btnResetFilters');
  const btnRefresh        = document.getElementById('btnRefreshLogs');
  const btnExport         = document.getElementById('btnExportCsv');
  const presetPills       = document.querySelectorAll('.preset-pill');
  const chipsContainer    = document.getElementById('quickActionChipsContainer');
  const paginationInfo    = document.getElementById('paginationInfo');
  const paginationControls= document.getElementById('paginationControls');

  // Modal Elements
  const logModal          = document.getElementById('logModal');
  const btnCloseModal     = document.getElementById('btnCloseLogModal');
  const btnDismissModal   = document.getElementById('btnDismissLogModal');
  const logDetailContent  = document.getElementById('logDetailContent');

  // ── Fetch System Logs ──────────────────────────────────────────
  async function loadLogs(page = 1) {
    currentPage = page;
    currentLimit = parseInt(selectLimit?.value, 10) || 50;

    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:3rem; color:var(--text-muted);">Loading system operational logs…</td></tr>';
    }

    const params = new URLSearchParams({
      page: currentPage,
      limit: currentLimit
    });

    const userVal = inputUser?.value.trim();
    const actionVal = inputAction?.value.trim();
    const fromVal = inputFrom?.value;
    const toVal = inputTo?.value;

    if (userVal) params.append('user', userVal);
    if (actionVal) params.append('action', actionVal);
    if (fromVal) params.append('from', fromVal);
    if (toVal) params.append('to', toVal);

    try {
      const res = await API.get(`/api/superadmin/logs?${params.toString()}`);
      if (!res.ok || !res.success) {
        showToast(res.message || 'Failed to retrieve system logs.', 'error');
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--error);">${escapeHtml(res.message || 'Failed to retrieve logs')}</td></tr>`;
        return;
      }

      logsList = res.logs || [];
      currentSummary = res.summary || {};
      currentPagination = res.pagination || {};

      updateKPICards(currentSummary, currentPagination);
      renderQuickActionChips(currentSummary.top_actions || []);
      renderLogsTable(logsList);
      renderPagination(currentPagination);

    } catch (err) {
      console.error('[superadmin/logs/fetch]', err);
      showToast('Network error while retrieving audit logs.', 'error');
      if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--error);">Network connection error.</td></tr>';
    }
  }

  // ── Update KPI Cards ───────────────────────────────────────────
  function updateKPICards(summary, pagination) {
    const elTotal = document.getElementById('statTotalLogs');
    const elFiltered = document.getElementById('statFilteredLogs');
    const elCurrentPage = document.getElementById('statCurrentPage');
    const elPageSub = document.getElementById('statPageSub');
    const elTopAction = document.getElementById('statTopAction');
    const elTopActionCount = document.getElementById('statTopActionCount');

    if (elTotal) elTotal.textContent = (summary.total_logs ?? 0).toLocaleString();
    if (elFiltered) elFiltered.textContent = (pagination.total ?? 0).toLocaleString();

    if (elCurrentPage) elCurrentPage.textContent = `Page ${pagination.page ?? 1}`;
    if (elPageSub) elPageSub.textContent = `of ${pagination.total_pages ?? 1} (${summary.displayed_logs ?? 0} shown)`;

    const topAction = summary.top_actions?.[0];
    if (elTopAction) elTopAction.textContent = topAction ? topAction.action : 'None';
    if (elTopActionCount) {
      elTopActionCount.textContent = topAction
        ? `${topAction.count.toLocaleString()} occurrences`
        : '0 events recorded';
    }
  }

  // ── Render Quick Category Chips ────────────────────────────────
  function renderQuickActionChips(topActions) {
    if (!chipsContainer) return;

    if (!topActions || topActions.length === 0) {
      chipsContainer.innerHTML = '<span style="font-size:0.75rem; color:var(--text-subtle);">No frequent actions recorded</span>';
      return;
    }

    chipsContainer.innerHTML = topActions.map(a => `
      <button class="quick-chip" data-action="${escapeHtml(a.action)}">
        <span>${escapeHtml(a.action)}</span>
        <span class="quick-chip-count">${a.count}</span>
      </button>
    `).join('');

    chipsContainer.querySelectorAll('.quick-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const action = chip.dataset.action;
        if (inputAction) inputAction.value = action;
        loadLogs(1);
      });
    });
  }

  // ── Render Logs Table ──────────────────────────────────────────
  function renderLogsTable(logs) {
    if (!tbody) return;

    if (!logs || logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:3rem; color:var(--text-muted);">No operational logs matching current filter parameters.</td></tr>';
      return;
    }

    tbody.innerHTML = logs.map(l => {
      const act = (l.action || '').toUpperCase();
      let tagClass = 'tag-default';
      let icon = '📜';

      if (act.includes('CREATE') || act.includes('ADD') || act.includes('REGISTER') || act.includes('GRANT')) {
        tagClass = 'tag-create';
        icon = '➕';
      } else if (act.includes('DELETE') || act.includes('REVOKE') || act.includes('BLOCK') || act.includes('REJECT')) {
        tagClass = 'tag-danger';
        icon = '🛑';
      } else if (act.includes('LOGIN') || act.includes('LOGOUT') || act.includes('AUTH')) {
        tagClass = 'tag-auth';
        icon = '🔑';
      } else if (act.includes('UPDATE') || act.includes('EDIT') || act.includes('APPROVE') || act.includes('ACTIVATE')) {
        tagClass = 'tag-update';
        icon = '⚙️';
      }

      const role = (l.user_role || 'system').toLowerCase();
      const roleChip = `<span class="role-chip ${role}">${escapeHtml(role)}</span>`;

      const formattedDate = formatFullDateTime(l.created_at);

      return `
        <tr>
          <td><span style="font-family:monospace; font-weight:700; color:var(--text-muted);">#${l.log_id}</span></td>
          <td style="font-size:0.82rem; color:var(--text-dark); white-space:nowrap;">${formattedDate}</td>
          <td>
            <div style="font-weight:700; color:var(--text-dark); display:flex; align-items:center; gap:0.4rem;">
              <span>${escapeHtml(l.user_name || 'System')}</span>
              ${roleChip}
            </div>
            <div style="font-size:0.75rem; color:var(--text-muted); font-family:monospace;">${escapeHtml(l.user_email || 'system@cab.com')}</div>
          </td>
          <td>
            <span class="action-tag ${tagClass}">
              <span>${icon}</span>
              <span>${escapeHtml(l.action || 'EVENT')}</span>
            </span>
          </td>
          <td>
            <div style="font-size:0.82rem; color:var(--text-dark); max-width:320px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(l.description || '')}">
              ${escapeHtml(l.description || '—')}
            </div>
          </td>
          <td>
            <span style="font-family:monospace; font-size:0.78rem; background:#F3F4F6; padding:0.15rem 0.45rem; border-radius:4px; color:#374151;">
              ${escapeHtml(l.ip_address || '127.0.0.1')}
            </span>
          </td>
          <td style="text-align:right;">
            <button class="action-btn btn-view-log" data-id="${l.log_id}" style="padding:0.3rem 0.65rem; font-size:0.75rem; border-radius:var(--radius-pill);" aria-label="View Log Details">
              Inspect 👁️
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Wire click on Inspect buttons
    tbody.querySelectorAll('.btn-view-log').forEach(btn => {
      btn.addEventListener('click', () => {
        const logId = parseInt(btn.dataset.id, 10);
        const logItem = logsList.find(l => l.log_id === logId);
        if (logItem) openLogDetailModal(logItem);
      });
    });
  }

  // ── Render Pagination Controls ─────────────────────────────────
  function renderPagination(pagination) {
    if (!paginationInfo || !paginationControls) return;

    const total = pagination.total || 0;
    const page = pagination.page || 1;
    const limit = pagination.limit || 50;
    const totalPages = pagination.total_pages || 1;

    const start = total === 0 ? 0 : (page - 1) * limit + 1;
    const end = Math.min(page * limit, total);

    paginationInfo.textContent = `Showing ${start.toLocaleString()}–${end.toLocaleString()} of ${total.toLocaleString()} entries`;

    if (totalPages <= 1) {
      paginationControls.innerHTML = '';
      return;
    }

    let html = '';

    // First & Prev buttons
    html += `<button class="action-btn" data-page="1" ${page === 1 ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''} style="padding:0.35rem 0.7rem; border-radius:var(--radius-pill); font-size:0.8rem;">« First</button>`;
    html += `<button class="action-btn" data-page="${page - 1}" ${page === 1 ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''} style="padding:0.35rem 0.7rem; border-radius:var(--radius-pill); font-size:0.8rem;">‹ Prev</button>`;

    // Window of pages
    const delta = 2;
    const rangeStart = Math.max(1, page - delta);
    const rangeEnd = Math.min(totalPages, page + delta);

    if (rangeStart > 1) {
      html += `<span style="font-size:0.8rem; color:var(--text-muted); padding:0 0.2rem;">…</span>`;
    }

    for (let p = rangeStart; p <= rangeEnd; p++) {
      const activeStyle = p === page
        ? 'background:#111315; color:#FFFFFF; font-weight:800;'
        : 'background:#FFFFFF; color:var(--text-dark);';
      html += `<button class="action-btn" data-page="${p}" style="padding:0.35rem 0.75rem; border-radius:var(--radius-pill); font-size:0.8rem; ${activeStyle}">${p}</button>`;
    }

    if (rangeEnd < totalPages) {
      html += `<span style="font-size:0.8rem; color:var(--text-muted); padding:0 0.2rem;">…</span>`;
    }

    // Next & Last buttons
    html += `<button class="action-btn" data-page="${page + 1}" ${page === totalPages ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''} style="padding:0.35rem 0.7rem; border-radius:var(--radius-pill); font-size:0.8rem;">Next ›</button>`;
    html += `<button class="action-btn" data-page="${totalPages}" ${page === totalPages ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''} style="padding:0.35rem 0.7rem; border-radius:var(--radius-pill); font-size:0.8rem;">Last »</button>`;

    paginationControls.innerHTML = html;

    paginationControls.querySelectorAll('button[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetPage = parseInt(btn.dataset.page, 10);
        if (targetPage && targetPage !== page) {
          loadLogs(targetPage);
          window.scrollTo({ top: 300, behavior: 'smooth' });
        }
      });
    });
  }

  // ── Open Log Detail Modal ──────────────────────────────────────
  function openLogDetailModal(log) {
    if (!logModal || !logDetailContent) return;

    logDetailContent.innerHTML = `
      <div class="modal-detail-row">
        <div class="modal-detail-label">Log ID</div>
        <div class="modal-detail-val">#${log.log_id}</div>
      </div>
      <div class="modal-detail-row">
        <div class="modal-detail-label">Timestamp</div>
        <div class="modal-detail-val">${formatFullDateTime(log.created_at)}</div>
      </div>
      <div class="modal-detail-row">
        <div class="modal-detail-label">Action</div>
        <div class="modal-detail-val">
          <span class="action-tag tag-auth" style="font-size:0.8rem;">${escapeHtml(log.action)}</span>
        </div>
      </div>
      <div class="modal-detail-row">
        <div class="modal-detail-label">Actor User</div>
        <div class="modal-detail-val">
          <strong>${escapeHtml(log.user_name || 'System')}</strong> (${escapeHtml(log.user_email || 'system@cab.com')})
          <div style="margin-top:0.2rem;"><span class="role-chip ${escapeHtml(log.user_role || 'system')}">${escapeHtml(log.user_role || 'system')}</span> · User ID: ${log.user_id ?? 'None'}</div>
        </div>
      </div>
      <div class="modal-detail-row">
        <div class="modal-detail-label">Origin IP</div>
        <div class="modal-detail-val">
          <span style="font-family:monospace; background:#F3F4F6; padding:0.2rem 0.5rem; border-radius:4px;">
            ${escapeHtml(log.ip_address || '127.0.0.1')}
          </span>
        </div>
      </div>
      <div class="modal-detail-row">
        <div class="modal-detail-label">Description</div>
        <div class="modal-detail-val" style="line-height:1.5;">${escapeHtml(log.description || 'No detailed description provided.')}</div>
      </div>
    `;

    logModal.style.display = 'flex';
  }

  function closeLogDetailModal() {
    if (logModal) logModal.style.display = 'none';
  }

  btnCloseModal?.addEventListener('click', closeLogDetailModal);
  btnDismissModal?.addEventListener('click', closeLogDetailModal);
  logModal?.addEventListener('click', (e) => {
    if (e.target === logModal) closeLogDetailModal();
  });

  // ── Filters & Preset Handlers ──────────────────────────────────
  btnApply?.addEventListener('click', () => {
    loadLogs(1);
  });

  inputUser?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadLogs(1);
  });
  inputAction?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadLogs(1);
  });
  selectLimit?.addEventListener('change', () => {
    loadLogs(1);
  });

  btnReset?.addEventListener('click', () => {
    if (inputUser) inputUser.value = '';
    if (inputAction) inputAction.value = '';
    if (inputFrom) inputFrom.value = '';
    if (inputTo) inputTo.value = '';
    if (selectLimit) selectLimit.value = '50';

    presetPills.forEach(p => p.classList.remove('active'));
    document.querySelector('.preset-pill[data-preset="all"]')?.classList.add('active');

    loadLogs(1);
  });

  btnRefresh?.addEventListener('click', () => {
    loadLogs(currentPage);
    showToast('Audit logs refreshed.', 'info');
  });

  // Date range presets
  presetPills.forEach(pill => {
    pill.addEventListener('click', () => {
      presetPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      const preset = pill.dataset.preset;
      const today = new Date();
      const formatYMD = d => d.toISOString().split('T')[0];

      if (preset === 'today') {
        const ymd = formatYMD(today);
        if (inputFrom) inputFrom.value = ymd;
        if (inputTo) inputTo.value = ymd;
      } else if (preset === '7d') {
        const prior = new Date();
        prior.setDate(today.getDate() - 7);
        if (inputFrom) inputFrom.value = formatYMD(prior);
        if (inputTo) inputTo.value = formatYMD(today);
      } else if (preset === '30d') {
        const prior = new Date();
        prior.setDate(today.getDate() - 30);
        if (inputFrom) inputFrom.value = formatYMD(prior);
        if (inputTo) inputTo.value = formatYMD(today);
      } else if (preset === 'all') {
        if (inputFrom) inputFrom.value = '';
        if (inputTo) inputTo.value = '';
      }

      loadLogs(1);
    });
  });

  // ── CSV Export Functionality ───────────────────────────────────
  btnExport?.addEventListener('click', async () => {
    setButtonLoading(btnExport, true);

    try {
      // Fetch up to 1000 logs matching current filters for export
      const params = new URLSearchParams({
        page: 1,
        limit: 1000
      });

      const userVal = inputUser?.value.trim();
      const actionVal = inputAction?.value.trim();
      const fromVal = inputFrom?.value;
      const toVal = inputTo?.value;

      if (userVal) params.append('user', userVal);
      if (actionVal) params.append('action', actionVal);
      if (fromVal) params.append('from', fromVal);
      if (toVal) params.append('to', toVal);

      const res = await API.get(`/api/superadmin/logs?${params.toString()}`);
      if (!res.ok || !res.success || !res.logs || res.logs.length === 0) {
        showToast('No logs available to export.', 'warning');
        setButtonLoading(btnExport, false, '📥 Export Audit CSV');
        return;
      }

      const rows = res.logs;
      const headers = ['Log ID', 'Timestamp', 'User ID', 'User Name', 'User Email', 'Role', 'Action', 'Description', 'IP Address'];

      const csvLines = [headers.join(',')];

      rows.forEach(r => {
        const values = [
          r.log_id,
          `"${r.created_at || ''}"`,
          r.user_id ?? '',
          `"${(r.user_name || '').replace(/"/g, '""')}"`,
          `"${(r.user_email || '').replace(/"/g, '""')}"`,
          `"${r.user_role || ''}"`,
          `"${(r.action || '').replace(/"/g, '""')}"`,
          `"${(r.description || '').replace(/"/g, '""')}"`,
          `"${r.ip_address || ''}"`
        ];
        csvLines.push(values.join(','));
      });

      const csvContent = csvLines.join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      const dateStr = new Date().toISOString().split('T')[0];
      link.setAttribute('href', url);
      link.setAttribute('download', `cabgo_system_audit_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast(`Exported ${rows.length} audit log entries.`, 'success');

    } catch (err) {
      console.error('[superadmin/logs/export]', err);
      showToast('Failed to export CSV report.', 'error');
    } finally {
      setButtonLoading(btnExport, false, '📥 Export Audit CSV');
    }
  });

  // ── Logout Button Handler ──────────────────────────────────────
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    try {
      await API.post('/api/auth/logout');
    } catch (e) {
      // ignore network errors
    }
    sessionStorage.clear();
    window.location.href = '/login.html';
  });

  // ── Helper Utilities ───────────────────────────────────────────
  function formatFullDateTime(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
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
  loadLogs(1);
}
