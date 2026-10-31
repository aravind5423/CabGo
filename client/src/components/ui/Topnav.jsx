import { useState, useEffect } from 'react';
import { Menu, Bell, ChevronRight } from 'lucide-react';

export default function Topnav({ title, subtitle, action, onMenuClick }) {
  const [time, setTime] = useState(new Date());
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Entry animation
    const t = setTimeout(() => setVisible(true), 50);
    const tick = setInterval(() => setTime(new Date()), 1000);
    return () => { clearTimeout(t); clearInterval(tick); };
  }, []);

  const fmt = time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  const day = time.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <header
      className="h-16 flex items-center justify-between px-6 flex-shrink-0 sticky top-0 z-20"
      style={{
        background: 'rgba(248,250,252,0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(226,232,240,0.8)',
        boxShadow: '0 1px 0 rgba(15,23,42,0.04)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-8px)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
      }}
    >
      {/* Left: mobile menu + breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          className="lg:hidden p-2 rounded-xl transition-all duration-200"
          style={{ color: '#64748B' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2">
          <div>
            <h1
              className="font-semibold leading-tight tracking-tight"
              style={{ fontSize: '16px', color: '#0F172A' }}
            >
              {title}
            </h1>
            {subtitle && <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{subtitle}</p>}
          </div>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2.5">
        {/* Live clock */}
        <div
          className="hidden sm:flex flex-col items-end text-right px-3 py-1.5 rounded-xl"
          style={{ background: '#F1F5F9' }}
        >
          <span className="text-[13px] font-bold tabular-nums" style={{ color: '#0F172A', letterSpacing: '-0.01em' }}>{fmt}</span>
          <span className="text-[10px]" style={{ color: '#94A3B8' }}>{day}</span>
        </div>

        {/* Action */}
        {action && action}

        {/* Bell */}
        <button
          className="relative p-2.5 rounded-xl transition-all duration-200"
          style={{ border: '1.5px solid #E2E8F0', color: '#64748B', background: '#fff' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.background = '#F8FAFC'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = '#fff'; }}
        >
          <Bell size={16} />
          <span
            className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
            style={{ background: '#16A34A', boxShadow: '0 0 6px rgba(22,163,74,0.6)' }}
          />
        </button>
      </div>
    </header>
  );
}
