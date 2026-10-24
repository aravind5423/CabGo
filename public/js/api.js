// public/js/api.js — Reusable Fetch wrapper, theme manager, responsive nav drawer & toast system

// ── Immediately apply saved theme to avoid FOUC ──────────
(function () {
  try {
    const saved = localStorage.getItem('cab_theme') ||
      (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', saved);
  } catch (e) {}
})();

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

// ── Theme Manager ────────────────────────────────────────
API.getTheme = function () {
  return document.documentElement.getAttribute('data-theme') || 'light';
};

API.toggleTheme = function () {
  const current = API.getTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try {
    localStorage.setItem('cab_theme', next);
  } catch (e) {}

  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.innerHTML = next === 'dark' ? '☀️' : '🌙';
    btn.setAttribute('aria-label', `Switch to ${next === 'dark' ? 'light' : 'dark'} mode`);
    btn.title = `Switch to ${next === 'dark' ? 'light' : 'dark'} mode`;
  });

  window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }));
  return next;
};

// ── Toast notification system ────────────────────────────
function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <div class="toast-content">
      <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
      <span class="toast-message">${message}</span>
    </div>
    <button type="button" class="toast-close" aria-label="Dismiss notification">&times;</button>
    <div class="toast-progress" style="animation-duration: ${duration}ms;"></div>
  `;
  container.appendChild(toast);

  let removeTimeout = setTimeout(dismiss, duration);

  function dismiss() {
    clearTimeout(removeTimeout);
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(12px) scale(0.96)';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 250);
  }

  const closeBtn = toast.querySelector('.toast-close');
  if (closeBtn) closeBtn.addEventListener('click', dismiss);
}

// Alias on API object for consistent usage across modules
API.toast = showToast;

// ── Loading button helper ────────────────────────────────
function setButtonLoading(btn, loading, originalText = '') {
  if (!btn) return;
  if (loading) {
    btn._originalText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner" style="display:inline-block; width:14px; height:14px; border:2px solid currentColor; border-right-color:transparent; border-radius:50%; animation:spin 0.6s linear infinite; vertical-align:middle; margin-right:0.4rem;"></span> Loading…`;
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

// ── Skeleton Loader Helpers ──────────────────────────────
API.showSkeletonTable = function (tbodyOrSelector, rowCount = 5, colCount = 4) {
  const tbody = typeof tbodyOrSelector === 'string' ? document.querySelector(tbodyOrSelector) : tbodyOrSelector;
  if (!tbody) return;
  let html = '';
  for (let r = 0; r < rowCount; r++) {
    html += '<tr class="skeleton-row">';
    for (let c = 0; c < colCount; c++) {
      const isShort = c === 0 ? 'short' : '';
      html += `<td><span class="skeleton skeleton-text ${isShort}"></span></td>`;
    }
    html += '</tr>';
  }
  tbody.innerHTML = html;
};

API.showSkeletonCards = function (containerOrSelector, count = 4) {
  const container = typeof containerOrSelector === 'string' ? document.querySelector(containerOrSelector) : containerOrSelector;
  if (!container) return;
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `
      <div class="kpi-card skeleton-card">
        <span class="skeleton skeleton-title"></span>
        <span class="skeleton skeleton-text short"></span>
      </div>
    `;
  }
  container.innerHTML = html;
};

