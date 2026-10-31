import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import { Zap, Eye, EyeOff, Loader2, ShieldCheck, Car, User, Activity, Sparkles, Navigation } from 'lucide-react';
import clsx from 'clsx';

const QUICK_LOGINS = [
  { label: 'Super Admin', email: 'superadmin', password: 'password123', color: 'text-rose-400 bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/20',     icon: ShieldCheck },
  { label: 'Ops Admin',   email: 'admin1',     password: 'password123', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20', icon: Activity },
  { label: 'Driver',      email: 'driver1',    password: 'password123', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20', icon: Car },
  { label: 'Passenger',   email: 'passenger1', password: 'password123', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20',           icon: User },
];

const FEATURES = [
  { icon: Sparkles, title: 'Intelligent Dynamic Pricing', desc: 'Real-time fare calculation with live routing' },
  { icon: Navigation, title: 'Live Radar GPS Tracking', desc: 'Socket.IO & SSE telemetry synchronization' },
  { icon: ShieldCheck, title: 'Enterprise Access Control', desc: 'Secure RBAC for Passenger, Driver, Admin & SuperAdmin' },
];

export default function Login() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [tab, setTab] = useState('login');
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', mobile: '', role: 'passenger' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const ROLE_PATHS = {
    passenger: '/passenger/dashboard',
    driver: '/driver/dashboard',
    admin: '/admin/dashboard',
    superadmin: '/superadmin/dashboard',
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleLogin = async (e, creds = null) => {
    if (e?.preventDefault) e.preventDefault();
    setLoading(true);
    setError('');
    const email = creds?.email ?? form.email;
    const password = creds?.password ?? form.password;
    try {
      const { data } = await api.post('/auth/login', { email, password });
      login(data.token, data.user);
      navigate(ROLE_PATHS[data.user.role] || '/login');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillAndLogin = (email, password) => {
    setForm((p) => ({ ...p, email, password }));
    setError('');
    handleLogin(null, { email, password });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/register', form);
      login(data.token, data.user);
      navigate('/passenger/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#0A0F1E' }}>
      {/* Ambient Glow Orbs */}
      <div
        className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full opacity-25 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #16A34A 0%, transparent 70%)' }}
      />
      <div
        className="absolute bottom-0 right-1/4 w-[450px] h-[450px] rounded-full opacity-15 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #2563EB 0%, transparent 70%)' }}
      />

      {/* Left panel (branding) - desktop only */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-14 z-10">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg relative bg-slate-900 border border-slate-700/60"
            style={{
              boxShadow: '0 0 24px rgba(0,0,0,0.6)',
            }}
          >
            <Car size={22} className="text-white" />
          </div>
          <div>
            <span className="text-2xl font-black text-white tracking-tight">Rydio</span>
            <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Next-Gen Urban Mobility</div>
          </div>
        </div>

        {/* Hero Copy */}
        <div className="max-w-md my-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            Live Intelligent Fleet Engine v2.0
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white leading-tight tracking-tight mb-5">
            Urban transit,<br />
            <span className="gradient-text">engineered to perfection.</span>
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-8">
            Experience lightning-fast ride dispatching, high-precision live route telemetry, and comprehensive enterprise multi-role operations.
          </p>

          <div className="space-y-4">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <div key={i} className="flex items-start gap-3.5 p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0 text-emerald-400 mt-0.5">
                    <Icon size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white tracking-wide">{f.title}</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer info */}
        <div className="flex items-center gap-6 text-xs text-slate-500">
          <span>High Performance TiDB Cloud</span>
          <span>•</span>
          <span>OpenStreetMap & Carto CDN</span>
          <span>•</span>
          <span>Socket.IO Engine</span>
        </div>
      </div>

      {/* Right panel (form) */}
      <div className="flex-1 flex items-center justify-center p-6 z-10">
        <div className="w-full max-w-[420px] animate-fade-in">
          {/* Mobile Logo */}
          <div className="text-center mb-6 lg:hidden">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg bg-slate-900 border border-slate-700"
            >
              <Car size={24} className="text-white" />
            </div>
            <h1 className="text-2xl font-black text-white">Rydio</h1>
            <p className="text-xs text-slate-400 mt-1">Urban Transit Platform</p>
          </div>

          {/* Glass Card */}
          <div
            className="rounded-3xl p-8 backdrop-blur-xl border shadow-2xl relative overflow-hidden"
            style={{
              background: 'rgba(255, 255, 255, 0.98)',
              borderColor: 'rgba(226, 232, 240, 0.9)',
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.5), 0 0 40px rgba(22, 163, 74, 0.1)',
            }}
          >
            {/* Top decorative gradient border */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-blue-500" />

            {/* Tabs */}
            <div className="flex rounded-xl bg-slate-100 p-1 mb-6 border border-slate-200">
              {['login', 'register'].map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setError(''); }}
                  className={clsx(
                    'flex-1 py-2.5 text-xs font-bold rounded-lg transition-all capitalize',
                    tab === t
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
                      : 'text-slate-500 hover:text-slate-800'
                  )}
                >
                  {t === 'login' ? 'Sign In' : 'Create Account'}
                </button>
              ))}
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-5 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold animate-slide-in">
                {error}
              </div>
            )}

            {/* Sign In Tab */}
            {tab === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Email or Handle
                  </label>
                  <input
                    type="text"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    required
                    placeholder="e.g. passenger1 or user@cab.com"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      name="password"
                      value={form.password}
                      onChange={handleChange}
                      required
                      placeholder="••••••••••••"
                      className="input-field pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                    >
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full mt-2 py-3 text-sm shadow-lg shadow-emerald-500/25"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                  {loading ? 'Authenticating...' : 'Sign In to Rydio'}
                </button>

                {/* Quick 1-Click Access Grid */}
                <div className="mt-6 pt-5 border-t border-slate-200/80">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Instant Demo Access</span>
                    <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">1-Click</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {QUICK_LOGINS.map(({ label, email, password, color, icon: RoleIcon }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => fillAndLogin(email, password)}
                        className={clsx(
                          'flex items-center gap-2 text-xs py-2.5 px-3 rounded-xl font-bold border transition-all text-left shadow-sm',
                          color
                        )}
                      >
                        <RoleIcon size={14} className="flex-shrink-0" />
                        <span className="truncate">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </form>
            )}

            {/* Register Tab */}
            {tab === 'register' && (
              <form onSubmit={handleRegister} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    required
                    placeholder="Alex Morgan"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    required
                    placeholder="alex@domain.com"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Mobile Phone
                  </label>
                  <input
                    type="tel"
                    name="mobile"
                    value={form.mobile}
                    onChange={handleChange}
                    required
                    placeholder="9876543210"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      name="password"
                      value={form.password}
                      onChange={handleChange}
                      required
                      placeholder="Min. 6 characters"
                      className="input-field pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                    >
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    I want to join as
                  </label>
                  <select
                    name="role"
                    value={form.role}
                    onChange={handleChange}
                    className="input-field font-semibold"
                  >
                    <option value="passenger">Passenger (Book Rides)</option>
                    <option value="driver">Driver Partner (Accept Rides)</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full mt-2 py-3 text-sm shadow-lg shadow-emerald-500/25"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                  {loading ? 'Creating Account...' : 'Complete Registration'}
                </button>
              </form>
            )}
          </div>

          <p className="text-center text-xs text-slate-500 mt-6 font-medium">
            © 2026 Rydio Transit Platform. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
