import { useState } from 'react';
import { Menu, Bell, Search } from 'lucide-react';

export default function Topnav({ title, subtitle, action, onMenuClick }) {
  return (
    <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-line flex-shrink-0 sticky top-0 z-20">
      {/* Left: mobile menu + title */}
      <div className="flex items-center gap-3">
        <button
          className="lg:hidden p-2 rounded-lg text-ink-muted hover:bg-canvas transition"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <div>
          <h1 className="text-[17px] font-bold text-ink leading-tight">{title}</h1>
          {subtitle && <p className="text-xs text-ink-muted">{subtitle}</p>}
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2">
        {action && action}
        <button className="p-2 rounded-xl border border-line text-ink-muted hover:text-ink hover:bg-canvas transition hidden sm:flex">
          <Bell size={17} />
        </button>
      </div>
    </header>
  );
}