// ── Auto-Initialize Navigation Drawer, Hamburger & Theme Button ──
API.initDashboardNav = function () {
  const currentTheme = API.getTheme();
  const themeIcon = currentTheme === 'dark' ? '☀️' : '🌙';

  // 1. Handle Pill Navbars on Public Pages (.nav-pill-bar)
  const navPillBar = document.querySelector('.nav-pill-bar');
  if (navPillBar && !navPillBar.querySelector('.theme-toggle-btn')) {
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'theme-toggle-btn';
    toggleBtn.innerHTML = themeIcon;
    toggleBtn.setAttribute('aria-label', `Switch to ${currentTheme === 'dark' ? 'light' : 'dark'} mode`);
    toggleBtn.title = `Switch to ${currentTheme === 'dark' ? 'light' : 'dark'} mode`;
    toggleBtn.addEventListener('click', API.toggleTheme);
    navPillBar.appendChild(toggleBtn);
  }

  // 2. Handle Dashboard Navbars (.dash-navbar)
  const dashNav = document.querySelector('.dash-navbar');
  if (!dashNav) return;

  // Insert Theme Toggle into Dash Navbar if not present
  const userMenu = dashNav.querySelector('.dash-user-menu');
  if (userMenu && !userMenu.querySelector('.theme-toggle-btn')) {
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'theme-toggle-btn';
    toggleBtn.innerHTML = themeIcon;
    toggleBtn.setAttribute('aria-label', `Switch to ${currentTheme === 'dark' ? 'light' : 'dark'} mode`);
    toggleBtn.title = `Switch to ${currentTheme === 'dark' ? 'light' : 'dark'} mode`;
    toggleBtn.addEventListener('click', API.toggleTheme);
    userMenu.insertBefore(toggleBtn, userMenu.firstChild);
  }

  // Insert Mobile Hamburger Toggle Button into Dash Navbar
  let hamburgerBtn = dashNav.querySelector('.dash-nav-toggle');
  if (!hamburgerBtn) {
    hamburgerBtn = document.createElement('button');
    hamburgerBtn.type = 'button';
    hamburgerBtn.className = 'dash-nav-toggle';
    hamburgerBtn.setAttribute('aria-label', 'Open navigation menu');
    hamburgerBtn.innerHTML = '☰';
    dashNav.appendChild(hamburgerBtn);
  }

  // Create or Hook up Sidebar Drawer Component
  let drawer = document.querySelector('.dash-sidebar-drawer');
  let backdrop = document.querySelector('.dash-drawer-backdrop');

  if (!drawer) {
    const brand = dashNav.querySelector('.dash-brand')?.cloneNode(true) || document.createElement('div');
    const navLinks = dashNav.querySelectorAll('.dash-nav-link');

    drawer = document.createElement('aside');
    drawer.className = 'dash-sidebar-drawer';
    drawer.setAttribute('aria-label', 'Mobile Navigation Drawer');

    backdrop = document.createElement('div');
    backdrop.className = 'dash-drawer-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');

    // Drawer Header
    const drawerHeader = document.createElement('div');
    drawerHeader.className = 'drawer-header';
    drawerHeader.appendChild(brand);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'drawer-close';
    closeBtn.setAttribute('aria-label', 'Close menu');
    closeBtn.innerHTML = '&times;';
    drawerHeader.appendChild(closeBtn);
    drawer.appendChild(drawerHeader);

    // Drawer Links
    const drawerNav = document.createElement('nav');
    const drawerUl = document.createElement('ul');
    drawerUl.className = 'drawer-nav-links';

    navLinks.forEach(link => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.className = 'drawer-nav-link' + (link.classList.contains('active') ? ' active' : '');
      a.href = link.href;
      a.innerHTML = link.innerHTML;
      li.appendChild(a);
      drawerUl.appendChild(li);
    });

    drawerNav.appendChild(drawerUl);
    drawer.appendChild(drawerNav);

    // Drawer Footer
    const drawerFooter = document.createElement('div');
    drawerFooter.className = 'drawer-footer';

    const drawerThemeRow = document.createElement('div');
    drawerThemeRow.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:0.5rem 0.25rem; font-weight:600; font-size:0.9rem;';
    drawerThemeRow.innerHTML = `<span>Appearance</span>`;
    const drawerThemeBtn = document.createElement('button');
    drawerThemeBtn.type = 'button';
    drawerThemeBtn.className = 'theme-toggle-btn';
    drawerThemeBtn.innerHTML = themeIcon;
    drawerThemeBtn.addEventListener('click', API.toggleTheme);
    drawerThemeRow.appendChild(drawerThemeBtn);
    drawerFooter.appendChild(drawerThemeRow);

    const logoutBtnOriginal = dashNav.querySelector('#logoutBtn');
    if (logoutBtnOriginal) {
      const drawerLogout = document.createElement('button');
      drawerLogout.type = 'button';
      drawerLogout.className = 'btn btn-outline btn-block btn-sm';
      drawerLogout.style.cssText = 'margin-top:0.5rem; justify-content:center;';
      drawerLogout.innerHTML = '🚪 Logout';
      drawerLogout.addEventListener('click', () => logoutBtnOriginal.click());
      drawerFooter.appendChild(drawerLogout);
    }

    drawer.appendChild(drawerFooter);

    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);

    // Event listeners
    closeBtn.addEventListener('click', closeDrawer);
    backdrop.addEventListener('click', closeDrawer);
  }

  function openDrawer() {
    drawer.classList.add('open');
    backdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    drawer.classList.remove('open');
    backdrop.classList.remove('open');
    document.body.style.overflow = '';
  }

  hamburgerBtn.addEventListener('click', openDrawer);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) {
      closeDrawer();
    }
  });
};

// Auto-run on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', API.initDashboardNav);
} else {
  API.initDashboardNav();
}
