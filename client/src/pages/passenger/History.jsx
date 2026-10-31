import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Car, Clock, DollarSign, CheckCircle } from 'lucide-react';
import AppShell from '../../components/ui/AppShell';
import { KPICard, StatusBadge, EmptyState, Skeleton } from '../../components/ui/UIKit';

export default function PassengerHistory() {
  const { data, isLoading } = useQuery({
    queryKey: ['passengerTrips'],
    queryFn: () => api.get('/passenger/trips').then((r) => r.data),
  });

  const trips = data?.trips || data?.data || [];

  const totalSpent = trips.reduce(
    (acc, t) =>
      acc + (t.status === 'completed' || t.trip_status === 'completed'
        ? Number(t.fare || t.estimated_fare || 0)
        : 0),
    0
  );

  const completedCount = trips.filter((t) => (t.status || t.trip_status) === 'completed').length;
  const cancelledCount = trips.filter((t) => (t.status || t.trip_status) === 'cancelled').length;

  return (
    <AppShell
      title="Ride History"
      subtitle="Review all your past journeys"
      action={
        <Link to="/passenger/book-ride" className="btn-primary text-sm">
          + Book Ride
        </Link>
      }
    >
      <div className="space-y-5 animate-fade-in">

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card-sm p-5 space-y-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-7 w-16" />
              </div>
            ))
          ) : (
            <>
              <KPICard label="Total Trips"  value={trips.length}           icon={Car}          iconClass="text-info" />
              <KPICard label="Completed"    value={completedCount}          icon={CheckCircle}  iconClass="text-success" />
              <KPICard label="Cancelled"    value={cancelledCount}          icon={Car}          iconClass="text-error" />
              <KPICard label="Total Spent"  value={`₹${totalSpent.toFixed(0)}`} icon={DollarSign} iconClass="text-brand" accentBg />
            </>
          )}
        </div>

        {/* Trip List */}
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-line">
            <h2 className="text-sm font-semibold text-ink">All Trips</h2>
            <p className="text-xs text-ink-muted mt-0.5">{trips.length} total records</p>
          </div>

          {isLoading ? (
            <div className="p-5 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-56" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : trips.length === 0 ? (
            <EmptyState
              icon={Car}
              title="No trips found"
              description="Your completed, cancelled, and active trips will appear here."
              action={
                <Link to="/passenger/book-ride" className="btn-primary">
                  Book your first ride
                </Link>
              }
            />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Ride</th>
                      <th>Route</th>
                      <th>Date</th>
                      <th>Vehicle</th>
                      <th>Fare</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trips.map((ride) => {
                      const rid = ride.request_id || ride.trip_id;
                      const status = ride.status || ride.trip_status;
                      return (
                        <tr key={rid}>
                          <td>
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-canvas flex items-center justify-center text-sm flex-shrink-0">
                                🚖
                              </div>
                              <span className="font-mono text-xs text-ink-muted">#{rid}</span>
                            </div>
                          </td>
                          <td>
                            <div className="text-sm font-medium text-ink max-w-[220px] truncate">
                              {ride.pickup_location} → {ride.destination}
                            </div>
                          </td>
                          <td>
                            <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                              <Clock size={12} />
                              {ride.requested_at || ride.start_time || '—'}
                            </div>
                          </td>
                          <td>
                            <span className="badge bg-canvas text-ink-muted capitalize">
                              {ride.vehicle_type || 'Sedan'}
                            </span>
                          </td>
                          <td>
                            <span className="text-sm font-semibold text-ink">
                              ₹{ride.fare || ride.estimated_fare || '—'}
                            </span>
                          </td>
                          <td><StatusBadge status={status} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="sm:hidden divide-y divide-[#F3F4F6]">
                {trips.map((ride) => {
                  const rid = ride.request_id || ride.trip_id;
                  const status = ride.status || ride.trip_status;
                  return (
                    <div key={rid} className="px-4 py-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-canvas flex items-center justify-center text-lg flex-shrink-0">
                        🚖
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-ink truncate">
                          {ride.pickup_location} → {ride.destination}
                        </div>
                        <div className="text-xs text-ink-muted mt-0.5 capitalize">
                          {ride.vehicle_type || 'Sedan'} · {ride.requested_at || ride.start_time || 'Recent'}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-semibold text-ink mb-1">₹{ride.fare || ride.estimated_fare || '—'}</div>
                        <StatusBadge status={status} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
