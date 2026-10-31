import { useState } from 'react';
import Sidebar from './Sidebar';
import Topnav from './Topnav';

/**
 * AppShell — main layout wrapper for authenticated routes.
 */
export default function AppShell({ title, subtitle, action, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      {/* Sidebar (fixed left) */}
      <Sidebar
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      {/* Main content container */}
      <div className="flex flex-col flex-1 min-w-0 lg:ml-[256px]">
        <Topnav
          title={title}
          subtitle={subtitle}
          action={action}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 animate-page-in">
          {children}
        </main>
      </div>
    </div>
  );
}
