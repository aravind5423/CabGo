import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import clsx from 'clsx';
import {
  LayoutDashboard, Car, History, User, MapPin, DollarSign,
  LogOut, ShieldCheck, Activity, Zap, ChevronRight
} from 'lucide-react';

const NAV_CONFIG = {
  passenger: [
    { to: '/passenger/dashboard',   label: 'Dashboard',    icon: LayoutDashboard },
    { to: '/passenger/book-ride',   label: 'Book a Ride',  icon: MapPin },
    { to: '/passenger/active-trip', label: 'Active Trip',  icon: Car },
    { to: '/passenger/history',     label: 'Trip History', icon: History },
    { to: '/passenger/profile',     label: 'My Profile',   icon: User },
  ],
  driver: [
    { to: '/driver/dashboard',  label: 'Dashboard',   icon: LayoutDashboard },
    { to: '/driver/vehicles',   label: 'My Vehicles', icon: Car },
    { to: '/driver/earnings',   label: 'Earnings',    icon: DollarSign },
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
  passenger:  { label: 'Passenger',   color: '#2563EB', bg: 'rgba(37,99,235,0.15)' },
  driver:     { label: 'Driver',      color: '#16A34A', bg: 'rgba(22,163,74,0.15)' },
  admin:      { label: 'Ops Admin',   color: '#D97706', bg: 'rgba(217,119,6,0.15)' },
  superadmin: { label: 'Super Admin', color: '#DC2626', bg: 'rgba(220,38,38,0.15)' },
};

export default function Sidebar({ mobileOpen, onClose }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [hoveredLink, setHoveredLink] = useState(null);

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
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          style={{ animation: 'float-up 0.2s ease' }}
        />
      )}

      <aside
        className={clsx(
          'fixed top-0 left-0 h-full z-40 flex flex-col w-[256px]',
          'transition-transform duration-300 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
        style={{
          background: 'linear-gradient(180deg, #0A0F1E 0%, #0D1426 60%, #0A1020 100%)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Subtle top glow */}
        <div
          className="absolute top-0 left-0 right-0 h-[1px]"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(22,163,74,0.4), transparent)' }}
        />

        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-16 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0 relative bg-slate-900 border border-slate-700/60"
            style={{ boxShadow: '0 0 16px rgba(0,0,0,0.5)' }}
          >
            <Car size={18} className="text-white" />
          </div>
          <div>
            <div className="text-[16px] font-black text-white tracking-tight leading-tight">Rydio</div>
            <div className="text-[9px] leading-tight font-bold" style={{ color: 'rgba(148,163,184,0.6)', letterSpacing: '0.08em' }}>URBAN TRANSIT</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-0.5">
          {/* Role label */}
          <div className="px-3 mb-3 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(100,116,139,0.7)' }}>
            {meta.label} Menu
          </div>

          {links.map(({ to, label, icon: Icon }, i) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => clsx('sidebar-link', isActive && 'active')}
              onClick={onClose}
              onMouseEnter={() => setHoveredLink(to)}
              onMouseLeave={() => setHoveredLink(null)}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <Icon size={16} className="flex-shrink-0" />
              <span className="flex-1">{label}</span>
              <ChevronRight
                size={13}
                className="flex-shrink-0 transition-all duration-200"
                style={{ opacity: hoveredLink === to ? 0.7 : 0, transform: hoveredLink === to ? 'translateX(0)' : 'translateX(-4px)' }}
              />
            </NavLink>
          ))}
        </nav>

        {/* Bottom gradient separator */}
        <div className="mx-3" style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)' }} />

        {/* User card */}
        <div className="p-3 pb-4 flex-shrink-0">
          <div
            className="flex items-center gap-3 p-3 rounded-xl cursor-default group transition-all duration-200"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div
              className="w-9 h-9 rounded-xl font-bold text-sm text-white flex items-center justify-center flex-shrink-0"
              style={{
                background: `linear-gradient(135deg, ${meta.color || '#16A34A'}, ${meta.color || '#15803D'})`,
                boxShadow: `0 0 12px ${meta.bg || 'rgba(22,163,74,0.3)'}`,
              }}
            >
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white truncate leading-tight">{user?.name}</div>
              <div
                className="text-[10px] font-semibold mt-0.5 px-1.5 py-0.5 rounded inline-block"
                style={{ color: meta.color, background: meta.bg, letterSpacing: '0.03em' }}
              >
                {meta.label}
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="p-1.5 rounded-lg transition-all duration-200 flex-shrink-0"
              style={{ color: '#475569' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(248,113,113,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.background = 'transparent'; }}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
