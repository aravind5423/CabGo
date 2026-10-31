import { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

/* ─── Tone palette shared by KPI cards & icon chips ──────────── */
const TONES = {
  brand: 'bg-emerald-50 text-emerald-700',
  blue:  'bg-blue-50 text-blue-700',
  amber: 'bg-amber-50 text-amber-700',
  rose:  'bg-rose-50 text-rose-700',
  slate: 'bg-slate-100 text-slate-600',
  violet:'bg-violet-50 text-violet-700',
};

export function IconChip({ icon: Icon, tone = 'brand', size = 'md', className }) {
  const dims = size === 'sm' ? 'w-8 h-8 rounded-lg' : size === 'lg' ? 'w-12 h-12 rounded-xl' : 'w-10 h-10 rounded-xl';
  const iconSize = size === 'sm' ? 15 : size === 'lg' ? 22 : 18;
  return (
    <div className={clsx('flex items-center justify-center flex-shrink-0', dims, TONES[tone] || TONES.brand, className)}>
      {Icon && <Icon size={iconSize} />}
    </div>
  );
}

/* ─── KPI Card ───────────────────────────────────────────────── */
export function KPICard({ label, value, icon, tone = 'brand', hint }) {
  return (
    <div className="card p-5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-xs font-medium text-slate-500">{label}</div>
        <div className="text-[26px] font-semibold text-slate-900 tracking-tight leading-tight mt-1.5 truncate">{value}</div>
        {hint && <div className="text-xs text-slate-400 mt-1">{hint}</div>}
      </div>
      {icon && <IconChip icon={icon} tone={tone} />}
    </div>
  );
}

/* ─── Status Badge ───────────────────────────────────────────── */
const STATUS_MAP = {
  completed:   { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: '#16A34A', label: 'Completed' },
  cancelled:   { cls: 'bg-rose-50 text-rose-700 border-rose-200',          dot: '#DC2626', label: 'Cancelled' },
  rejected:    { cls: 'bg-rose-50 text-rose-700 border-rose-200',          dot: '#DC2626', label: 'Rejected' },
  pending:     { cls: 'bg-amber-50 text-amber-700 border-amber-200',       dot: '#D97706', label: 'Pending' },
  accepted:    { cls: 'bg-blue-50 text-blue-700 border-blue-200',          dot: '#2563EB', label: 'Accepted' },
  in_progress: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: '#16A34A', label: 'In progress', live: true },
  online:      { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: '#16A34A', label: 'Online', live: true },
  offline:     { cls: 'bg-slate-100 text-slate-600 border-slate-200',      dot: '#94A3B8', label: 'Offline' },
  active:      { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: '#16A34A', label: 'Active' },
  inactive:    { cls: 'bg-slate-100 text-slate-600 border-slate-200',      dot: '#94A3B8', label: 'Inactive' },
  blocked:     { cls: 'bg-rose-50 text-rose-700 border-rose-200',          dot: '#DC2626', label: 'Blocked' },
  approved:    { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: '#16A34A', label: 'Approved' },
  failed:      { cls: 'bg-rose-50 text-rose-700 border-rose-200',          dot: '#DC2626', label: 'Failed' },
  refunded:    { cls: 'bg-violet-50 text-violet-700 border-violet-200',    dot: '#7C3AED', label: 'Refunded' },
};

export function StatusBadge({ status, className }) {
  const key = status ? String(status).toLowerCase() : '';
  const cfg = STATUS_MAP[key] || { cls: 'bg-slate-100 text-slate-600 border-slate-200', dot: '#94A3B8', label: status || 'Unknown' };
  return (
    <span className={clsx('badge', cfg.cls, className)}>
      <span className={clsx(cfg.live && 'live-dot')} style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.dot, display: 'inline-block' }} />
      {cfg.label}
    </span>
  );
}

