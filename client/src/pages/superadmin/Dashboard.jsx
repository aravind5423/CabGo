import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import {
  Settings, ShieldAlert, FileText, UserPlus, LogOut, Check, Loader2, Key
} from 'lucide-react';

export default function SuperadminDashboard() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('settings');
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  // 1. Settings Query
  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ['superadminSettings'],
    queryFn: () => api.get('/superadmin/settings').then((r) => r.data),
  });

  // 2. System Logs Query
  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['superadminLogs'],
    queryFn: () => api.get('/superadmin/logs').then((r) => r.data),
    enabled: activeTab === 'logs',
  });

  // 3. Admins List Query
  const { data: adminsData, isLoading: adminsLoading } = useQuery({
    queryKey: ['superadminAdmins'],
    queryFn: () => api.get('/superadmin/admins').then((r) => r.data),
    enabled: activeTab === 'admins',
  });

  // Settings State
  const [settingsForm, setSettingsForm] = useState({
    commission_rate: 15,
    max_cancellations_per_day: 3,
    maintenance_mode: false,
  });

  // Update Settings Mutation
  const updateSettingsMutation = useMutation({
    mutationFn: (payload) => api.put('/superadmin/settings', payload),
    onSuccess: () => {
      showToast('✅ Platform policies updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['superadminSettings'] });
    },
    onError: (err) => {
      showToast(err.response?.data?.message || 'Failed to update settings');
    },
  });

  const handleSaveSettings = (e) => {
    e.preventDefault();
    updateSettingsMutation.mutate(settingsForm);
  };

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch (_) {}
    logout();
    navigate('/login');
  };

  const currentSettings = settingsData?.settings || settingsData || {};
  const logs = logsData?.logs || [];
  const admins = adminsData?.admins || [];

  return (
    <div className="min-h-screen bg-[hsl(220,15%,10%)]">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl bg-[hsl(220,15%,16%)] border border-[hsl(220,15%,24%)] text-white shadow-lg text-sm">
          {toastMsg}
        </div>
      )}

      {/* Navbar */}
      <nav className="sticky top-0 z-40 flex items-center justify-between px-6 py-4 border-b border-[hsl(220,15%,24%)] bg-[hsl(220,15%,10%)]/90 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🚖</span>
          <span className="font-bold text-white text-xl font-['Outfit']">CabGo</span>
          <span className="ml-2 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
            Super Administrator
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[hsl(220,10%,60%)] text-sm hidden sm:block">🛡️ {user?.name}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-[hsl(220,10%,60%)] hover:text-white hover:bg-[hsl(220,15%,16%)] transition"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex gap-2 border-b border-[hsl(220,15%,24%)] pb-4">
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${
              activeTab === 'settings'
                ? 'bg-[hsl(38,95%,55%)] text-[hsl(220,15%,10%)]'
                : 'text-[hsl(220,10%,60%)] hover:text-white hover:bg-[hsl(220,15%,16%)]'
            }`}
          >
            <Settings size={16} />
            Platform Policies
          </button>
          <button
            onClick={() => setActiveTab('admins')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${
              activeTab === 'admins'
                ? 'bg-[hsl(38,95%,55%)] text-[hsl(220,15%,10%)]'
                : 'text-[hsl(220,10%,60%)] hover:text-white hover:bg-[hsl(220,15%,16%)]'
            }`}
          >
            <Key size={16} />
            Admin Provisioning
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${
              activeTab === 'logs'
                ? 'bg-[hsl(38,95%,55%)] text-[hsl(220,15%,10%)]'
                : 'text-[hsl(220,10%,60%)] hover:text-white hover:bg-[hsl(220,15%,16%)]'
            }`}
          >
            <FileText size={16} />
            Audit Logs
          </button>
        </div>

        {/* Tab 1: Settings Form */}
        {activeTab === 'settings' && (
          <div className="max-w-xl p-6 rounded-2xl bg-[hsl(220,15%,16%)] border border-[hsl(220,15%,24%)] space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white">Platform System Policies</h2>
              <p className="text-sm text-[hsl(220,10%,60%)]">Control financial commission, cancellation policies, and operational maintenance.</p>
            </div>

            {settingsLoading ? (
              <div className="py-8 text-center text-[hsl(220,10%,60%)]">
                <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                Loading policy settings...
              </div>
            ) : (
              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div>
                  <label className="block text-sm text-[hsl(220,10%,60%)] mb-1">
                    Platform Commission Rate (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    defaultValue={currentSettings.commission_rate ?? 15}
                    onChange={(e) => setSettingsForm({ ...settingsForm, commission_rate: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl bg-[hsl(220,15%,10%)] border border-[hsl(220,15%,24%)] text-white focus:outline-none focus:border-[hsl(38,95%,55%)] font-mono"
                  />
                  <span className="text-xs text-[hsl(220,10%,50%)]">Deducted from driver gross earnings per trip</span>
                </div>

                <div>
                  <label className="block text-sm text-[hsl(220,10%,60%)] mb-1">
                    Max Passenger Cancellations per Day
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    defaultValue={currentSettings.max_cancellations_per_day ?? 3}
                    onChange={(e) => setSettingsForm({ ...settingsForm, max_cancellations_per_day: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl bg-[hsl(220,15%,10%)] border border-[hsl(220,15%,24%)] text-white focus:outline-none focus:border-[hsl(38,95%,55%)] font-mono"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={updateSettingsMutation.isPending}
                    className="w-full py-2.5 rounded-xl bg-[hsl(38,95%,55%)] text-[hsl(220,15%,10%)] font-bold hover:brightness-110 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {updateSettingsMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    Save Platform Policies
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Tab 2: Admins List */}
        {activeTab === 'admins' && (
          <div className="rounded-2xl bg-[hsl(220,15%,16%)] border border-[hsl(220,15%,24%)] overflow-hidden">
            <div className="p-5 border-b border-[hsl(220,15%,24%)] flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white">Privileged Administrator Accounts</h3>
                <p className="text-xs text-[hsl(220,10%,60%)]">Operations admins with portal access</p>
              </div>
            </div>

            {adminsLoading ? (
              <div className="p-8 text-center text-[hsl(220,10%,60%)]">
                <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                Loading administrators...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[hsl(220,15%,12%)] text-[hsl(220,10%,60%)] border-b border-[hsl(220,15%,24%)]">
                    <tr>
                      <th className="p-4">Name</th>
                      <th className="p-4">Email</th>
                      <th className="p-4">Role</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[hsl(220,15%,20%)] text-white">
                    {admins.map((adm) => (
                      <tr key={adm.user_id} className="hover:bg-[hsl(220,15%,18%)] transition">
                        <td className="p-4 font-semibold">{adm.name}</td>
                        <td className="p-4 text-[hsl(220,10%,60%)] font-mono">{adm.email}</td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-900/30 text-blue-400">
                            {adm.role}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            adm.status === 'active' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
                          }`}>
                            {adm.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: System Logs */}
        {activeTab === 'logs' && (
          <div className="rounded-2xl bg-[hsl(220,15%,16%)] border border-[hsl(220,15%,24%)] overflow-hidden">
            <div className="p-5 border-b border-[hsl(220,15%,24%)]">
              <h3 className="font-semibold text-white">Chronological System Audit Trail</h3>
              <p className="text-xs text-[hsl(220,10%,60%)]">Immutable security event and moderation log records</p>
            </div>

            {logsLoading ? (
              <div className="p-8 text-center text-[hsl(220,10%,60%)]">
                <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                Loading audit trail...
              </div>
            ) : logs.length === 0 ? (
              <div className="p-8 text-center text-[hsl(220,10%,60%)]">No system logs recorded yet</div>
            ) : (
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[hsl(220,15%,12%)] text-[hsl(220,10%,60%)] border-b border-[hsl(220,15%,24%)] sticky top-0">
                    <tr>
                      <th className="p-4">Action</th>
                      <th className="p-4">Description</th>
                      <th className="p-4">IP Address</th>
                      <th className="p-4">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[hsl(220,15%,20%)] text-white">
                    {logs.map((log) => (
                      <tr key={log.log_id} className="hover:bg-[hsl(220,15%,18%)] transition">
                        <td className="p-4 font-mono text-xs font-semibold text-[hsl(38,95%,55%)]">
                          {log.action}
                        </td>
                        <td className="p-4 text-[hsl(220,15%,85%)] text-xs">{log.description}</td>
                        <td className="p-4 font-mono text-xs text-[hsl(220,10%,60%)]">{log.ip_address || '127.0.0.1'}</td>
                        <td className="p-4 text-xs text-[hsl(220,10%,50%)]">
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
      </main>
    </div>
  );
}
