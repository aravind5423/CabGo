import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import { Settings, ShieldAlert, FileText, UserPlus, Check, Loader2, Key, AlertCircle } from 'lucide-react';
import AppShell from '../../components/ui/AppShell';
import { EmptyState, Skeleton, StatusBadge, Toast } from '../../components/ui/UIKit';
import clsx from 'clsx';

export default function SuperadminDashboard() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('settings');
  const [toastMsg, setToastMsg] = useState('');
  const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3000); };

  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ['superadminSettings'],
    queryFn: () => api.get('/superadmin/settings').then((r) => r.data),
  });

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['superadminLogs'],
    queryFn: () => api.get('/superadmin/logs').then((r) => r.data),
    enabled: activeTab === 'logs',
  });

  const { data: adminsData, isLoading: adminsLoading } = useQuery({
    queryKey: ['superadminAdmins'],
    queryFn: () => api.get('/superadmin/admins').then((r) => r.data),
    enabled: activeTab === 'admins',
  });

  const currentSettings = settingsData?.settings || settingsData || {};

  const [settingsForm, setSettingsForm] = useState({
    commission_rate: 15,
    max_cancellations_per_day: 3,
    maintenance_mode: false,
  });

  useEffect(() => {
    if (currentSettings && Object.keys(currentSettings).length > 0) {
      setSettingsForm({
        commission_rate: currentSettings.commission_rate ?? 15,
        max_cancellations_per_day: currentSettings.max_cancellations_per_day ?? 3,
        maintenance_mode: currentSettings.maintenance_mode ?? false,
      });
    }
  }, [settingsData]);

  const updateSettingsMutation = useMutation({
    mutationFn: (payload) => api.put('/superadmin/settings', payload),
    onSuccess: () => {
      showToast('Platform policies updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['superadminSettings'] });
    },
    onError: (err) => showToast(err.response?.data?.message || 'Failed to update settings'),
  });

  const logs = logsData?.logs || [];
  const admins = adminsData?.admins || [];

  const TABS = [
    { id: 'settings', label: 'Platform Policies', icon: Settings },
    { id: 'admins',   label: 'Administrators',    icon: ShieldAlert },
    { id: 'logs',     label: 'Audit Logs',         icon: FileText },
  ];

  return (
    <AppShell
      title="Control Panel"
      subtitle="Platform-wide configuration and security"
    >
      <Toast message={toastMsg} />

      <div className="space-y-5 animate-fade-in">

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 bg-canvas border border-line rounded-xl p-1 w-fit flex-wrap">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition',
                activeTab === id
                  ? 'bg-white text-ink shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="max-w-xl">
            <div className="card p-6 space-y-5">
              <h2 className="text-sm font-semibold text-ink">Platform Policies</h2>

              {settingsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ))}
                </div>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); updateSettingsMutation.mutate(settingsForm); }} className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1.5 flex items-center gap-1.5">
                      <Key size={13} className="text-brand" /> Commission Rate (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={settingsForm.commission_rate}
                      onChange={(e) => setSettingsForm({ ...settingsForm, commission_rate: Number(e.target.value) })}
                      className="input-field"
                    />
                    <p className="text-xs text-ink-muted mt-1">Percentage withheld from each trip fare</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1.5 flex items-center gap-1.5">
                      <AlertCircle size={13} className="text-warning" /> Max Cancellations per Day
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={settingsForm.max_cancellations_per_day}
                      onChange={(e) => setSettingsForm({ ...settingsForm, max_cancellations_per_day: Number(e.target.value) })}
                      className="input-field"
                    />
                    <p className="text-xs text-ink-muted mt-1">Per-user daily cancellation limit</p>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl border border-line bg-canvas">
                    <div>
                      <div className="text-sm font-semibold text-ink">Maintenance Mode</div>
                      <div className="text-xs text-ink-muted mt-0.5">Temporarily disable new bookings platform-wide</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSettingsForm({ ...settingsForm, maintenance_mode: !settingsForm.maintenance_mode })}
                      className={clsx(
                        'relative w-11 h-6 rounded-full transition flex-shrink-0',
                        settingsForm.maintenance_mode ? 'bg-brand' : 'bg-line-2'
                      )}
                    >
                      <span
                        className={clsx(
                          'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                          settingsForm.maintenance_mode && 'translate-x-5'
                        )}
                      />
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={updateSettingsMutation.isPending}
                    className="btn-primary w-full"
                  >
                    {updateSettingsMutation.isPending
                      ? <Loader2 size={15} className="animate-spin" />
                      : <Check size={15} />
                    }
                    Save Platform Policies
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Admins Tab */}
        {activeTab === 'admins' && (
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-line">
              <h2 className="text-sm font-semibold text-ink">Privileged Administrators</h2>
              <p className="text-xs text-ink-muted mt-0.5">Ops admins with portal access</p>
            </div>

            {adminsLoading ? (
              <div className="p-8 text-center">
                <Loader2 className="animate-spin mx-auto" size={24} />
              </div>
            ) : admins.length === 0 ? (
              <EmptyState icon={ShieldAlert} title="No administrators found" description="No admin accounts exist." />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map((adm) => (
                      <tr key={adm.user_id}>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-canvas flex items-center justify-center font-semibold text-sm text-ink flex-shrink-0">
                              {adm.name?.[0]?.toUpperCase() || 'A'}
                            </div>
                            <span className="font-medium text-ink">{adm.name}</span>
                          </div>
                        </td>
                        <td><span className="font-mono text-xs text-ink-muted">{adm.email}</span></td>
                        <td><span className="badge bg-info-bg text-info capitalize">{adm.role}</span></td>
                        <td><StatusBadge status={adm.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-line">
              <h2 className="text-sm font-semibold text-ink">System Audit Trail</h2>
              <p className="text-xs text-ink-muted mt-0.5">Immutable security event and moderation log records</p>
            </div>

            {logsLoading ? (
              <div className="p-8 text-center">
                <Loader2 className="animate-spin mx-auto" size={24} />
              </div>
            ) : logs.length === 0 ? (
              <EmptyState icon={FileText} title="No logs recorded" description="System events will appear here." />
            ) : (
              <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
                <table className="data-table">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr>
                      <th>Action</th>
                      <th>Description</th>
                      <th>IP Address</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.log_id}>
                        <td>
                          <span className="font-mono text-xs font-semibold text-brand">{log.action}</span>
                        </td>
                        <td className="text-xs text-ink max-w-[280px]">{log.description}</td>
                        <td><span className="font-mono text-xs text-ink-muted">{log.ip_address || '127.0.0.1'}</span></td>
                        <td className="text-xs text-ink-muted whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
