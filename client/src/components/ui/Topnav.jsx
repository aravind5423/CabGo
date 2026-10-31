import { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';

export default function Topnav({ title, subtitle, action, onMenuClick }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(tick);
  }, []);

  const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const day  = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <header className="h-16 flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 flex-shrink-0 sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200">
      <div className="flex items-center gap-3 min-w-0">
        <button
          className="lg:hidden btn-ghost btn-sm -ml-2"
          onClick={onMenuClick}
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>
        <div className="min-w-0">
          <h1 className="text-[15px] font-semibold text-slate-900 leading-tight truncate">{title}</h1>
          {subtitle && <div className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</div>}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        {action}
        <div className="hidden sm:block text-right leading-tight">
          <div className="text-[13px] font-semibold text-slate-900 tabular-nums">{time}</div>
          <div className="text-[11px] text-slate-400">{day}</div>
        </div>
      </div>
    </header>
  );
}
