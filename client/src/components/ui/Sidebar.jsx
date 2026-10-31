import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import clsx from 'clsx';
import {
  LayoutDashboard, Car, History, User, MapPin, DollarSign,
  LogOut, Settings, ShieldCheck, Users, Activity, ChevronRight,
  Zap
} from 'lucide-react';

/* ─── Navigation config per role ────────────────────────────────── */

const NAV_CONFIG = {
  passenger: [
    { to: '/passenger/dashboard',   label: 'Dashboard',     icon: LayoutDashboard },
    { to: '/passenger/book-ride',   label: 'Book a Ride',   icon: MapPin },
    { to: '/passenger/active-trip', label: 'Active Trip',   icon: Car },
    { to: '/passenger/history',     label: 'Trip History',  icon: History },
    { to: '/passenger/profile',     label: 'My Profile',    icon: User },
  ],
  driver: [
    { to: '/driver/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
    { to: '/driver/vehicles',   label: 'My Vehicles', icon: Car },
    { to: '/driver/earnings',   label: 'Earnings',   icon: DollarSign },
  ],
  admin: [
    { to: '/admin/dashboard', label: 'Operations',  icon: Activity },
  ],
  superadmin: [
    { to: '/superadmin/dashboard', label: 'Control Panel', icon: ShieldCheck },
    { to: '/admin/dashboard',      label: 'Operations',     icon: Activity },
  ],
};

const ROLE_META = {
  passenger:  { label: 'Passenger',    color: 'bg-info-bg text-info' },
  driver:     { label: 'Driver',       color: 'bg-success-bg text-success' },
  admin:      { label: 'Ops Admin',    color: 'bg-warning-bg text-warning' },
  superadmin: { label: 'Super Admin',  color: 'bg-error-bg text-error' },
};

/* ─── Sidebar ────────────────────────────────────────────────────── */

export default function Sidebar({ mobileOpen, onClose }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const role = user?.role || 'passenger';
  const links = NAV_CONFIG[role] || [];
  const meta = ROLE_META[role] || {};

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch (_) {}
    logout();
    navigate('/login');
  };

  const initial = user?.name?.[0]?.toUpperCase() || '?';

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={clsx(
          'fixed top-0 left-0 h-full z-40 flex flex-col',
          'bg-white border-r border-line',
          'transition-transform duration-300 ease-in-out',
          'w-[240px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-line flex-shrink-0">
          <div className="w-8 h-8 rounded-xl bg-brand flex items-center justify-center shadow-sm flex-shrink-0">
            <Zap size={16} className="text-white" />
          </div>
          <span className="text-[15px] font-bold text-ink tracking-tight">CabGo</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx('sidebar-link', isActive && 'active')
              }
              onClick={onClose}
            >
              <Icon size={17} className="flex-shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Bottom: user card */}
        <div className="px-3 py-4 border-t border-line flex-shrink-0">
          <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-canvas transition cursor-default">
            <div className="w-9 h-9 rounded-xl bg-brand-light text-brand font-bold text-sm flex items-center justify-center flex-shrink-0">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-ink truncate">{user?.name}</div>
              <span className={clsx('badge text-[11px]', meta.color)}>{meta.label}</span>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="p-1.5 rounded-lg text-ink-faint hover:text-error hover:bg-error-bg transition flex-shrink-0"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
