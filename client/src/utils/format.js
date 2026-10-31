// Shared formatting helpers for dates, money and distances.

const DATE_TIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value) ? null : value;
  let str = String(value);
  // MySQL "YYYY-MM-DD HH:MM:SS" is not a valid ISO string everywhere.
  if (DATE_TIME_RE.test(str)) str = str.replace(' ', 'T');
  const d = new Date(str);
  return isNaN(d) ? null : d;
}

export function formatDate(value, { withTime = true } = {}) {
  const d = toDate(value);
  if (!d) return '—';
  const opts = withTime
    ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: 'numeric', month: 'short', year: 'numeric' };
  return d.toLocaleString('en-IN', opts);
}

export function formatTime(value) {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(value) {
  const d = toDate(value);
  if (!d) return '';
  const diff = Math.max(0, Date.now() - d.getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const days = Math.floor(h / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

export function formatCurrency(value, { decimals } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '₹0';
  const useDecimals = decimals ?? (Number.isInteger(n) ? 0 : 2);
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: useDecimals, maximumFractionDigits: useDecimals })}`;
}

export function formatDistance(km) {
  const n = Number(km);
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(1)} km`;
}

export function capitalize(str) {
  if (!str) return '';
  return String(str).charAt(0).toUpperCase() + String(str).slice(1).replace(/_/g, ' ');
}

export function initials(name) {
  if (!name) return '?';
  return String(name).trim().charAt(0).toUpperCase();
}
