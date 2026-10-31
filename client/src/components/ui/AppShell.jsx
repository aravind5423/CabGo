import { useState } from 'react';
import Sidebar from './Sidebar';
import Topnav from './Topnav';

/**
 * AppShell — layout wrapper for authenticated routes (sidebar + top bar + content).
 */
export default function AppShell({ title, subtitle, action, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F6F8FA]">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex flex-col min-h-screen lg:pl-[248px]">
        <Topnav title={title} subtitle={subtitle} action={action} onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 animate-page-in">
          {children}
        </main>
      </div>
    </div>
  );
}
