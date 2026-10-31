import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import { Settings, ShieldAlert, FileText, CheckCircle2, Loader2, Key, AlertCircle, ShieldCheck, Search, Sliders } from 'lucide-react';
import AppShell from '../../components/ui/AppShell';
import { EmptyState, Skeleton, StatusBadge, Toast, Spinner } from '../../components/ui/UIKit';
import clsx from 'clsx';

export default function SuperadminDashboard() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('settings');
  const [logSearch, setLogSearch] = useState('');
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
      showToast('Global platform policies updated and applied.');
      queryClient.invalidateQueries({ queryKey: ['superadminSettings'] });
    },
    onError: (err) => showToast(err.response?.data?.message || 'Failed to update settings'),
  });

  const logs = logsData?.logs || [];
  const admins = adminsData?.admins || [];

  const filteredLogs = logs.filter((l) => {
    const q = logSearch.toLowerCase();
    const action = (l.action || '').toLowerCase();
    const desc = (l.description || '').toLowerCase();
    const ip = (l.ip_address || '').toLowerCase();
    return action.includes(q) || desc.includes(q) || ip.includes(q);
  });

  const TABS = [
    { id: 'settings', label: 'Platform Policies', icon: Settings },
    { id: 'admins',   label: 'Admin Directory',    icon: ShieldAlert },
    { id: 'logs',     label: 'Audit Trail Ledger', icon: FileText },
  ];

  return (
    <AppShell
      title="Root Control Panel"
      subtitle="SuperAdmin governance, platform rate policy, and immutable security audit logs"
    >
      <Toast message={toastMsg} />

      <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 w-fit flex-wrap">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer',
                activeTab === id
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-800'
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
            <div className="card p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Platform Policy Parameters</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Applied immediately to all fare quotes and user sessions</p>
                </div>
                <Sliders size={20} className="text-emerald-600" />
              </div>

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
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    updateSettingsMutation.mutate(settingsForm);
                  }}
                  className="space-y-5"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Key size={14} className="text-emerald-600" /> Platform Commission Rate
                      </label>
                      <span className="font-mono font-black text-emerald-700 text-sm">
                        {settingsForm.commission_rate}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="40"
                      value={settingsForm.commission_rate}
                      onChange={(e) => setSettingsForm({ ...settingsForm, commission_rate: Number(e.target.value) })}
                      className="w-full accent-emerald-600 cursor-pointer"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Platform fee deducted from gross passenger fares</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <AlertCircle size={14} className="text-amber-500" /> Daily Cancellation Limit
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={settingsForm.max_cancellations_per_day}
                      onChange={(e) => setSettingsForm({ ...settingsForm, max_cancellations_per_day: Number(e.target.value) })}
                      className="input-field font-semibold"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Maximum allowed cancellations per rider before soft cooldown</p>
                  </div>

                  {/* Maintenance Switch */}
                  <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 bg-slate-50/50">
                    <div>
                      <div className="text-xs font-bold text-slate-900">Platform Maintenance Mode</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Pause ride matching during system updates</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSettingsForm({ ...settingsForm, maintenance_mode: !settingsForm.maintenance_mode })}
                      className={clsx(
                        'relative w-12 h-7 rounded-full transition-colors flex-shrink-0 cursor-pointer',
                        settingsForm.maintenance_mode ? 'bg-rose-600' : 'bg-slate-300'
                      )}
                    >
                      <span
                        className={clsx(
                          'absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform',
                          settingsForm.maintenance_mode && 'translate-x-5'
                        )}
                      />
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={updateSettingsMutation.isPending}
                    className="btn-primary w-full py-3 text-sm font-bold shadow-lg shadow-emerald-500/25"
                  >
                    {updateSettingsMutation.isPending ? <Spinner size={16} className="text-white" /> : <CheckCircle2 size={16} />}
                    {updateSettingsMutation.isPending ? 'Propagating...' : 'Save & Publish Policy Changes'}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Admins Tab */}
        {activeTab === 'admins' && (
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200/80 bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-900">Authorized System Administrators</h3>
              <p className="text-xs text-slate-500 mt-0.5">Personnel with elevated permissions across the fleet</p>
            </div>

            {adminsLoading ? (
              <div className="p-8 text-center text-slate-400">
                <Spinner size={24} className="text-emerald-600 mx-auto mb-2" />
                <span className="text-xs font-bold">Loading administrators...</span>
              </div>
            ) : admins.length === 0 ? (
              <EmptyState icon={ShieldAlert} title="No Admin Accounts" description="No elevated operator accounts found." />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Administrator</th>
                      <th>Email Handle</th>
                      <th>System Role</th>
                      <th>Account Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map((adm) => (
                      <tr key={adm.user_id} className="hover:bg-slate-50 transition-colors">
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-sm">
                              {adm.name?.[0]?.toUpperCase() || 'A'}
                            </div>
                            <span className="font-bold text-xs text-slate-900">{adm.name}</span>
                          </div>
                        </td>
                        <td><span className="font-mono text-xs text-slate-600">{adm.email}</span></td>
                        <td><span className="badge bg-blue-50 text-blue-700 capitalize text-[10px] font-bold">{adm.role}</span></td>
                        <td><StatusBadge status={adm.status || 'active'} /></td>
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
          <div className="card overflow-hidden space-y-0">
            <div className="p-4 sm:px-6 border-b border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Immutable Audit Trail</h3>
                <p className="text-xs text-slate-500 mt-0.5">Tamper-evident logs of logins, rate adjustments, and ride statuses</p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search size={15} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  placeholder="Filter logs by action..."
                  className="input-field pl-9 text-xs py-2"
                />
              </div>
            </div>

            {logsLoading ? (
              <div className="p-8 text-center text-slate-400">
                <Spinner size={24} className="text-emerald-600 mx-auto mb-2" />
                <span className="text-xs font-bold">Streaming audit records...</span>
              </div>
            ) : filteredLogs.length === 0 ? (
              <EmptyState icon={FileText} title="No audit entries found" description="Audit log stream is currently clear." />
            ) : (
              <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                <table className="data-table">
                  <thead className="sticky top-0 bg-slate-50 z-10">
                    <tr>
                      <th>Event Action</th>
                      <th>Activity Description</th>
                      <th>Client IP</th>
                      <th>Recorded At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((log) => (
                      <tr key={log.log_id} className="hover:bg-slate-50 transition-colors">
                        <td>
                          <span className="font-mono text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {log.action}
                          </span>
                        </td>
                        <td className="text-xs text-slate-800 max-w-sm font-medium">{log.description}</td>
                        <td><span className="font-mono text-xs text-slate-500">{log.ip_address || '127.0.0.1'}</span></td>
                        <td className="text-[11px] text-slate-400 whitespace-nowrap">
                          {log.created_at ? new Date(log.created_at).toLocaleString() : 'Recent'}
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
