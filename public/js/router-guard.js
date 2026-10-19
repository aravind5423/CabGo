// public/js/router-guard.js
// Role-based page access guard — include on every protected page
// Usage: <script src="/js/router-guard.js" data-role="passenger"></script>
// OR:    <script src="/js/router-guard.js" data-role="driver,admin,superadmin"></script>

(function () {
  const scriptTag    = document.currentScript;
  const allowedRoles = (scriptTag?.dataset?.role || '').split(',').map(r => r.trim()).filter(Boolean);

  function decodeToken(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    } catch { return null; }
  }

  const token = sessionStorage.getItem('cab_token');

  // No token → redirect to login
  if (!token) {
    window.location.replace('/login.html');
    return;
  }

  const payload = decodeToken(token);

  // Invalid or expired token → redirect
  if (!payload || (payload.exp && Math.floor(Date.now() / 1000) > payload.exp)) {
    sessionStorage.clear();
    window.location.replace('/login.html?expired=1');
    return;
  }

  // Role check
  if (allowedRoles.length > 0 && !allowedRoles.includes(payload.role)) {
    // Redirect to appropriate dashboard based on actual role
    const roleHome = {
      passenger:  '/passenger/dashboard.html',
      driver:     '/driver/dashboard.html',
      admin:      '/admin/dashboard.html',
      superadmin: '/superadmin/dashboard.html',
    };
    window.location.replace(roleHome[payload.role] || '/login.html');
    return;
  }

  // ── Expose user info globally for page scripts ───────
  window.CAB_USER = payload;

  // ── Auto-fill user name on pages ────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-user-name]').forEach(el => {
      el.textContent = payload.name || 'User';
    });
    document.querySelectorAll('[data-user-role]').forEach(el => {
      el.textContent = payload.role.charAt(0).toUpperCase() + payload.role.slice(1);
    });
    document.querySelectorAll('[data-user-email]').forEach(el => {
      el.textContent = payload.email || '';
    });
  });
})();
