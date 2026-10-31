import { useState } from 'react';
import Sidebar from './Sidebar';
import Topnav from './Topnav';

/**
 * AppShell — the main layout wrapper for all authenticated pages.
 * Usage: <AppShell title="Dashboard" action={<SomeButton/>}>...</AppShell>
 */
export default function AppShell({ title, subtitle, action, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-canvas overflow-hidden">
      {/* Sidebar (fixed left) */}
      <Sidebar
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      {/* Main content (offset by sidebar on large screens) */}
      <div className="flex flex-col flex-1 min-w-0 lg:ml-[240px]">
        <Topnav
          title={title}
          subtitle={subtitle}
          action={action}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
