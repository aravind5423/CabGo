import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { DollarSign, Navigation, Star, CheckCircle2, Clock, MapPin, TrendingUp, ArrowDownRight, ShieldCheck } from 'lucide-react';
import AppShell from '../../components/ui/AppShell';
import { KPICard, EmptyState, Skeleton, StatusBadge } from '../../components/ui/UIKit';

export default function DriverEarnings() {
  const { data, isLoading } = useQuery({
    queryKey: ['driverEarnings'],
    queryFn: () => api.get('/driver/earnings').then((r) => r.data),
  });

  const earnings = data?.earnings || data || {};
  const trips = earnings.trips || earnings.recent_trips || [];
  const totalEarnings = earnings.total_earnings || earnings.total || earnings.summary?.total_earnings || 0;
  const tripCount = earnings.trip_count || trips.length || earnings.summary?.total_trips || 0;
  const avgRating = earnings.avg_rating || earnings.summary?.rating || '4.95';

  return (
    <AppShell title="Driver Earnings & Settlement" subtitle="Financial analytics, fare disbursements and payout statements">
      <div className="space-y-6">

        {/* Financial KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card p-5 space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-28" />
              </div>
            ))
          ) : (
            <>
              <KPICard
                label="Total Net Payout"
                value={`₹${Number(totalEarnings).toFixed(2)}`}
                icon={DollarSign}
                gradient="linear-gradient(135deg,#16A34A,#15803D)"
                accentBg
                trendLabel="Direct instant settlement"
              />
              <KPICard
                label="Fulfilled Trips"
                value={tripCount}
                icon={Navigation}
                gradient="linear-gradient(135deg,#3B82F6,#1D4ED8)"
                trendLabel="100% acceptance bonus"
              />
              <KPICard
                label="Partner Rating"
                value={avgRating}
                icon={Star}
                gradient="linear-gradient(135deg,#F59E0B,#D97706)"
                trendLabel="Premier Tier Partner"
              />
            </>
          )}
        </div>

        {/* Payout Summary Info */}
        <div className="card p-5 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-white border-emerald-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-500/20">
              <ShieldCheck size={20} />
            </div>
            <div>
              <div className="text-xs font-bold text-emerald-950 uppercase tracking-wider">Fast Settlement Guarantee</div>
              <div className="text-xs text-slate-500 mt-0.5">Fares are credited immediately upon passenger drop-off with 0% platform hidden fees.</div>
            </div>
          </div>
          <span className="badge bg-emerald-100 text-emerald-800 text-xs px-3 py-1 font-bold">
            Auto-Settlement Active
          </span>
        </div>

        {/* Trips Statement Table */}
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200/80 bg-slate-50/50 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Recent Trip Payout Ledger</h3>
            <span className="text-xs font-bold text-slate-500">{trips.length} transactions</span>
          </div>

          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="w-10 h-10 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : trips.length === 0 ? (
            <EmptyState
              icon={DollarSign}
              title="No Payouts Yet"
              description="Complete passenger rides from your Driver Cockpit to generate earnings statements."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Trip ID</th>
                    <th>Route</th>
                    <th>Distance</th>
                    <th>Completed Time</th>
                    <th>Net Payout</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {trips.map((t) => (
                    <tr key={t.trip_id} className="hover:bg-slate-50 transition-colors">
                      <td>
                        <span className="font-mono text-xs font-bold text-slate-600">#{t.trip_id}</span>
                      </td>
                      <td>
                        <div className="text-xs font-bold text-slate-900 max-w-xs truncate">
                          {t.pickup_location} → {t.destination}
                        </div>
                      </td>
                      <td>
                        <span className="text-xs text-slate-600 font-medium">
                          {t.distance_km ? `${t.distance_km} km` : '—'}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1 text-[11px] text-slate-400">
                          <Clock size={11} />
                          <span>{t.end_time || t.start_time || 'Recent'}</span>
                        </div>
                      </td>
                      <td>
                        <span className="text-xs font-black text-emerald-700">
                          +₹{t.fare || t.amount || '0'}
                        </span>
                      </td>
                      <td>
                        <StatusBadge status={t.trip_status || 'completed'} />
                      </td>
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
