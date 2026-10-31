import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import { User, Phone, MapPin, ShieldCheck, Save, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
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
      setSuccessMsg('Profile updated successfully.');
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
    { key: 'mobile',            label: 'Mobile Number',            icon: Phone,       type: 'tel',   placeholder: '+91 98765 43210' },
    { key: 'default_address',   label: 'Default Pickup Address',   icon: MapPin,      type: 'text',  placeholder: 'e.g. Anna Nagar, Chennai' },
    { key: 'emergency_contact', label: 'Emergency SOS Contact',    icon: ShieldCheck, type: 'tel',   placeholder: 'e.g. +91 98765 43210' },
  ];

  return (
    <AppShell title="My Profile" subtitle="Manage your contact information and preferences">
      <div className="max-w-xl mx-auto animate-fade-in">
        <div className="card p-7">

          {/* Avatar Header */}
          <div className="flex items-center gap-4 pb-6 mb-6 border-b border-line">
            <div className="w-16 h-16 rounded-2xl bg-brand-light flex items-center justify-center text-brand font-bold text-xl flex-shrink-0">
              {initial}
            </div>
            <div>
              <div className="text-base font-semibold text-ink flex items-center gap-2">
                {user?.name}
                <span className="badge bg-success-bg text-success text-[11px]">
                  <ShieldCheck size={11} className="inline mr-0.5" /> Verified
                </span>
              </div>
              <div className="text-xs text-ink-muted font-mono mt-0.5">{user?.email}</div>
            </div>
          </div>

          {/* Alerts */}
          {successMsg && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-success-bg border border-success/20 text-success text-sm flex items-center gap-2 animate-fade-in">
              <CheckCircle size={15} /> {successMsg}
            </div>
          )}
          {errorMsg && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-error-bg border border-error/20 text-error text-sm flex items-center gap-2">
              <AlertCircle size={15} /> {errorMsg}
            </div>
          )}

          {/* Form Fields */}
          <div className="space-y-4">
            {fields.map(({ key, label, icon: Icon, type, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-ink-muted mb-1.5 flex items-center gap-1.5">
                  <Icon size={13} className="text-brand" /> {label}
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

            <div className="pt-3">
              <button
                type="button"
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
                className="btn-primary w-full"
              >
                {updateMutation.isPending ? <Spinner size={15} className="text-white" /> : <Save size={15} />}
                Save Profile Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
