import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import {
  User, Mail, Phone, MapPin, ArrowLeft, Save, Loader2, CheckCircle, ShieldCheck
} from 'lucide-react';

export default function PassengerProfile() {
  const { user, login, token } = useAuthStore();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: user?.name || '',
    mobile: user?.mobile || '',
    default_address: '',
    emergency_contact: '',
  });
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const { data: profileData, isLoading } = useQuery({
    queryKey: ['passengerProfile'],
    queryFn: () => api.get('/passenger/profile').then((r) => r.data),
  });

  useEffect(() => {
    if (profileData) {
      const p = profileData.profile || profileData.user || profileData;
      setForm({
        name: p.name || user?.name || '',
        mobile: p.mobile || user?.mobile || '',
        default_address: p.default_address || '',
        emergency_contact: p.emergency_contact || '',
      });
    }
  }, [profileData, user]);

  const updateMutation = useMutation({
    mutationFn: () => api.put('/passenger/profile', form),
    onSuccess: (res) => {
      const updatedUser = res.data.user || { ...user, name: form.name, mobile: form.mobile };
      login(token, updatedUser);
      showToast('✅ Profile updated successfully!');
    },
    onError: (err) => {
      showToast(err.response?.data?.message || '❌ Failed to update profile');
    },
  });

  return (
    <div className="min-h-screen bg-[hsl(220,15%,10%)] pb-12">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl bg-[hsl(220,15%,16%)] border border-emerald-500/40 text-emerald-300 shadow-xl text-sm font-medium animate-fade-in flex items-center gap-2">
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Navbar */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 border-b border-[hsl(220,15%,24%)] bg-[hsl(220,15%,10%)]/95 backdrop-blur">
        <div className="flex items-center gap-4">
          <Link
            to="/passenger/dashboard"
            className="flex items-center gap-2 text-[hsl(220,10%,60%)] hover:text-white transition"
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-semibold">Dashboard</span>
          </Link>
          <span className="text-gray-600">|</span>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🚖</span>
            <span className="font-bold text-white text-xl font-['Outfit']">CabGo</span>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-cyan-900/40 text-cyan-400 border border-cyan-500/30">
              Account Profile
            </span>
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-white font-['Outfit']">Passenger Profile</h1>
          <p className="text-sm text-[hsl(220,10%,60%)] mt-1">Manage your contact information and ride preferences</p>
        </div>

        {/* Profile Card */}
        <div className="p-6 sm:p-8 rounded-2xl bg-[hsl(220,15%,14%)] border border-[hsl(220,15%,24%)] shadow-xl space-y-6">
          {/* Avatar Header */}
          <div className="flex items-center gap-4 pb-6 border-b border-[hsl(220,15%,22%)]">
            <div className="w-16 h-16 rounded-2xl bg-amber-500 text-black flex items-center justify-center font-extrabold text-2xl shadow-lg">
              {user?.name?.[0]?.toUpperCase() || 'P'}
            </div>
            <div>
              <div className="text-lg font-bold text-white flex items-center gap-2">
                <span>{user?.name}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-900/40 text-emerald-400 font-bold border border-emerald-500/30 flex items-center gap-1">
                  <ShieldCheck size={12} /> Verified
                </span>
              </div>
              <div className="text-xs text-[hsl(220,10%,60%)] font-mono mt-0.5">{user?.email}</div>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[hsl(220,10%,70%)] mb-1.5 flex items-center gap-1.5">
                <User size={14} className="text-amber-400" /> Full Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-[hsl(220,15%,10%)] border border-[hsl(220,15%,24%)] text-white text-sm focus:outline-none focus:border-amber-400 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[hsl(220,10%,70%)] mb-1.5 flex items-center gap-1.5">
                <Phone size={14} className="text-emerald-400" /> Mobile Number
              </label>
              <input
                type="tel"
                value={form.mobile}
                onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-[hsl(220,15%,10%)] border border-[hsl(220,15%,24%)] text-white text-sm focus:outline-none focus:border-amber-400 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[hsl(220,10%,70%)] mb-1.5 flex items-center gap-1.5">
                <MapPin size={14} className="text-red-400" /> Default Pickup Address (Home / Office)
              </label>
              <input
                type="text"
                value={form.default_address}
                onChange={(e) => setForm({ ...form, default_address: e.target.value })}
                placeholder="e.g. Anna Nagar, Chennai"
                className="w-full px-4 py-2.5 rounded-xl bg-[hsl(220,15%,10%)] border border-[hsl(220,15%,24%)] text-white text-sm focus:outline-none focus:border-amber-400 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[hsl(220,10%,70%)] mb-1.5 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-blue-400" /> Emergency SOS Contact
              </label>
              <input
                type="tel"
                value={form.emergency_contact}
                onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })}
                placeholder="e.g. +91 98765 43210"
                className="w-full px-4 py-2.5 rounded-xl bg-[hsl(220,15%,10%)] border border-[hsl(220,15%,24%)] text-white text-sm focus:outline-none focus:border-amber-400 transition"
              />
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-sm transition shadow-lg disabled:opacity-50 cursor-pointer"
              >
                {updateMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Save Profile Changes
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
