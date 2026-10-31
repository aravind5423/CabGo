import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { DollarSign, Navigation, Star, CheckCircle, Clock, MapPin } from 'lucide-react';
import AppShell from '../../components/ui/AppShell';
import { KPICard, EmptyState, Skeleton, StatusBadge } from '../../components/ui/UIKit';

export default function DriverEarnings() {
  const { data, isLoading } = useQuery({
    queryKey: ['driverEarnings'],
    queryFn: () => api.get('/driver/earnings').then((r) => r.data),
  });

  const earnings = data?.earnings || data || {};
  const trips = earnings.trips || earnings.recent_trips || [];
  const totalEarnings = earnings.total_earnings || earnings.total || 0;
  const tripCount = earnings.trip_count || trips.length || 0;
  const avgRating = earnings.avg_rating || '5.0';

  return (
    <AppShell title="Earnings" subtitle="Your trip fare disbursements and performance analytics">
      <div className="space-y-5 animate-fade-in">

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card-sm p-5 space-y-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-24" />
              </div>
            ))
          ) : (
            <>
              <KPICard
                label="Total Net Payout"
                value={`₹${Number(totalEarnings).toFixed(2)}`}
                icon={DollarSign}
                iconClass="text-brand"
                accentBg
                trendLabel="100% direct settlement"
              />
              <KPICard
                label="Fulfilled Trips"
                value={tripCount}
                icon={Navigation}
                iconClass="text-info"
                trendLabel="Zero cancellation deductions"
              />
              <KPICard
                label="Service Rating"
                value={avgRating}
                icon={Star}
                iconClass="text-warning"
                trendLabel="Top 5% partner rating"
              />
            </>
          )}
        </div>

        {/* Trips Statement Table */}
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-line flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-ink">Per-Trip Fare Receipts</h2>
              <p className="text-xs text-ink-muted mt-0.5">{trips.length} completed trips</p>
            </div>
          </div>

          {isLoading ? (
            <div className="p-5 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </div>
          ) : trips.length === 0 ? (
            <EmptyState
              icon={DollarSign}
              title="No earnings recorded"
              description="Complete trips to see your fare receipts here."
            />
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Trip</th>
                      <th>Route</th>
                      <th>Passenger</th>
                      <th>Distance</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th className="text-right">Fare</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trips.map((trip) => (
                      <tr key={trip.trip_id}>
                        <td>
                          <span className="font-mono text-xs text-ink-muted">#{trip.trip_id}</span>
                        </td>
                        <td>
                          <div className="text-sm font-medium text-ink max-w-[200px] truncate">
                            {trip.pickup_location} → {trip.destination}
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-canvas flex items-center justify-center font-semibold text-xs text-ink flex-shrink-0">
                              {trip.passenger_name?.[0]?.toUpperCase() || 'P'}
                            </div>
                            <span className="text-sm text-ink">{trip.passenger_name || '—'}</span>
                          </div>
                        </td>
                        <td>
                          <span className="text-sm text-ink-muted">{trip.distance_km || '—'} km</span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                            <Clock size={12} />
                            {trip.start_time || trip.created_at || '—'}
                          </div>
                        </td>
                        <td><StatusBadge status={trip.trip_status || 'completed'} /></td>
                        <td className="text-right">
                          <span className="text-sm font-bold text-success">+₹{trip.fare}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="sm:hidden divide-y divide-[#F3F4F6]">
                {trips.map((trip) => (
                  <div key={trip.trip_id} className="px-4 py-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-canvas flex items-center justify-center text-lg flex-shrink-0">
                      🚖
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-ink truncate">
                        {trip.pickup_location} → {trip.destination}
                      </div>
                      <div className="text-xs text-ink-muted mt-0.5">
                        {trip.passenger_name} · {trip.distance_km} km
                      </div>
                    </div>
                    <div className="text-sm font-bold text-success flex-shrink-0">+₹{trip.fare}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