/* ─── Empty State ────────────────────────────────────────────── */
export function EmptyState({ icon: Icon, title, description, action, compact = false }) {
  return (
    <div className={clsx('flex flex-col items-center justify-center text-center px-4', compact ? 'py-8' : 'py-14')}>
      {Icon && (
        <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
          <Icon size={22} />
        </div>
      )}
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      {description && <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ─── Skeleton ───────────────────────────────────────────────── */
export function Skeleton({ className }) {
  return <div className={clsx('skeleton', className)} />;
}

export function SkeletonRows({ rows = 3 }) {
  return (
    <div className="p-5 space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="w-9 h-9 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonKPIs({ count = 4 }) {
  return Array.from({ length: count }).map((_, i) => (
    <div key={i} className="card p-5 space-y-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-20" />
    </div>
  ));
}

/* ─── Toast ──────────────────────────────────────────────────── */
export function useToast(duration = 3200) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const show = useCallback((message, type = 'success') => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, type });
    timer.current = setTimeout(() => setToast(null), duration);
  }, [duration]);
  useEffect(() => () => timer.current && clearTimeout(timer.current), []);
  return [toast, show];
}

export function Toast({ toast }) {
  if (!toast?.message) return null;
  const { message, type = 'success' } = toast;
  const icons = {
    success: <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />,
    error:   <AlertCircle size={16} className="text-rose-400 flex-shrink-0" />,
    info:    <Info size={16} className="text-blue-400 flex-shrink-0" />,
  };
  return (
    <div className="fixed top-4 right-4 z-[100] animate-slide-in" role="status">
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium shadow-lg min-w-[260px] max-w-sm bg-slate-900 text-white">
        {icons[type] || icons.success}
        <span className="flex-1">{message}</span>
      </div>
    </div>
  );
}

/* ─── Inline alert ───────────────────────────────────────────── */
export function Alert({ type = 'info', children, className }) {
  const styles = {
    info:    'bg-blue-50 border-blue-200 text-blue-800',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    error:   'bg-rose-50 border-rose-200 text-rose-800',
  };
  const icons = { info: Info, success: CheckCircle2, warning: AlertCircle, error: AlertCircle };
  const Icon = icons[type] || Info;
  return (
    <div className={clsx('flex items-start gap-2.5 px-4 py-3 rounded-xl border text-sm animate-fade-in', styles[type], className)}>
      <Icon size={16} className="flex-shrink-0 mt-0.5" />
      <div className="flex-1">{children}</div>
    </div>
  );
}

/* ─── Tabs ───────────────────────────────────────────────────── */
export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(({ id, label, icon: Icon, count }) => (
        <button
          key={id}
          role="tab"
          aria-selected={value === id}
          onClick={() => onChange(id)}
          className={clsx('tab', value === id && 'active')}
        >
          {Icon && <Icon size={14} />}
          {label}
          {count !== undefined && count !== null && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-200/80 text-slate-700 text-[10px] font-bold leading-none">
              {count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ─── Modal ──────────────────────────────────────────────────── */
export function Modal({ open, title, description, onClose, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const width = size === 'lg' ? 'max-w-2xl' : size === 'sm' ? 'max-w-sm' : 'max-w-md';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 animate-fade-in" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={clsx('card w-full p-6 shadow-xl animate-slide-in', width)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
          </div>
          <button onClick={onClose} className="btn-ghost btn-sm -mr-2 -mt-1" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        {children}
        {footer && <div className="flex justify-end gap-2 pt-5 mt-5 border-t border-slate-100">{footer}</div>}
      </div>
    </div>
  );
}

/* ─── Section Header ─────────────────────────────────────────── */
export function SectionHeader({ title, description, action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

/* ─── Spinner ────────────────────────────────────────────────── */
export function Spinner({ size = 18, className }) {
  return (
    <svg className={clsx('animate-spin', className)} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

/* ─── Route label (pickup → destination) ─────────────────────── */
export function RouteLabel({ pickup, destination, className }) {
  return (
    <div className={clsx('min-w-0', className)}>
      <div className="flex items-center gap-2 text-[13px] text-slate-900 font-medium">
        <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
        <span className="truncate">{pickup || '—'}</span>
      </div>
      <div className="flex items-center gap-2 text-[13px] text-slate-600 mt-1">
        <span className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" />
        <span className="truncate">{destination || '—'}</span>
      </div>
    </div>
  );
}
