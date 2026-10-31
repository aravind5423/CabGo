import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { api, errorMessage } from '../../services/api';
import { User, Phone, MapPin, ShieldCheck, Save } from 'lucide-react';
import AppShell from '../../components/ui/AppShell';
import { Spinner, Alert, Skeleton } from '../../components/ui/UIKit';
import { formatDate, initials } from '../../utils/format';

const FIELDS = [
  { key: 'name',              label: 'Full name',          icon: User,        type: 'text', placeholder: 'Your full name', required: true },
  { key: 'mobile',            label: 'Mobile number',      icon: Phone,       type: 'tel',  placeholder: '9876543210', required: true, pattern: '[6-9][0-9]{9}' },
  { key: 'default_address',   label: 'Default address',    icon: MapPin,      type: 'text', placeholder: 'e.g. Anna Nagar, Chennai' },
  { key: 'emergency_contact', label: 'Emergency contact',  icon: ShieldCheck, type: 'tel',  placeholder: 'Trusted contact number' },
];

export default function PassengerProfile() {
  const { user, updateUser } = useAuthStore();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({ name: '', mobile: '', default_address: '', emergency_contact: '' });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['passengerProfile'],
    queryFn: () => api.get('/passenger/profile').then((r) => r.data),
  });
  const profile = data?.profile;

  useEffect(() => {
    if (!profile) return;
    setForm({
      name: profile.name || '',
      mobile: profile.mobile || '',
      default_address: profile.default_address || '',
      emergency_contact: profile.emergency_contact || '',
    });
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: () => api.put('/passenger/profile', form),
    onSuccess: () => {
      updateUser({ name: form.name.trim(), mobile: form.mobile.trim() });
      setSuccess('Profile saved.');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['passengerProfile'] });
      setTimeout(() => setSuccess(''), 3500);
    },
    onError: (err) => { setError(errorMessage(err, 'Failed to update profile.')); setSuccess(''); },
  });

  const onSubmit = (e) => { e.preventDefault(); updateMutation.mutate(); };

  return (
    <AppShell title="Profile" subtitle="Your contact details and defaults">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="card p-6 sm:p-8">
          <div className="flex items-center gap-4 pb-6 mb-6 border-b border-slate-100">
            <div className="w-14 h-14 rounded-xl bg-blue-600 text-white font-semibold text-xl flex items-center justify-center flex-shrink-0">
              {initials(user?.name)}
            </div>
            <div className="min-w-0">
              <div className="text-base font-semibold text-slate-900 truncate">{profile?.name || user?.name}</div>
              <div className="text-xs text-slate-500 truncate">{user?.email}</div>
              {profile?.created_at && <div className="text-[11px] text-slate-400 mt-0.5">Member since {formatDate(profile.created_at, { withTime: false })}</div>}
            </div>
          </div>

          {success && <Alert type="success" className="mb-4">{success}</Alert>}
          {error && <Alert type="error" className="mb-4">{error}</Alert>}

          {isLoading ? (
            <div className="space-y-4">
              {FIELDS.map((f) => <div key={f.key} className="space-y-2"><Skeleton className="h-3 w-28" /><Skeleton className="h-10 w-full" /></div>)}
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              {FIELDS.map(({ key, label, icon: Icon, type, placeholder, required, pattern }) => (
                <div key={key}>
                  <label className="label flex items-center gap-1.5" htmlFor={`profile-${key}`}><Icon size={13} className="text-slate-400" /> {label}</label>
                  <input id={`profile-${key}`} type={type} value={form[key]} required={required} pattern={pattern}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    placeholder={placeholder} className="input-field" />
                </div>
              ))}
              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button type="submit" disabled={updateMutation.isPending} className="btn-primary">
                  {updateMutation.isPending ? <Spinner size={15} /> : <Save size={15} />}
                  {updateMutation.isPending ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </AppShell>
  );
}
