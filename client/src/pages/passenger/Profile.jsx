import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import { User, Phone, MapPin, ShieldCheck, Save, Loader2, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import AppShell from '../../components/ui/AppShell';
import { Spinner } from '../../components/ui/UIKit';

export default function PassengerProfile() {
  const { user, login, token } = useAuthStore();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: user?.name || '',
    mobile: user?.mobile || '',
    default_address: user?.default_address || '',
    emergency_contact: user?.emergency_contact || '',
  });

  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const { data: profileData } = useQuery({
    queryKey: ['passengerProfile'],
    queryFn: () => api.get('/passenger/profile').then((r) => r.data),
    onSuccess: (d) => {
      const p = d.profile || d;
      setForm({
        name: p.name || '',
        mobile: p.mobile || '',
        default_address: p.default_address || '',
        emergency_contact: p.emergency_contact || '',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => api.put('/passenger/profile', form),
    onSuccess: (res) => {
      const updatedUser = res.data.user || res.data;
      login(token, { ...user, ...updatedUser });
      setSuccessMsg('Profile information saved successfully.');
      setErrorMsg('');
      queryClient.invalidateQueries({ queryKey: ['passengerProfile'] });
      setTimeout(() => setSuccessMsg(''), 4000);
    },
    onError: (err) => {
      setErrorMsg(err.response?.data?.message || 'Failed to update profile.');
    },
  });

  const initial = user?.name?.[0]?.toUpperCase() || 'P';

  const fields = [
    { key: 'name',              label: 'Full Name',                icon: User,        type: 'text',  placeholder: 'Your full name' },
    { key: 'mobile',            label: 'Mobile Contact Number',    icon: Phone,       type: 'tel',   placeholder: '+91 98765 43210' },
    { key: 'default_address',   label: 'Default Home / Work Address', icon: MapPin,   type: 'text',  placeholder: 'e.g. Anna Nagar, Chennai' },
    { key: 'emergency_contact', label: 'Emergency SOS Contact',    icon: ShieldCheck, type: 'tel',   placeholder: 'e.g. +91 98765 43210' },
  ];

  return (
    <AppShell title="Passenger Profile" subtitle="Manage your verified contact credentials and default settings">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="card p-6 sm:p-8">

          {/* Profile Header */}
          <div className="flex items-center gap-5 pb-6 mb-6 border-b border-slate-200">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white font-black text-2xl flex items-center justify-center shadow-lg shadow-emerald-500/25 flex-shrink-0">
              {initial}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-slate-900">{user?.name}</span>
                <span className="badge bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] font-bold">
                  <ShieldCheck size={12} className="inline mr-1" /> Verified Passenger
                </span>
              </div>
              <div className="text-xs text-slate-400 font-mono mt-0.5">{user?.email}</div>
              <div className="text-[11px] text-slate-500 mt-1">Role ID: #{user?.user_id || '9'}</div>
            </div>
          </div>

          {/* Alert Messages */}
          {successMsg && (
            <div className="mb-6 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-2.5 animate-slide-in">
              <CheckCircle2 size={16} /> {successMsg}
            </div>
          )}
          {errorMsg && (
            <div className="mb-6 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2.5 animate-slide-in">
              <AlertCircle size={16} /> {errorMsg}
            </div>
          )}

          {/* Form */}
          <div className="space-y-4">
            {fields.map(({ key, label, icon: Icon, type, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Icon size={14} className="text-emerald-600" /> {label}
                </label>
                <input
                  type={type}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  placeholder={placeholder}
                  className="input-field"
                />
              </div>
            ))}

            <div className="pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
                className="btn-primary w-full py-3 font-bold shadow-lg shadow-emerald-500/25 text-sm"
              >
                {updateMutation.isPending ? <Spinner size={16} className="text-white" /> : <Save size={16} />}
                {updateMutation.isPending ? 'Saving Updates...' : 'Save Profile Changes'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </AppShell>
  );
}
