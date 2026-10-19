// public/js/auth.js — Login & Register form DOM logic

document.addEventListener('DOMContentLoaded', () => {

  // ── Login Form ─────────────────────────────────────────
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    // Show expiry message if redirected
    const params = new URLSearchParams(window.location.search);
    if (params.get('expired')) {
      showAlert('form-alert', 'Session expired. Please log in again.', 'warning');
    }

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert('form-alert');

      const email    = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const btn      = document.getElementById('login-btn');

      // Basic client-side check
      if (!email || !password) {
        return showAlert('form-alert', 'Please fill in all fields.', 'error');
      }

      setButtonLoading(btn, true);
      try {
        const res = await API.post('/api/auth/login', { email, password });
        if (res && res.success) {
          // Persist token + user info
          sessionStorage.setItem('cab_token', res.token);
          sessionStorage.setItem('cab_user',  JSON.stringify(res.user));
          showToast(`Welcome back, ${res.user.name}! 👋`, 'success');

          // Redirect by role
          setTimeout(() => {
            const role = res.user.role;
            const redirectMap = {
              passenger:  '/passenger/dashboard.html',
              driver:     '/driver/dashboard.html',
              admin:      '/admin/dashboard.html',
              superadmin: '/superadmin/dashboard.html',
            };
            window.location.href = redirectMap[role] || '/';
          }, 600);
        } else {
          showAlert('form-alert', res?.message || 'Login failed.', 'error');
        }
      } catch (err) {
        showAlert('form-alert', err.message, 'error');
      } finally {
        setButtonLoading(btn, false);
      }
    });

    // Toggle password visibility
    document.getElementById('toggle-password')?.addEventListener('click', () => {
      const pw  = document.getElementById('password');
      const btn = document.getElementById('toggle-password');
      pw.type   = pw.type === 'password' ? 'text' : 'password';
      btn.textContent = pw.type === 'password' ? '👁️' : '🙈';
    });
  }

  // ── Register Form ──────────────────────────────────────
  const registerForm = document.getElementById('register-form');
  if (registerForm) {

    // Tab switching (Passenger / Driver)
    const tabs = document.querySelectorAll('.auth-tab');
    let activeRole = 'passenger';

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        activeRole = tab.dataset.role;

        // Show/hide driver-only fields
        const driverFields = document.getElementById('driver-fields');
        if (driverFields) {
          driverFields.style.display = activeRole === 'driver' ? 'block' : 'none';
        }
        const passengerFields = document.getElementById('passenger-fields');
        if (passengerFields) {
          passengerFields.style.display = activeRole === 'passenger' ? 'block' : 'none';
        }
        hideAlert('form-alert');
      });
    });

    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert('form-alert');

      const name     = document.getElementById('reg-name').value.trim();
      const email    = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;
      const mobile   = document.getElementById('reg-mobile').value.trim();
      const btn      = document.getElementById('register-btn');

      // Validation
      if (!name || !email || !password || !mobile) {
        return showAlert('form-alert', 'Please fill in all required fields.', 'error');
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return showAlert('form-alert', 'Please enter a valid email address.', 'error');
      }
      if (!/^[6-9]\d{9}$/.test(mobile)) {
        return showAlert('form-alert', 'Enter a valid 10-digit Indian mobile number.', 'error');
      }
      if (password.length < 6) {
        return showAlert('form-alert', 'Password must be at least 6 characters.', 'error');
      }

      const payload = { name, email, password, mobile, role: activeRole };

      if (activeRole === 'passenger') {
        payload.emergency_contact = document.getElementById('emergency-contact')?.value?.trim() || '';
        payload.default_address   = document.getElementById('default-address')?.value?.trim()   || '';
      }
      if (activeRole === 'driver') {
        const license_no     = document.getElementById('license-no')?.value?.trim();
        const license_expiry = document.getElementById('license-expiry')?.value;
        if (!license_no || !license_expiry) {
          return showAlert('form-alert', 'License number and expiry are required for drivers.', 'error');
        }
        payload.license_no     = license_no;
        payload.license_expiry = license_expiry;
      }

      setButtonLoading(btn, true);
      try {
        const res = await API.post('/api/auth/register', payload);
        if (res && res.success) {
          showAlert('form-alert', res.message + ' Redirecting to login…', 'success');
          setTimeout(() => { window.location.href = '/login.html'; }, 1800);
        } else {
          showAlert('form-alert', res?.message || 'Registration failed.', 'error');
        }
      } catch (err) {
        showAlert('form-alert', err.message, 'error');
      } finally {
        setButtonLoading(btn, false);
      }
    });

    // Toggle password
    document.getElementById('toggle-reg-password')?.addEventListener('click', () => {
      const pw  = document.getElementById('reg-password');
      const btn = document.getElementById('toggle-reg-password');
      pw.type   = pw.type === 'password' ? 'text' : 'password';
      btn.textContent = pw.type === 'password' ? '👁️' : '🙈';
    });
  }

  // ── Logout (called from any dashboard) ────────────────
  window.logout = async () => {
    await API.post('/api/auth/logout');
    sessionStorage.clear();
    window.location.href = '/login.html';
  };

  // ── Get current user from sessionStorage ────────────
  window.getCurrentUser = () => {
    try { return JSON.parse(sessionStorage.getItem('cab_user')); }
    catch { return null; }
  };
});
