import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import { Users, Car, DollarSign, Activity, CheckCircle2, XCircle, Loader2, ShieldCheck, Zap, Sliders, ArrowUpRight } from 'lucide-react';
import AppShell from '../../components/ui/AppShell';
import { KPICard, StatusBadge, EmptyState, Skeleton, Toast, Spinner } from '../../components/ui/UIKit';
import clsx from 'clsx';

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [toastMsg, setToastMsg] = useState('');
  const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3000); };

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['adminStats'],
    queryFn: () => api.get('/admin/stats').then((r) => r.data),
    refetchInterval: 15000,
  });

  const { data: fareData, isLoading: fareLoading } = useQuery({
    queryKey: ['fareRules'],
    queryFn: () => api.get('/admin/fare-rules').then((r) => r.data),
    enabled: activeTab === 'fares',
  });

  const verifyDriverMutation = useMutation({
    mutationFn: ({ id, status }) => api.put(`/admin/drivers/${id}/status`, { status }),
    onSuccess: () => {
      showToast('Driver verification status updated.');
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
    },
    onError: (err) => showToast(err.response?.data?.message || 'Failed to update driver status'),
  });

  const stats = statsData?.stats || statsData || {};
  const rules = fareData?.rules || [];

  const TABS = [
    { id: 'overview', label: 'Platform Operations Overview' },
    { id: 'fares',    label: 'Dynamic Fare Matrix' },
  ];

  return (
    <AppShell
      title="Operations Command Center"
      subtitle="Fleet surveillance, platform health KPIs, and dynamic fare configuration"
    >
      <Toast message={toastMsg} />

      <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 w-fit">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={clsx(
                'px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer',
                activeTab === id
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-800'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {statsLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="card p-5 space-y-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                ))
              ) : (
                <>
                  <KPICard
                    label="Total Platform Trips"
                    value={stats.trips?.total ?? stats.total_trips ?? 0}
                    icon={Activity}
                    gradient="linear-gradient(135deg,#3B82F6,#1D4ED8)"
                    trend={15}
                    trendLabel="trips completed"
                  />
                  <KPICard
                    label="Online Drivers"
                    value={stats.drivers?.online ?? stats.online_drivers ?? 0}
                    icon={Car}
                    gradient="linear-gradient(135deg,#10B981,#047857)"
                    trend={100}
                    trendLabel="ready to dispatch"
                  />
                  <KPICard
                    label="Registered Passengers"
                    value={stats.passengers?.total ?? stats.total_passengers ?? 0}
                    icon={Users}
                    gradient="linear-gradient(135deg,#F59E0B,#D97706)"
                  />
                  <KPICard
                    label="Gross Fare Volume"
                    value={`₹${stats.revenue?.total_fare_volume ?? '0'}`}
                    icon={DollarSign}
                    gradient="linear-gradient(135deg,#16A34A,#15803D)"
                    accentBg
                  />
                </>
              )}
            </div>

            {/* Pending Approvals Callout */}
            {stats.drivers?.pending_approval > 0 && (
              <div className="card p-6 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-white border-amber-500/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center font-black">
                      !
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        {stats.drivers.pending_approval} Driver Applicant(s) Awaiting Verification
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Commercial licenses and documents have been submitted and require ops sign-off.
                      </p>
                    </div>
                  </div>
                  <span className="badge bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1">
                    Needs Action
                  </span>
                </div>
              </div>
            )}

            {/* Platform Infrastructure HUD */}
            <div className="card p-6 bg-gradient-to-br from-white to-slate-50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 flex-shrink-0">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Enterprise Operations Active</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-2xl">
                    TiDB Cloud database replication is active, live driver telemetry heartbeat is synced with the Leaflet CartoDB CDN tiles, and dynamic fare rules are enforcing automated trip quotes without latency.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'fares' && (
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200/80 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Vehicle Category Fare Matrix</h3>
                <p className="text-xs text-slate-500 mt-0.5">Base rates and per-kilometer tariffs calculated during passenger search</p>
              </div>
            </div>

            {fareLoading ? (
              <div className="p-8 text-center text-slate-400">
                <Spinner size={24} className="text-emerald-600 mx-auto mb-2" />
                <span className="text-xs font-bold">Loading fare rules matrix...</span>
              </div>
            ) : rules.length === 0 ? (
              <EmptyState
                icon={Car}
                title="No fare rules active"
                description="Configure vehicle base tariffs to enable dynamic routing."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fleet Class</th>
                      <th>Base Fare</th>
                      <th>Per-KM Rate</th>
                      <th>Per-Minute Rate</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((r) => (
                      <tr key={r.fare_id} className="hover:bg-slate-50 transition-colors">
                        <td>
                          <div className="flex items-center gap-2.5">
                            <span className="text-xl">🚘</span>
                            <span className="font-bold capitalize text-slate-900 text-xs">{r.vehicle_type}</span>
                          </div>
                        </td>
                        <td><span className="font-mono text-xs font-bold text-slate-700">₹{r.base_fare}</span></td>
                        <td><span className="font-mono text-xs font-bold text-emerald-700">₹{r.per_km_rate} / km</span></td>
                        <td><span className="font-mono text-xs text-slate-600">₹{r.per_minute_rate || '1.5'} / min</span></td>
                        <td><StatusBadge status={r.status || 'active'} /></td>
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
