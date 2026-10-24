// public/js/validator.js — Comprehensive client-side validation & error handling suite

const Validator = (() => {

  // ── Core Validation Functions ────────────────────────────
  function isRequired(val) {
    if (val === null || val === undefined) return false;
    if (typeof val === 'string') return val.trim().length > 0;
    if (typeof val === 'number') return !isNaN(val);
    return Boolean(val);
  }

  function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    return re.test(email.trim());
  }

  function isValidPhone(phone) {
    if (!phone || typeof phone !== 'string') return false;
    const clean = phone.replace(/[\s\-\(\)\+]/g, '');
    // Indian 10-digit mobile or with 91 prefix
    return /^([6-9]\d{9}|91[6-9]\d{9})$/.test(clean);
  }

  function validatePassword(password) {
    if (!password || typeof password !== 'string') {
      return { valid: false, score: 0, strength: 'weak', message: 'Password is required' };
    }
    let score = 0;
    const errors = [];

    if (password.length >= 8) score++;
    else errors.push('At least 8 characters');

    if (/[a-z]/.test(password)) score++;
    else errors.push('A lowercase letter');

    if (/[A-Z]/.test(password)) score++;
    else errors.push('An uppercase letter');

    if (/\d/.test(password)) score++;
    else errors.push('A number');

    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++;
    else errors.push('A special symbol');

    let strength = 'weak';
    if (score >= 5) strength = 'strong';
    else if (score >= 4) strength = 'good';
    else if (score >= 3) strength = 'fair';
    else strength = 'weak';

    const valid = score >= 3 && password.length >= 8;
    const message = valid ? 'Strong password' : `Requires: ${errors.join(', ')}`;

    return { valid, score, strength, message, errors };
  }

  function isValidVehicleNumber(plate) {
    if (!plate || typeof plate !== 'string') return false;
    const clean = plate.trim().toUpperCase().replace(/[\s\-]/g, '');
    // Indian standard format: 2-char state + 2-digit district + 1-3 letter series + 4-digit number
    return /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/.test(clean);
  }

  function isValidLicense(license) {
    if (!license || typeof license !== 'string') return false;
    const clean = license.trim().replace(/[\s\-]/g, '');
    return /^[A-Z0-9]{8,20}$/i.test(clean);
  }

  function isValidPositiveNumber(val, allowZero = false) {
    const num = parseFloat(val);
    if (isNaN(num)) return false;
    return allowZero ? num >= 0 : num > 0;
  }

  function isFutureDate(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d >= today;
  }

  // ── DOM Inline Error Rendering ───────────────────────────
  function showFieldError(inputEl, message) {
    if (!inputEl) return;
    inputEl.classList.add('is-invalid');
    inputEl.classList.remove('is-valid');

    // Locate or create error message container
    let parent = inputEl.closest('.form-group') || inputEl.closest('.input-wrapper') || inputEl.parentElement;
    let errEl = parent.querySelector('.field-error-msg');
    if (!errEl) {
      errEl = document.createElement('div');
      errEl.className = 'field-error-msg';
      errEl.setAttribute('role', 'alert');
      // Insert after input or wrapper
      if (inputEl.nextSibling) {
        parent.insertBefore(errEl, inputEl.nextSibling);
      } else {
        parent.appendChild(errEl);
      }
    }
    errEl.innerHTML = `<span>⚠️</span> <span>${message}</span>`;
  }

  function clearFieldError(inputEl) {
    if (!inputEl) return;
    inputEl.classList.remove('is-invalid');
    const parent = inputEl.closest('.form-group') || inputEl.closest('.input-wrapper') || inputEl.parentElement;
    if (parent) {
      const errEl = parent.querySelector('.field-error-msg');
      if (errEl) errEl.remove();
    }
  }

  function clearFormErrors(formEl) {
    if (!formEl) return;
    formEl.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    formEl.querySelectorAll('.field-error-msg').forEach(el => el.remove());
  }

  function attachLiveValidation(inputEl, validateFn, errorMessage) {
    if (!inputEl) return;
    const handler = () => {
      const val = inputEl.value;
      if (!validateFn(val)) {
        showFieldError(inputEl, errorMessage);
      } else {
        clearFieldError(inputEl);
        inputEl.classList.add('is-valid');
      }
    };
    inputEl.addEventListener('input', handler);
    inputEl.addEventListener('blur', handler);
  }

  function createPasswordMeter(inputEl, containerEl) {
    if (!inputEl || !containerEl) return;
    containerEl.className = 'password-meter-wrap';
    containerEl.innerHTML = `
      <div class="password-meter-bar">
        <div class="password-meter-fill"></div>
      </div>
      <div class="password-meter-text">Enter password (8+ characters)</div>
    `;
    const fill = containerEl.querySelector('.password-meter-fill');
    const text = containerEl.querySelector('.password-meter-text');

    inputEl.addEventListener('input', () => {
      const val = inputEl.value;
      if (!val) {
        fill.className = 'password-meter-fill';
        fill.style.width = '0%';
        text.textContent = 'Enter password (8+ characters)';
        return;
      }
      const res = validatePassword(val);
      fill.className = `password-meter-fill ${res.strength}`;
      text.textContent = res.valid
        ? `Strength: ${res.strength.toUpperCase()} ✓`
        : `Requires: ${res.errors.join(', ')}`;
    });
  }

  // ── Network Connectivity Monitor ─────────────────────────
  let banner = null;

  function showNetworkBanner(isOnline) {
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'network-status-banner';
      document.body.appendChild(banner);
    }
    if (isOnline) {
      banner.className = 'network-status-banner visible online';
      banner.innerHTML = `<span>🟢</span> <span>Internet connection restored.</span>`;
      setTimeout(() => {
        banner.classList.remove('visible');
      }, 3000);
    } else {
      banner.className = 'network-status-banner visible';
      banner.innerHTML = `<span>🔴</span> <span>You are currently offline. Please check your network connection.</span>`;
    }
  }

  function initNetworkMonitor() {
    window.addEventListener('online', () => showNetworkBanner(true));
    window.addEventListener('offline', () => showNetworkBanner(false));
  }

  // ── Expiry Banner on Login Page ──────────────────────────
  function checkSessionExpiryParam() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('expired')) {
      if (typeof API !== 'undefined' && API.toast) {
        API.toast('Your session has expired. Please sign in again.', 'warning', 5000);
      }
    }
  }

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initNetworkMonitor();
      checkSessionExpiryParam();
    });
  } else {
    initNetworkMonitor();
    checkSessionExpiryParam();
  }

  return {
    isRequired,
    isValidEmail,
    isValidPhone,
    validatePassword,
    isValidVehicleNumber,
    isValidLicense,
    isValidPositiveNumber,
    isFutureDate,
    showFieldError,
    clearFieldError,
    clearFormErrors,
    attachLiveValidation,
    createPasswordMeter,
    showNetworkBanner
  };
})();

// Attach globally
window.Validator = Validator;
