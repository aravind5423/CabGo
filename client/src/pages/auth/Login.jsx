import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, ROLE_HOME } from '../../store/authStore';
import { api, errorMessage } from '../../services/api';
import { Alert, Spinner } from '../../components/ui/UIKit';
import { Eye, EyeOff, ShieldCheck, Car, User, Activity, MapPin, Radio, Lock } from 'lucide-react';
import clsx from 'clsx';

const QUICK_LOGINS = [
  { label: 'Passenger',   email: 'passenger1', icon: User,        cls: 'text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100' },
  { label: 'Driver',      email: 'driver1',    icon: Car,         cls: 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100' },
  { label: 'Ops Admin',   email: 'admin1',     icon: Activity,    cls: 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100' },
  { label: 'Super Admin', email: 'superadmin', icon: ShieldCheck, cls: 'text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100' },
];
const DEMO_PASSWORD = 'password123';

const FEATURES = [
  { icon: MapPin, title: 'Instant booking',   desc: 'Fare quotes from live fare rules and road distance.' },
  { icon: Radio,  title: 'Live trip tracking', desc: 'Driver position streamed to the passenger in real time.' },
  { icon: Lock,   title: 'Role-based access',  desc: 'Separate portals for passengers, drivers and operations.' },
];

const EMPTY_FORM = {
  name: '', email: '', password: '', mobile: '', role: 'passenger',
  license_no: '', license_expiry: '',
};

export default function Login() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [tab, setTab] = useState('login');
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const finishAuth = (data) => {
    login(data.token, data.user);
    navigate(ROLE_HOME[data.user?.role] || '/login', { replace: true });
  };

  const handleLogin = async (e, creds = null) => {
    e?.preventDefault?.();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/login', {
        email: creds?.email ?? form.email,
        password: creds?.password ?? form.password,
      });
      finishAuth(data);
    } catch (err) {
      setError(errorMessage(err, 'Login failed. Please check your credentials.'));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = { ...form };
      if (payload.role !== 'driver') { delete payload.license_no; delete payload.license_expiry; }
      const { data } = await api.post('/auth/register', payload);
      if (data.token && data.user) {
        finishAuth(data);
      } else {
        setTab('login');
        setNotice('Account created. Please sign in.');
      }
    } catch (err) {
      setError(errorMessage(err, 'Registration failed.'));
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (t) => { setTab(t); setError(''); setNotice(''); };

  return (
    <div className="min-h-screen flex bg-[#0B1120]">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-[46%] flex-col justify-between p-12 border-r border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
            <Car size={20} className="text-white" />
          </div>
          <div>
            <div className="text-xl font-semibold text-white leading-tight">Rydio</div>
            <div className="text-[11px] text-slate-400 tracking-wide">URBAN TRANSIT PLATFORM</div>
          </div>
        </div>

        <div className="max-w-md">
          <h2 className="text-4xl font-semibold text-white leading-tight tracking-tight">
            Book, dispatch and track rides from one place.
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed mt-4">
            A multi-role cab booking platform for passengers, driver partners and city operations teams.
          </p>
          <div className="space-y-3 mt-8">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <Icon size={16} />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{title}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-xs text-slate-500">React · Express · Socket.IO · MySQL / TiDB</div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[420px] animate-page-in">
          <div className="text-center mb-6 lg:hidden">
            <div className="w-11 h-11 rounded-xl bg-emerald-500 flex items-center justify-center mx-auto mb-3">
              <Car size={22} className="text-white" />
            </div>
            <h1 className="text-xl font-semibold text-white">Rydio</h1>
            <p className="text-xs text-slate-400 mt-1">Urban transit platform</p>
          </div>

          <div className="card p-7 shadow-xl">
            <div className="tabs w-full mb-6">
              {[['login', 'Sign in'], ['register', 'Create account']].map(([id, label]) => (
                <button key={id} type="button" onClick={() => switchTab(id)} className={clsx('tab flex-1 justify-center', tab === id && 'active')}>
                  {label}
                </button>
              ))}
            </div>

            {error && <Alert type="error" className="mb-4">{error}</Alert>}
            {notice && <Alert type="success" className="mb-4">{notice}</Alert>}

            {tab === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="label" htmlFor="login-email">Email or username</label>
                  <input id="login-email" type="text" name="email" value={form.email} onChange={handleChange} required
                    autoComplete="username" placeholder="e.g. passenger1 or you@example.com" className="input-field" />
                </div>
                <div>
                  <label className="label" htmlFor="login-password">Password</label>
                  <div className="relative">
                    <input id="login-password" type={showPw ? 'text' : 'password'} name="password" value={form.password} onChange={handleChange}
                      required autoComplete="current-password" placeholder="Your password" className="input-field pr-10" />
                    <button type="button" onClick={() => setShowPw(!showPw)} aria-label={showPw ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading} className="btn-primary btn-lg w-full mt-1">
                  {loading ? <Spinner size={16} /> : null}
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>

                <div className="pt-5 mt-5 border-t border-slate-200">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2.5">Demo accounts</div>
                  <div className="grid grid-cols-2 gap-2">
                    {QUICK_LOGINS.map(({ label, email, icon: Icon, cls }) => (
                      <button key={label} type="button" disabled={loading}
                        onClick={() => handleLogin(null, { email, password: DEMO_PASSWORD })}
                        className={clsx('flex items-center gap-2 text-xs py-2.5 px-3 rounded-lg font-semibold border transition-colors text-left', cls)}>
                        <Icon size={14} className="flex-shrink-0" />
                        <span className="truncate">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="label" htmlFor="reg-role">I want to join as</label>
                  <select id="reg-role" name="role" value={form.role} onChange={handleChange} className="input-field">
                    <option value="passenger">Passenger — book rides</option>
                    <option value="driver">Driver partner — accept rides</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="reg-name">Full name</label>
                  <input id="reg-name" type="text" name="name" value={form.name} onChange={handleChange} required placeholder="Alex Morgan" className="input-field" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label" htmlFor="reg-email">Email</label>
                    <input id="reg-email" type="email" name="email" value={form.email} onChange={handleChange} required placeholder="alex@example.com" className="input-field" />
                  </div>
                  <div>
                    <label className="label" htmlFor="reg-mobile">Mobile</label>
                    <input id="reg-mobile" type="tel" name="mobile" value={form.mobile} onChange={handleChange} required
                      pattern="[6-9][0-9]{9}" title="10-digit Indian mobile number" placeholder="9876543210" className="input-field" />
                  </div>
                </div>
                <div>
                  <label className="label" htmlFor="reg-password">Password</label>
                  <div className="relative">
                    <input id="reg-password" type={showPw ? 'text' : 'password'} name="password" value={form.password} onChange={handleChange}
                      required minLength={6} autoComplete="new-password" placeholder="At least 6 characters" className="input-field pr-10" />
                    <button type="button" onClick={() => setShowPw(!showPw)} aria-label={showPw ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {form.role === 'driver' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 animate-fade-in">
                    <div>
                      <label className="label" htmlFor="reg-license">Driving licence no.</label>
                      <input id="reg-license" type="text" name="license_no" value={form.license_no} onChange={handleChange} required placeholder="TN-01-2021-000000" className="input-field" />
                    </div>
                    <div>
                      <label className="label" htmlFor="reg-expiry">Licence expiry</label>
                      <input id="reg-expiry" type="date" name="license_expiry" value={form.license_expiry} onChange={handleChange} required className="input-field" />
                    </div>
                    <p className="sm:col-span-2 text-[11px] text-slate-500">Driver accounts are reviewed by an operations admin before you can go online.</p>
                  </div>
                )}

                <button type="submit" disabled={loading} className="btn-primary btn-lg w-full mt-1">
                  {loading ? <Spinner size={16} /> : null}
                  {loading ? 'Creating account…' : 'Create account'}
                </button>
              </form>
            )}
          </div>

          <p className="text-center text-xs text-slate-500 mt-6">© 2026 Rydio. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
