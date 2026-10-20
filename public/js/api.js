// public/js/api.js — Reusable Fetch wrapper with auth token injection

const API = (() => {
  const BASE = '';

  async function request(method, endpoint, body = null) {
    const headers = { 'Content-Type': 'application/json' };
    const token = sessionStorage.getItem('cab_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const opts = { method, headers };
    if (body && method !== 'GET') opts.body = JSON.stringify(body);

    let res;
    try {
      res = await fetch(BASE + endpoint, opts);
    } catch {
      throw new Error('Network error — check your connection.');
    }

    // Auto-logout on 401
    if (res.status === 401) {
      sessionStorage.clear();
      window.location.href = '/login.html?expired=1';
      return;
    }

    const data = await res.json();
    return { status: res.status, ok: res.ok, ...data };
  }

  return {
    get:    (ep)       => request('GET',    ep),
    post:   (ep, body) => request('POST',   ep, body),
    put:    (ep, body) => request('PUT',    ep, body),
    delete: (ep)       => request('DELETE', ep),
  };
})();

// ── Toast notification system ────────────────────────────
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.4s';
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

// Alias on API object for consistent usage across modules
API.toast = showToast;

// ── Loading button helper ────────────────────────────────
function setButtonLoading(btn, loading, originalText = '') {
  if (loading) {
    btn._originalText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span> Loading…`;
    btn.disabled = true;
  } else {
    btn.innerHTML = btn._originalText || originalText;
    btn.disabled = false;
  }
}

// ── Form alert helper ────────────────────────────────────
function showAlert(elementId, message, type = 'error') {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.className = `alert alert-${type} show`;
  el.textContent = message;
  el.style.display = 'flex';
}
function hideAlert(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.style.display = 'none';
  el.className = 'alert';
}
