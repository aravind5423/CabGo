// public/js/auth.js — Login & Register form DOM logic with Validator integration

document.addEventListener('DOMContentLoaded', () => {

  // ── Login Form ─────────────────────────────────────────
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const btn = document.getElementById('login-btn');

    // Show expiry message if redirected
    const params = new URLSearchParams(window.location.search);
    if (params.get('expired')) {
      showAlert('form-alert', 'Session expired. Please log in again.', 'warning');
      if (typeof API !== 'undefined' && API.toast) {
        API.toast('Session expired. Please log in again.', 'warning');
      }
    }

    // Clear field errors on input
    emailInput?.addEventListener('input', () => {
      if (window.Validator) Validator.clearFieldError(emailInput);
      hideAlert('form-alert');
    });
    passwordInput?.addEventListener('input', () => {
      if (window.Validator) Validator.clearFieldError(passwordInput);
      hideAlert('form-alert');
    });

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert('form-alert');
      if (window.Validator) Validator.clearFormErrors(loginForm);

      const email = emailInput.value.trim();
      const password = passwordInput.value;

      let hasError = false;

      // Client-side validations
      if (!email) {
        if (window.Validator) Validator.showFieldError(emailInput, 'Email address is required.');
        hasError = true;
      } else if (window.Validator && !Validator.isValidEmail(email)) {
        Validator.showFieldError(emailInput, 'Please enter a valid email address.');
        hasError = true;
      }

      if (!password) {
        if (window.Validator) Validator.showFieldError(passwordInput, 'Password is required.');
        hasError = true;
      }

      if (hasError) {
        showAlert('form-alert', 'Please fix the errors above before continuing.', 'error');
        return;
      }

      setButtonLoading(btn, true);
      try {
        const res = await API.post('/api/auth/login', { email, password });
        if (res && res.success) {
          // Persist token + user info
          sessionStorage.setItem('cab_token', res.token);
          sessionStorage.setItem('cab_user', JSON.stringify(res.user));
          sessionStorage.setItem('user_name', res.user.name);
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
          if (res?.message?.toLowerCase().includes('password') && window.Validator) {
            Validator.showFieldError(passwordInput, res.message);
          } else if (res?.message?.toLowerCase().includes('email') && window.Validator) {
            Validator.showFieldError(emailInput, res.message);
          }
        }
      } catch (err) {
        showAlert('form-alert', err.message || 'Network error — please check your connection.', 'error');
      } finally {
        setButtonLoading(btn, false);
      }
    });

    // Toggle password visibility
    document.getElementById('toggle-password')?.addEventListener('click', () => {
      const pw = document.getElementById('password');
      const toggleBtn = document.getElementById('toggle-password');
      pw.type = pw.type === 'password' ? 'text' : 'password';
      toggleBtn.textContent = pw.type === 'password' ? '👁️' : '🙈';
    });
  }

  // ── Register Form ──────────────────────────────────────
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    const nameInput     = document.getElementById('reg-name');
    const emailInput    = document.getElementById('reg-email');
    const mobileInput   = document.getElementById('reg-mobile');
    const passwordInput = document.getElementById('reg-password');
    const btn           = document.getElementById('register-btn');

    // Create dynamic password strength meter
    if (window.Validator && passwordInput) {
      const meterContainer = document.createElement('div');
      passwordInput.closest('.form-group')?.appendChild(meterContainer);
      Validator.createPasswordMeter(passwordInput, meterContainer);
    }

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
        if (window.Validator) Validator.clearFormErrors(registerForm);
      });
    });

    // Clear field errors on input
    [nameInput, emailInput, mobileInput, passwordInput].forEach(inp => {
      inp?.addEventListener('input', () => {
        if (window.Validator) Validator.clearFieldError(inp);
        hideAlert('form-alert');
      });
    });

    const licenseNoInput = document.getElementById('license-no');
    const licenseExpiryInput = document.getElementById('license-expiry');
    const emergencyInput = document.getElementById('emergency-contact');

    licenseNoInput?.addEventListener('input', () => window.Validator && Validator.clearFieldError(licenseNoInput));
    licenseExpiryInput?.addEventListener('input', () => window.Validator && Validator.clearFieldError(licenseExpiryInput));
    emergencyInput?.addEventListener('input', () => window.Validator && Validator.clearFieldError(emergencyInput));

    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert('form-alert');
      if (window.Validator) Validator.clearFormErrors(registerForm);

      const name     = nameInput.value.trim();
      const email    = emailInput.value.trim();
      const mobile   = mobileInput.value.trim();
      const password = passwordInput.value;

      let hasError = false;

      // Validation suite
      if (!name) {
        if (window.Validator) Validator.showFieldError(nameInput, 'Full name is required.');
        hasError = true;
      }

      if (!email) {
        if (window.Validator) Validator.showFieldError(emailInput, 'Email address is required.');
        hasError = true;
      } else if (window.Validator && !Validator.isValidEmail(email)) {
        Validator.showFieldError(emailInput, 'Please enter a valid email address.');
        hasError = true;
      }

      if (!mobile) {
        if (window.Validator) Validator.showFieldError(mobileInput, 'Mobile number is required.');
        hasError = true;
      } else if (window.Validator && !Validator.isValidPhone(mobile)) {
        Validator.showFieldError(mobileInput, 'Enter a valid 10-digit Indian mobile number (e.g. 9876543210).');
        hasError = true;
      }

      if (!password) {
        if (window.Validator) Validator.showFieldError(passwordInput, 'Password is required.');
        hasError = true;
      } else if (window.Validator) {
        const pwRes = Validator.validatePassword(password);
        if (!pwRes.valid) {
          Validator.showFieldError(passwordInput, pwRes.message);
          hasError = true;
        }
      } else if (password.length < 6) {
        showAlert('form-alert', 'Password must be at least 6 characters.', 'error');
        hasError = true;
      }

      const payload = { name, email, password, mobile, role: activeRole };

      if (activeRole === 'passenger') {
        const emergency = emergencyInput?.value?.trim() || '';
        if (emergency && window.Validator && !Validator.isValidPhone(emergency)) {
          Validator.showFieldError(emergencyInput, 'Emergency contact must be a valid 10-digit mobile number.');
          hasError = true;
        }
        payload.emergency_contact = emergency;
        payload.default_address   = document.getElementById('default-address')?.value?.trim() || '';
      }

      if (activeRole === 'driver') {
        const license_no     = licenseNoInput?.value?.trim() || '';
        const license_expiry = licenseExpiryInput?.value || '';

        if (!license_no) {
          if (window.Validator) Validator.showFieldError(licenseNoInput, 'Driving license number is required.');
          hasError = true;
        } else if (window.Validator && !Validator.isValidLicense(license_no)) {
          Validator.showFieldError(licenseNoInput, 'Enter a valid commercial license format (e.g. TN-012021008976).');
          hasError = true;
        }

        if (!license_expiry) {
          if (window.Validator) Validator.showFieldError(licenseExpiryInput, 'License expiry date is required.');
          hasError = true;
        } else if (window.Validator && !Validator.isFutureDate(license_expiry)) {
          Validator.showFieldError(licenseExpiryInput, 'License expiry date must be in the future.');
          hasError = true;
        }

        payload.license_no     = license_no;
        payload.license_expiry = license_expiry;
      }

      if (hasError) {
        showAlert('form-alert', 'Please fix the highlighted fields above.', 'error');
        return;
      }

      setButtonLoading(btn, true);
      try {
        const res = await API.post('/api/auth/register', payload);
        if (res && res.success) {
          showAlert('form-alert', res.message + ' Redirecting to login…', 'success');
          showToast('Account created successfully! Redirecting...', 'success');
          setTimeout(() => { window.location.href = '/login.html'; }, 1600);
        } else {
          showAlert('form-alert', res?.message || 'Registration failed.', 'error');
        }
      } catch (err) {
        showAlert('form-alert', err.message || 'Network error occurred.', 'error');
      } finally {
        setButtonLoading(btn, false);
      }
    });

    // Toggle password
    document.getElementById('toggle-reg-password')?.addEventListener('click', () => {
      const pw  = document.getElementById('reg-password');
      const toggleBtn = document.getElementById('toggle-reg-password');
      pw.type   = pw.type === 'password' ? 'text' : 'password';
      toggleBtn.textContent = pw.type === 'password' ? '👁️' : '🙈';
    });
  }

  // ── Logout (called from any dashboard) ────────────────
  window.logout = async () => {
    try {
      await API.post('/api/auth/logout');
    } catch (e) {}
    sessionStorage.clear();
    window.location.href = '/login.html';
  };

  // ── Get current user from sessionStorage ────────────
  window.getCurrentUser = () => {
    try { return JSON.parse(sessionStorage.getItem('cab_user')); }
    catch { return null; }
  };
});
