import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, errorMessage } from '../../services/api';
import { Wallet, Navigation, Route, TrendingUp } from 'lucide-react';
import AppShell from '../../components/ui/AppShell';
import { KPICard, EmptyState, SkeletonKPIs, SkeletonRows, StatusBadge, Tabs, Alert } from '../../components/ui/UIKit';
import { formatCurrency, formatDate, formatDistance, capitalize } from '../../utils/format';

const PERIODS = [
  { id: 'today', label: 'Today' },
  { id: 'week',  label: 'Last 7 days' },
  { id: 'month', label: 'Last 30 days' },
  { id: 'all',   label: 'All time' },
];

export default function DriverEarnings() {
  const [period, setPeriod] = useState('all');

  const { data, isLoading, error } = useQuery({
    queryKey: ['driverEarnings', period],
    queryFn: () => api.get('/driver/earnings', { params: { period } }).then((r) => r.data),
  });

  const summary = data?.summary || {};
  const trips   = data?.trips || [];

  return (
    <AppShell title="Earnings" subtitle="Completed trips and fare settlements">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Tabs tabs={PERIODS} value={period} onChange={setPeriod} />
          <span className="text-xs text-slate-500">{trips.length} completed trip{trips.length === 1 ? '' : 's'}</span>
        </div>

        {error && <Alert type="error">{errorMessage(error, 'Could not load earnings.')}</Alert>}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading ? <SkeletonKPIs /> : (
            <>
              <KPICard label="Total earnings" value={formatCurrency(summary.total_earnings ?? 0)} icon={Wallet} tone="brand" />
              <KPICard label="Completed trips" value={summary.total_trips ?? 0} icon={Navigation} tone="blue" />
              <KPICard label="Average fare" value={formatCurrency(summary.avg_fare ?? 0, { decimals: 0 })} icon={TrendingUp} tone="amber" />
              <KPICard label="Distance driven" value={formatDistance(summary.total_km ?? 0)} icon={Route} tone="slate" />
            </>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="card-header">
            <div>
              <div className="card-title">Trip ledger</div>
              <div className="card-subtitle">Fares are credited when a trip is completed</div>
            </div>
          </div>
          {isLoading ? <SkeletonRows rows={4} /> : trips.length === 0 ? (
            <EmptyState icon={Wallet} title="No completed trips in this period" description="Earnings appear here after you complete trips." />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr><th>Trip</th><th>Route</th><th>Passenger</th><th>Distance</th><th>Completed</th><th>Payment</th><th>Fare</th></tr>
                </thead>
                <tbody>
                  {trips.map((t) => (
                    <tr key={t.trip_id}>
                      <td><span className="font-mono text-xs font-semibold text-slate-700">#{t.trip_id}</span></td>
                      <td>
                        <div className="font-medium text-slate-900 max-w-[260px] truncate">{t.pickup_location} → {t.destination}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{capitalize(t.vehicle_type)}</div>
                      </td>
                      <td className="text-slate-700 whitespace-nowrap">{t.passenger_name || '—'}</td>
                      <td className="text-slate-700 whitespace-nowrap">{formatDistance(t.distance_km)}</td>
                      <td className="text-slate-600 whitespace-nowrap">{formatDate(t.end_time || t.start_time)}</td>
                      <td className="whitespace-nowrap">
                        {t.payment_status ? <><StatusBadge status={t.payment_status} /><div className="text-[11px] text-slate-400 mt-1 capitalize">{t.payment_method}</div></> : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="font-semibold text-emerald-700 whitespace-nowrap">+{formatCurrency(t.fare)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
