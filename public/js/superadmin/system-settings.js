// public/js/superadmin/system-settings.js
// Platform settings management, policy enforcement, currency parameters, and maintenance mode controls

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  initSystemSettings();
});

function initSystemSettings() {
  let initialSettings = null;

  // DOM Elements
  const form                = document.getElementById('settingsForm');
  const inputPlatformName   = document.getElementById('inputPlatformName');
  const inputSupportEmail   = document.getElementById('inputSupportEmail');
  const inputSupportPhone   = document.getElementById('inputSupportPhone');
  const inputOperatingCity  = document.getElementById('inputOperatingCity');
  const selectCurrency      = document.getElementById('selectCurrency');
  const inputCurrencySymbol = document.getElementById('inputCurrencySymbol');
  const inputCommissionPct  = document.getElementById('inputCommissionPct');
  const inputTaxPct         = document.getElementById('inputTaxPct');
  const inputMaxCancel      = document.getElementById('inputMaxCancellations');
  const inputBookingTimeout = document.getElementById('inputBookingTimeout');
  const inputSurgeMultiplier= document.getElementById('inputSurgeMultiplier');
  const inputSessionTimeout = document.getElementById('inputSessionTimeout');
  const toggleMaintenance   = document.getElementById('toggleMaintenanceMode');
  const bannerMaintenance   = document.getElementById('maintenanceAlertBanner');
  const statusIndicator     = document.getElementById('saveStatusIndicator');
  const commissionDisplay   = document.getElementById('commissionDisplay');
  const taxDisplay          = document.getElementById('taxDisplay');

  const btnReload           = document.getElementById('btnReloadSettings');
  const btnSaveTop          = document.getElementById('btnSaveSettings');
  const btnSubmit           = document.getElementById('btnSubmitSettings');
  const btnDiscard          = document.getElementById('btnDiscardChanges');
  const btnDeactivateMaint  = document.getElementById('btnDeactivateMaintenanceQuick');

  // Maintenance Modal Elements
  const maintenanceModal    = document.getElementById('maintenanceModal');
  const btnCloseMaintModal  = document.getElementById('btnCloseMaintenanceModal');
  const btnCancelMaint      = document.getElementById('btnCancelMaintenance');
  const btnConfirmMaint     = document.getElementById('btnConfirmMaintenance');

  const CURRENCY_SYMBOLS = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£'
  };

  // ── Load Settings from Server ──────────────────────────────────
  async function loadSettings() {
    if (statusIndicator) statusIndicator.textContent = 'Loading configuration…';

    try {
      const res = await API.get('/api/superadmin/settings');
      if (!res.ok || !res.success || !res.settings) {
        showToast(res.message || 'Failed to load system settings.', 'error');
        if (statusIndicator) statusIndicator.textContent = 'Error loading configuration';
        return;
      }

      initialSettings = res.settings;
      populateForm(initialSettings);

      if (statusIndicator) statusIndicator.textContent = 'Configuration in sync with server.';

    } catch (err) {
      console.error('[superadmin/settings/load]', err);
      showToast('Network error while retrieving settings.', 'error');
      if (statusIndicator) statusIndicator.textContent = 'Network error loading settings';
    }
  }

  function populateForm(s) {
    if (!s) return;

    if (inputPlatformName) inputPlatformName.value = s.platform_name || 'CabGo Transit Network';
    if (inputSupportEmail) inputSupportEmail.value = s.support_email || 'support@cabgo.com';
    if (inputSupportPhone) inputSupportPhone.value = s.support_phone || '+91 98765 43210';
    if (inputOperatingCity) inputOperatingCity.value = s.operating_city || 'Bengaluru, Karnataka';

    if (selectCurrency) selectCurrency.value = s.currency || 'INR';
    if (inputCurrencySymbol) inputCurrencySymbol.value = s.currency_symbol || '₹';

    if (inputCommissionPct) {
      inputCommissionPct.value = s.driver_commission_pct ?? 15;
      if (commissionDisplay) commissionDisplay.textContent = `${s.driver_commission_pct ?? 15}%`;
    }
    if (inputTaxPct) {
      inputTaxPct.value = s.tax_pct ?? 5;
      if (taxDisplay) taxDisplay.textContent = `${s.tax_pct ?? 5}%`;
    }

    if (inputMaxCancel) inputMaxCancel.value = s.max_cancellations ?? 3;
    if (inputBookingTimeout) inputBookingTimeout.value = s.booking_timeout_sec ?? 60;
    if (inputSurgeMultiplier) inputSurgeMultiplier.value = s.surge_multiplier_max ?? 2.5;
    if (inputSessionTimeout) inputSessionTimeout.value = s.session_timeout_hours ?? 24;

    const isMaint = Boolean(s.maintenance_mode);
    if (toggleMaintenance) toggleMaintenance.checked = isMaint;
    updateMaintenanceBanner(isMaint);
  }

  function updateMaintenanceBanner(isMaint) {
    if (bannerMaintenance) {
      bannerMaintenance.style.display = isMaint ? 'flex' : 'none';
    }
  }

  // ── Currency Symbol Auto-Fill ──────────────────────────────────
  selectCurrency?.addEventListener('change', () => {
    const code = selectCurrency.value;
    if (CURRENCY_SYMBOLS[code] && inputCurrencySymbol) {
      inputCurrencySymbol.value = CURRENCY_SYMBOLS[code];
    }
  });

  inputCommissionPct?.addEventListener('input', () => {
    if (commissionDisplay) commissionDisplay.textContent = `${inputCommissionPct.value || 0}%`;
  });

  inputTaxPct?.addEventListener('input', () => {
    if (taxDisplay) taxDisplay.textContent = `${inputTaxPct.value || 0}%`;
  });

  // ── Maintenance Mode Toggle & Confirmation Modal ───────────────
  toggleMaintenance?.addEventListener('change', (e) => {
    if (toggleMaintenance.checked) {
      // Prompt modal confirmation
      if (maintenanceModal) maintenanceModal.style.display = 'flex';
    } else {
      updateMaintenanceBanner(false);
    }
  });

  function closeMaintenanceModal() {
    if (maintenanceModal) maintenanceModal.style.display = 'none';
  }

  btnCloseMaintModal?.addEventListener('click', () => {
    toggleMaintenance.checked = false;
    closeMaintenanceModal();
  });

  btnCancelMaint?.addEventListener('click', () => {
    toggleMaintenance.checked = false;
    closeMaintenanceModal();
  });

  btnConfirmMaint?.addEventListener('click', () => {
    toggleMaintenance.checked = true;
    updateMaintenanceBanner(true);
    closeMaintenanceModal();
    showToast('Maintenance mode toggled ON. Remember to save configuration.', 'warning');
  });

  btnDeactivateMaint?.addEventListener('click', async () => {
    if (toggleMaintenance) toggleMaintenance.checked = false;
    updateMaintenanceBanner(false);
    await saveSettings({ maintenance_mode: false });
  });

  // ── Form Save Handler ──────────────────────────────────────────
  async function saveSettings(extraOverrides = {}) {
    setButtonLoading(btnSubmit, true, '💾 Save Settings');
    if (btnSaveTop) setButtonLoading(btnSaveTop, true, '💾 Save Configuration');
    if (statusIndicator) statusIndicator.textContent = 'Saving parameters…';

    const payload = {
      platform_name: inputPlatformName?.value.trim(),
      support_email: inputSupportEmail?.value.trim(),
      support_phone: inputSupportPhone?.value.trim(),
      operating_city: inputOperatingCity?.value.trim(),
      currency: selectCurrency?.value,
      currency_symbol: inputCurrencySymbol?.value.trim(),
      driver_commission_pct: parseFloat(inputCommissionPct?.value) || 0,
      tax_pct: parseFloat(inputTaxPct?.value) || 0,
      max_cancellations: parseInt(inputMaxCancel?.value, 10) || 3,
      booking_timeout_sec: parseInt(inputBookingTimeout?.value, 10) || 60,
      surge_multiplier_max: parseFloat(inputSurgeMultiplier?.value) || 2.5,
      session_timeout_hours: parseInt(inputSessionTimeout?.value, 10) || 24,
      maintenance_mode: toggleMaintenance?.checked ?? false,
      ...extraOverrides
    };

    try {
      const res = await API.put('/api/superadmin/settings', payload);
      if (!res.ok || !res.success) {
        showToast(res.message || 'Failed to update settings.', 'error');
        if (statusIndicator) statusIndicator.textContent = 'Failed to save settings.';
        return;
      }

      initialSettings = res.settings;
      populateForm(initialSettings);
      showToast('Platform settings saved successfully.', 'success');
      if (statusIndicator) statusIndicator.textContent = 'Configuration saved and active.';

    } catch (err) {
      console.error('[superadmin/settings/save]', err);
      showToast('Network error while saving settings.', 'error');
      if (statusIndicator) statusIndicator.textContent = 'Network error saving settings.';
    } finally {
      setButtonLoading(btnSubmit, false, '💾 Save Settings');
      if (btnSaveTop) setButtonLoading(btnSaveTop, false, '💾 Save Configuration');
    }
  }

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    saveSettings();
  });

  btnSaveTop?.addEventListener('click', (e) => {
    e.preventDefault();
    if (form.reportValidity()) {
      saveSettings();
    }
  });

  btnReload?.addEventListener('click', () => {
    loadSettings();
    showToast('Settings reloaded from server.', 'info');
  });

  btnDiscard?.addEventListener('click', () => {
    if (initialSettings) {
      populateForm(initialSettings);
      showToast('Unsaved changes discarded.', 'info');
      if (statusIndicator) statusIndicator.textContent = 'Unsaved changes reverted.';
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

  // Initial load
  loadSettings();
}
