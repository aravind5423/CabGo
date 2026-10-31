import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import { Zap, Eye, EyeOff, Loader2 } from 'lucide-react';
import clsx from 'clsx';

const QUICK_LOGINS = [
  { label: 'Super Admin', email: 'superadmin', password: 'password123', color: 'text-error bg-error-bg border-error/20' },
  { label: 'Ops Admin',   email: 'admin1',     password: 'password123', color: 'text-warning bg-warning-bg border-warning/20' },
  { label: 'Driver',      email: 'driver1',    password: 'password123', color: 'text-success bg-success-bg border-success/20' },
  { label: 'Passenger',   email: 'passenger1', password: 'password123', color: 'text-info bg-info-bg border-info/20' },
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
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
      <div className="w-full max-w-[400px] animate-fade-in">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-brand flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Zap size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-ink">CabGo</h1>
          <p className="text-sm text-ink-muted mt-1">Urban Transit Platform</p>
        </div>

        {/* Card */}
        <div className="card p-7">

          {/* Tabs */}
          <div className="flex rounded-xl overflow-hidden bg-canvas border border-line mb-6 p-1 gap-1">
            {['login', 'register'].map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(''); }}
                className={clsx(
                  'flex-1 py-2 text-sm font-semibold rounded-lg transition capitalize',
                  tab === t
                    ? 'bg-white text-ink shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                )}
              >
                {t === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-error-bg border border-error/20 text-error text-sm">
              {error}
            </div>
          )}

          {/* Login Form */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1.5">Email or Username</label>
                <input
                  type="text"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  placeholder="you@example.com"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    required
                    placeholder="Min. 8 characters"
                    className="input-field pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-muted transition"
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                {loading ? 'Signing in…' : 'Sign In'}
              </button>

              {/* Quick Login */}
              <div className="mt-5 pt-5 border-t border-line">
                <p className="text-xs text-ink-muted mb-3 text-center font-medium">Quick Demo Access</p>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_LOGINS.map(({ label, email, password, color }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => fillAndLogin(email, password)}
                      className={clsx(
                        'text-xs py-2 px-3 rounded-lg font-semibold border transition text-left cursor-pointer',
                        color
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </form>
          )}

          {/* Register Form */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1.5">Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  placeholder="Your Name"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1.5">Email</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  placeholder="you@example.com"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1.5">Mobile</label>
                <input
                  type="tel"
                  name="mobile"
                  value={form.mobile}
                  onChange={handleChange}
                  required
                  placeholder="+91 98765 43210"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    required
                    placeholder="Min. 8 characters"
                    className="input-field pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-muted transition"
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1.5">I am a</label>
                <select
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                  className="input-field"
                >
                  <option value="passenger">Passenger</option>
                  <option value="driver">Driver</option>
                </select>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                {loading ? 'Creating account…' : 'Create Account'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-ink-faint mt-6">© 2025 CabGo. All rights reserved.</p>
      </div>
    </div>
  );
}
