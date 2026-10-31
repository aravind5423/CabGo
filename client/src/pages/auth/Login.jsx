import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import clsx from 'clsx';

export default function Login() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ name: '', email: '', password: '', mobile: '', role: 'passenger' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleLogin = async (e, customCreds = null) => {
    if (e && e.preventDefault) e.preventDefault();
    setLoading(true);
    setError('');
    const targetEmail = customCreds ? customCreds.email : form.email;
    const targetPassword = customCreds ? customCreds.password : form.password;

    try {
      const { data } = await api.post('/auth/login', {
        email: targetEmail,
        password: targetPassword,
      });
      login(data.token, data.user);
      const paths = {
        passenger: '/passenger/dashboard',
        driver: '/driver/dashboard',
        admin: '/admin/dashboard',
        superadmin: '/superadmin/dashboard',
      };
      navigate(paths[data.user.role] || '/login');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillAndLogin = (email, password) => {
    setForm((prev) => ({ ...prev, email, password }));
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
    <div className="min-h-screen flex items-center justify-center bg-[hsl(220,15%,10%)] px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <span className="text-5xl">🚖</span>
          <h1 className="text-3xl font-bold mt-2 text-white font-['Outfit']">CabGo</h1>
          <p className="text-[hsl(220,10%,60%)] mt-1">Your urban transit platform</p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(12px)',
            border: '1px solid hsl(220,15%,24%)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          }}
        >
          {/* Tabs */}
          <div className="flex rounded-xl overflow-hidden mb-6 bg-[hsl(220,15%,10%)]">
            {['login', 'register'].map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(''); }}
                className={clsx(
                  'flex-1 py-2.5 text-sm font-semibold transition-colors capitalize',
                  tab === t
                    ? 'bg-[hsl(38,95%,55%)] text-[hsl(220,15%,10%)]'
                    : 'text-[hsl(220,10%,60%)] hover:text-white'
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Login Form */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm text-[hsl(220,10%,60%)] mb-1">Email or Username</label>
                <input
                  type="text"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  placeholder="e.g. superadmin, driver1, or user@cab.com"
                  className="w-full px-4 py-2.5 rounded-xl bg-[hsl(220,15%,10%)] border border-[hsl(220,15%,24%)] text-white placeholder-[hsl(220,10%,40%)] focus:outline-none focus:border-[hsl(38,95%,55%)] transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-[hsl(220,10%,60%)] mb-1">Password</label>
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  required
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-xl bg-[hsl(220,15%,10%)] border border-[hsl(220,15%,24%)] text-white placeholder-[hsl(220,10%,40%)] focus:outline-none focus:border-[hsl(38,95%,55%)] transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-[hsl(38,95%,55%)] text-[hsl(220,15%,10%)] font-bold hover:brightness-110 transition disabled:opacity-50"
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </button>

              {/* Quick Demo Logins */}
              <div className="mt-6 pt-5 border-t border-[hsl(220,15%,20%)]">
                <p className="text-xs text-[hsl(220,10%,50%)] text-center mb-3 font-semibold uppercase tracking-wider">
                  Quick Demo Login (1-Click Fill &amp; Sign In)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => fillAndLogin('superadmin', 'password123')}
                    className="text-xs py-2 px-2.5 rounded-lg bg-[hsl(220,15%,16%)] hover:bg-[hsl(220,15%,22%)] text-amber-400 font-medium border border-amber-500/20 transition text-left flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>👑</span> Super Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => fillAndLogin('admin', 'password123')}
                    className="text-xs py-2 px-2.5 rounded-lg bg-[hsl(220,15%,16%)] hover:bg-[hsl(220,15%,22%)] text-blue-400 font-medium border border-blue-500/20 transition text-left flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>🛡️</span> Ops Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => fillAndLogin('driver1', 'password123')}
                    className="text-xs py-2 px-2.5 rounded-lg bg-[hsl(220,15%,16%)] hover:bg-[hsl(220,15%,22%)] text-emerald-400 font-medium border border-emerald-500/20 transition text-left flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>🚗</span> Driver
                  </button>
                  <button
                    type="button"
                    onClick={() => fillAndLogin('passenger1', 'password123')}
                    className="text-xs py-2 px-2.5 rounded-lg bg-[hsl(220,15%,16%)] hover:bg-[hsl(220,15%,22%)] text-cyan-400 font-medium border border-cyan-500/20 transition text-left flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>🎒</span> Passenger
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Register Form */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm text-[hsl(220,10%,60%)] mb-1">Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  placeholder="Your Name"
                  className="w-full px-4 py-2.5 rounded-xl bg-[hsl(220,15%,10%)] border border-[hsl(220,15%,24%)] text-white placeholder-[hsl(220,10%,40%)] focus:outline-none focus:border-[hsl(38,95%,55%)] transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-[hsl(220,10%,60%)] mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  placeholder="you@example.com"
                  className="w-full px-4 py-2.5 rounded-xl bg-[hsl(220,15%,10%)] border border-[hsl(220,15%,24%)] text-white placeholder-[hsl(220,10%,40%)] focus:outline-none focus:border-[hsl(38,95%,55%)] transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-[hsl(220,10%,60%)] mb-1">Mobile</label>
                <input
                  type="tel"
                  name="mobile"
                  value={form.mobile}
                  onChange={handleChange}
                  required
                  placeholder="+91 9876543210"
                  className="w-full px-4 py-2.5 rounded-xl bg-[hsl(220,15%,10%)] border border-[hsl(220,15%,24%)] text-white placeholder-[hsl(220,10%,40%)] focus:outline-none focus:border-[hsl(38,95%,55%)] transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-[hsl(220,10%,60%)] mb-1">Password</label>
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  required
                  placeholder="Min. 8 characters"
                  className="w-full px-4 py-2.5 rounded-xl bg-[hsl(220,15%,10%)] border border-[hsl(220,15%,24%)] text-white placeholder-[hsl(220,10%,40%)] focus:outline-none focus:border-[hsl(38,95%,55%)] transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-[hsl(220,10%,60%)] mb-1">I am a</label>
                <select
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl bg-[hsl(220,15%,10%)] border border-[hsl(220,15%,24%)] text-white focus:outline-none focus:border-[hsl(38,95%,55%)] transition-colors"
                >
                  <option value="passenger">Passenger</option>
                  <option value="driver">Driver</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-[hsl(38,95%,55%)] text-[hsl(220,15%,10%)] font-bold hover:brightness-110 transition disabled:opacity-50"
              >
                {loading ? 'Creating account…' : 'Create Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
