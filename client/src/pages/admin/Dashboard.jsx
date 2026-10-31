import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import { Users, Car, DollarSign, Activity, CheckCircle, XCircle, Loader2, Shield } from 'lucide-react';
import AppShell from '../../components/ui/AppShell';
import { KPICard, StatusBadge, EmptyState, Skeleton, Toast } from '../../components/ui/UIKit';
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
    refetchInterval: 30000,
  });

  const { data: fareData, isLoading: fareLoading } = useQuery({
    queryKey: ['fareRules'],
    queryFn: () => api.get('/admin/fare-rules').then((r) => r.data),
    enabled: activeTab === 'fares',
  });

  const verifyDriverMutation = useMutation({
    mutationFn: ({ id, status }) => api.put(`/admin/drivers/${id}/status`, { status }),
    onSuccess: () => {
      showToast('Driver status updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
    },
    onError: (err) => showToast(err.response?.data?.message || 'Failed to update driver status'),
  });

  const stats = statsData?.stats || statsData || {};
  const rules = fareData?.rules || [];

  const TABS = [
    { id: 'overview', label: 'Platform Overview' },
    { id: 'fares',    label: 'Fare Rules' },
  ];

  return (
    <AppShell
      title="Operations Console"
      subtitle="Platform monitoring and configuration"
    >
      <Toast message={toastMsg} />

      <div className="space-y-5 animate-fade-in">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-canvas border border-line rounded-xl p-1 w-fit">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-semibold transition',
                activeTab === id
                  ? 'bg-white text-ink shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-5">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {statsLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="card-sm p-5 space-y-3">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                ))
              ) : (
                <>
                  <KPICard
                    label="Total Trips"
                    value={stats.trips?.total ?? stats.total_trips ?? 0}
                    icon={Activity}
                    iconClass="text-info"
                  />
                  <KPICard
                    label="Active Drivers"
                    value={stats.drivers?.online ?? stats.online_drivers ?? 0}
                    icon={Car}
                    iconClass="text-success"
                  />
                  <KPICard
                    label="Registered Users"
                    value={stats.passengers?.total ?? stats.total_passengers ?? 0}
                    icon={Users}
                    iconClass="text-info"
                  />
                  <KPICard
                    label="Gross Fare Volume"
                    value={`₹${stats.revenue?.total_fare_volume ?? '0'}`}
                    icon={DollarSign}
                    iconClass="text-brand"
                    accentBg
                  />
                </>
              )}
            </div>

            {/* Pending Driver Approvals */}
            {stats.drivers?.pending_approval > 0 && (
              <div className="card overflow-hidden">
                <div className="px-6 py-4 border-b border-line flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-ink">
                    Pending Driver Approvals
                    <span className="ml-2 badge bg-warning-bg text-warning">{stats.drivers.pending_approval}</span>
                  </h2>
                </div>
                {statsLoading ? (
                  <div className="p-5">
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : (
                  <div className="p-5 text-sm text-ink-muted">
                    {stats.drivers.pending_approval} driver(s) awaiting verification. Review in driver management.
                  </div>
                )}
              </div>
            )}

            {/* Info Card */}
            <div className="card-sm p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-brand-light flex items-center justify-center flex-shrink-0">
                <Shield size={18} className="text-brand" />
              </div>
              <div>
                <div className="text-sm font-semibold text-ink mb-1">Operations Management Console</div>
                <p className="text-sm text-ink-muted leading-relaxed">
                  As an Operations Admin, you can review dispatch status, inspect driver verification,
                  audit vehicle fleet roadworthiness, and adjust dynamic tariffs.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'fares' && (
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-line">
              <h2 className="text-sm font-semibold text-ink">Vehicle Fare Rules Matrix</h2>
              <p className="text-xs text-ink-muted mt-0.5">Per-km and base tariffs applied to ride estimates</p>
            </div>

            {fareLoading ? (
              <div className="p-8 text-center text-ink-muted">
                <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                Loading fare rules…
              </div>
            ) : rules.length === 0 ? (
              <EmptyState icon={Car} title="No fare rules configured" description="Add fare rules to enable ride pricing." />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Vehicle Type</th>
                      <th>Base Fare</th>
                      <th>Rate per KM</th>
                      <th>Rate per Minute</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((r) => (
                      <tr key={r.fare_id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="text-base">🚗</span>
                            <span className="font-semibold capitalize text-ink">{r.vehicle_type}</span>
                          </div>
                        </td>
                        <td><span className="font-mono text-sm">₹{r.base_fare}</span></td>
                        <td><span className="font-mono text-sm">₹{r.per_km_rate}/km</span></td>
                        <td><span className="font-mono text-sm">₹{r.per_minute_rate}/min</span></td>
                        <td><StatusBadge status={r.status} /></td>
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
