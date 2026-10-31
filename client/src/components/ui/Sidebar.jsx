import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import { initials } from '../../utils/format';
import clsx from 'clsx';
import {
  LayoutDashboard, Car, History, User, MapPin, Wallet,
  LogOut, ShieldCheck, Activity, X
} from 'lucide-react';

const NAV_CONFIG = {
  passenger: [
    { to: '/passenger/dashboard',   label: 'Dashboard',    icon: LayoutDashboard },
    { to: '/passenger/book-ride',   label: 'Book a Ride',  icon: MapPin },
    { to: '/passenger/active-trip', label: 'Active Trip',  icon: Car },
    { to: '/passenger/history',     label: 'Trip History', icon: History },
    { to: '/passenger/profile',     label: 'Profile',      icon: User },
  ],
  driver: [
    { to: '/driver/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/driver/vehicles',  label: 'Vehicles',  icon: Car },
    { to: '/driver/earnings',  label: 'Earnings',  icon: Wallet },
  ],
  admin: [
    { to: '/admin/dashboard', label: 'Operations', icon: Activity },
  ],
  superadmin: [
    { to: '/superadmin/dashboard', label: 'Control Panel', icon: ShieldCheck },
    { to: '/admin/dashboard',      label: 'Operations',    icon: Activity },
  ],
};

const ROLE_META = {
  passenger:  { label: 'Passenger',   color: '#3B82F6' },
  driver:     { label: 'Driver',      color: '#16A34A' },
  admin:      { label: 'Ops Admin',   color: '#D97706' },
  superadmin: { label: 'Super Admin', color: '#DC2626' },
};

export default function Sidebar({ mobileOpen, onClose }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const role  = user?.role || 'passenger';
  const links = NAV_CONFIG[role] || [];
  const meta  = ROLE_META[role] || ROLE_META.passenger;

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch { /* stateless */ }
    logout();
    navigate('/login');
  };

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden animate-fade-in" onClick={onClose} />
      )}

      <aside
        className={clsx(
          'fixed top-0 left-0 h-full z-40 flex flex-col w-[248px] bg-[#0B1120] border-r border-white/5',
          'transition-transform duration-200 ease-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Brand */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <Car size={16} className="text-white" />
            </div>
            <div>
              <div className="text-[15px] font-semibold text-white leading-tight">Rydio</div>
              <div className="text-[10px] text-slate-500 font-medium tracking-wide leading-tight">URBAN TRANSIT</div>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white p-1" aria-label="Close navigation">
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {meta.label}
          </div>
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) => clsx('sidebar-link', isActive && 'active')}
            >
              <Icon size={16} className="flex-shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-white/5">
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.04]">
            <div
              className="w-9 h-9 rounded-lg text-white text-sm font-semibold flex items-center justify-center flex-shrink-0"
              style={{ background: meta.color }}
            >
              {initials(user?.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-white truncate leading-tight">{user?.name}</div>
              <div className="text-[11px] text-slate-400 truncate">{user?.email}</div>
            </div>
            <button
              onClick={handleLogout}
              title="Log out"
              aria-label="Log out"
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
