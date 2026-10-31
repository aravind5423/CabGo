import clsx from 'clsx';
import { CheckCircle2, AlertCircle, Info, Sparkles, TrendingUp, TrendingDown } from 'lucide-react';

/* ─── KPI Card ───────────────────────────────────────────────────── */
export function KPICard({
  label,
  value,
  icon: Icon,
  gradient = 'linear-gradient(135deg,#16A34A,#15803D)',
  iconClass = 'text-white',
  trend,
  trendLabel,
  accentBg = false,
}) {
  const isPositive = trend !== undefined && trend >= 0;

  return (
    <div
      className={clsx(
        'card card-hover p-5 flex flex-col justify-between group relative overflow-hidden transition-all duration-300',
        accentBg && 'border-emerald-500/30 bg-gradient-to-br from-white to-emerald-50/40'
      )}
    >
      {/* Subtle background ambient glow */}
      <div
        className="absolute -right-8 -bottom-8 w-24 h-24 rounded-full opacity-10 blur-xl pointer-events-none transition-all duration-500 group-hover:scale-150 group-hover:opacity-20"
        style={{ background: gradient }}
      />

      <div className="flex items-start justify-between relative z-10">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
        {Icon && (
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md flex-shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
            style={{ background: gradient }}
          >
            <Icon size={18} className={iconClass} />
          </div>
        )}
      </div>

      <div className="mt-3 relative z-10">
        <div className="text-[28px] font-extrabold text-slate-900 tracking-tight leading-none">
          {value}
        </div>

        {(trend !== undefined || trendLabel) && (
          <div className="flex items-center gap-1.5 mt-2.5 text-xs font-semibold">
            {trend !== undefined && (
              <span
                className={clsx(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold',
                  isPositive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                )}
              >
                {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {isPositive ? '+' : ''}{trend}%
              </span>
            )}
            {trendLabel && <span className="text-slate-400 font-medium text-[11px]">{trendLabel}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Status Badge ───────────────────────────────────────────────── */
const STATUS_MAP = {
  completed:   { dot: '#16A34A', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/60', label: 'Completed' },
  cancelled:   { dot: '#EF4444', bg: 'bg-rose-50 text-rose-700 border-rose-200/60',       label: 'Cancelled' },
  pending:     { dot: '#F59E0B', bg: 'bg-amber-50 text-amber-700 border-amber-200/60',     label: 'Pending' },
  accepted:    { dot: '#2563EB', bg: 'bg-blue-50 text-blue-700 border-blue-200/60',         label: 'Accepted' },
  in_progress: { dot: '#10B981', bg: 'bg-emerald-50 text-emerald-800 border-emerald-300',   label: 'In Progress', pulse: true },
  online:      { dot: '#10B981', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',   label: 'Online', pulse: true },
  offline:     { dot: '#94A3B8', bg: 'bg-slate-100 text-slate-600 border-slate-200',        label: 'Offline' },
  active:      { dot: '#10B981', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',   label: 'Active' },
  inactive:    { dot: '#94A3B8', bg: 'bg-slate-100 text-slate-600 border-slate-200',        label: 'Inactive' },
  approved:    { dot: '#16A34A', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',   label: 'Approved' },
  rejected:    { dot: '#EF4444', bg: 'bg-rose-50 text-rose-700 border-rose-200',           label: 'Rejected' },
};

export function StatusBadge({ status, className }) {
  const normalized = status ? status.toLowerCase() : '';
  const cfg = STATUS_MAP[normalized] || {
    dot: '#94A3B8',
    bg: 'bg-slate-100 text-slate-600 border-slate-200',
    label: status || 'Unknown',
  };

  return (
    <span
      className={clsx(
        'badge inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border shadow-sm',
        cfg.bg,
        className
      )}
    >
      <span className="relative flex h-2 w-2">
        {cfg.pulse && (
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ backgroundColor: cfg.dot }}
          />
        )}
        <span
          className="relative inline-flex rounded-full h-2 w-2"
          style={{ backgroundColor: cfg.dot }}
        />
      </span>
      {cfg.label}
    </span>
  );
}

/* ─── Empty State ────────────────────────────────────────────────── */
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center px-4 animate-fade-in">
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mb-3 shadow-inner border border-slate-200/60">
          <Icon size={28} className="text-slate-400" />
        </div>
      )}
      <div className="text-base font-bold text-slate-900">{title}</div>
      {description && <p className="text-sm text-slate-500 max-w-sm mt-1 leading-relaxed">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ─── Skeleton ───────────────────────────────────────────────────── */
export function Skeleton({ className }) {
  return <div className={clsx('skeleton rounded-xl', className)} />;
}

export function SkeletonCard() {
  return (
    <div className="card p-5 space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

/* ─── Toast ──────────────────────────────────────────────────────── */
export function Toast({ message, type = 'success' }) {
  if (!message) return null;

  const icons = {
    success: <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />,
    error:   <AlertCircle size={16} className="text-rose-400 flex-shrink-0" />,
    info:    <Info size={16} className="text-blue-400 flex-shrink-0" />,
  };

  const borderColors = {
    success: 'border-l-emerald-500',
    error:   'border-l-rose-500',
    info:    'border-l-blue-500',
  };

  return (
    <div className="fixed top-5 right-5 z-[100] animate-slide-in">
      <div
        className={clsx(
          'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold shadow-2xl min-w-[280px] bg-slate-900 text-white border border-slate-800 border-l-4 backdrop-blur-md',
          borderColors[type] || borderColors.success
        )}
      >
        {icons[type] || icons.success}
        <span className="flex-1">{message}</span>
      </div>
    </div>
  );
}

/* ─── Section Header ─────────────────────────────────────────────── */
export function SectionHeader({ title, description, action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h2>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      {action && <div>{action}</div>}
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
