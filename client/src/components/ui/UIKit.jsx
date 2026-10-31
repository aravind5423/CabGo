import clsx from 'clsx';

/* ─── KPI Card ───────────────────────────────────────────────────── */
export function KPICard({ label, value, icon: Icon, iconClass = 'text-brand', trend, trendLabel, accentBg = false }) {
  return (
    <div className={clsx('card-sm p-5 flex flex-col gap-3', accentBg && 'bg-brand-50 border-brand/20')}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-ink-muted uppercase tracking-wide">{label}</span>
        {Icon && (
          <span className={clsx('w-9 h-9 rounded-xl flex items-center justify-center', accentBg ? 'bg-white' : 'bg-canvas')}>
            <Icon size={18} className={iconClass} />
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-ink leading-none">{value}</div>
      {(trend !== undefined || trendLabel) && (
        <div className="flex items-center gap-1.5 text-xs font-medium">
          {trend !== undefined && (
            <span className={clsx('flex items-center gap-0.5', trend >= 0 ? 'text-success' : 'text-error')}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </span>
          )}
          {trendLabel && <span className="text-ink-faint">{trendLabel}</span>}
        </div>
      )}
    </div>
  );
}

/* ─── Status Badge ───────────────────────────────────────────────── */
const STATUS_MAP = {
  completed:   { bg: 'bg-success-bg text-success',   label: 'Completed' },
  cancelled:   { bg: 'bg-error-bg text-error',       label: 'Cancelled' },
  pending:     { bg: 'bg-warning-bg text-warning',   label: 'Pending' },
  accepted:    { bg: 'bg-info-bg text-info',         label: 'Accepted' },
  in_progress: { bg: 'bg-brand-light text-brand',    label: 'In Progress' },
  online:      { bg: 'bg-success-bg text-success',   label: 'Online' },
  offline:     { bg: 'bg-[#F3F4F6] text-ink-muted',  label: 'Offline' },
  active:      { bg: 'bg-success-bg text-success',   label: 'Active' },
  inactive:    { bg: 'bg-[#F3F4F6] text-ink-muted',  label: 'Inactive' },
};

export function StatusBadge({ status, className }) {
  const cfg = STATUS_MAP[status?.toLowerCase()] || { bg: 'bg-[#F3F4F6] text-ink-muted', label: status };
  return (
    <span className={clsx('badge', cfg.bg, className)}>
      {cfg.label}
    </span>
  );
}

/* ─── Empty State ────────────────────────────────────────────────── */
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-canvas flex items-center justify-center mb-1">
          <Icon size={26} className="text-ink-faint" />
        </div>
      )}
      <div className="text-base font-semibold text-ink">{title}</div>
      {description && <p className="text-sm text-ink-muted max-w-xs">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ─── Skeleton / Loading ─────────────────────────────────────────── */
export function Skeleton({ className }) {
  return <div className={clsx('animate-pulse rounded-xl bg-[#F3F4F6]', className)} />;
}

export function SkeletonCard() {
  return (
    <div className="card-sm p-5 space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

/* ─── Toast ──────────────────────────────────────────────────────── */
export function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="fixed top-4 right-4 z-[100] animate-slide-in">
      <div className="card-sm px-4 py-3 text-sm font-medium text-ink shadow-lg min-w-[240px]">
        {message}
      </div>
    </div>
  );
}

/* ─── Section Header ─────────────────────────────────────────────── */
export function SectionHeader({ title, description, action }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description && <p className="text-sm text-ink-muted mt-0.5">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/* ─── Loading Spinner ────────────────────────────────────────────── */
export function Spinner({ size = 20, className }) {
  return (
    <svg
      className={clsx('animate-spin', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
