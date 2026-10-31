import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Car, Clock, DollarSign, CheckCircle2, Search, ArrowUpRight, Calendar } from 'lucide-react';
import AppShell from '../../components/ui/AppShell';
import { KPICard, StatusBadge, EmptyState, Skeleton } from '../../components/ui/UIKit';

export default function PassengerHistory() {
  const [searchTerm, setSearchTerm] = useState('');

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

  const filteredTrips = trips.filter((t) => {
    const q = searchTerm.toLowerCase();
    const pickup = (t.pickup_location || '').toLowerCase();
    const dest = (t.destination || '').toLowerCase();
    const rid = String(t.request_id || t.trip_id || '');
    return pickup.includes(q) || dest.includes(q) || rid.includes(q);
  });

  return (
    <AppShell
      title="Ride History & Invoices"
      subtitle="Complete chronological record of all transit journeys taken"
      action={
        <Link to="/passenger/book-ride" className="btn-primary text-sm shadow-md shadow-emerald-500/20">
          + Book Ride
        </Link>
      }
    >
      <div className="space-y-6">
        {/* Summary KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card p-5 space-y-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-16" />
              </div>
            ))
          ) : (
            <>
              <KPICard
                label="Total Trips"
                value={trips.length}
                icon={Car}
                gradient="linear-gradient(135deg,#3B82F6,#1D4ED8)"
              />
              <KPICard
                label="Completed"
                value={completedCount}
                icon={CheckCircle2}
                gradient="linear-gradient(135deg,#10B981,#047857)"
              />
              <KPICard
                label="Cancelled"
                value={cancelledCount}
                icon={Car}
                gradient="linear-gradient(135deg,#EF4444,#B91C1C)"
              />
              <KPICard
                label="Total Spent"
                value={`₹${totalSpent.toFixed(0)}`}
                icon={DollarSign}
                gradient="linear-gradient(135deg,#16A34A,#15803D)"
                accentBg
              />
            </>
          )}
        </div>

        {/* Search & Filter Bar */}
        <div className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by route, address or ID..."
              className="input-field pl-10 text-xs py-2.5"
            />
          </div>
          <div className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
            <span>Showing {filteredTrips.length} records</span>
          </div>
        </div>

        {/* Trip List Table */}
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="w-10 h-10 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-56" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : filteredTrips.length === 0 ? (
            <EmptyState
              icon={Car}
              title="No rides found"
              description="No rides matched your search query or no journeys have been recorded yet."
              action={
                <Link to="/passenger/book-ride" className="btn-primary text-xs">
                  Book a Ride Now
                </Link>
              }
            />
          ) : (
            <>
              {/* Desktop View */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Booking Ref</th>
                      <th>Trip Route</th>
                      <th>Timestamp</th>
                      <th>Category</th>
                      <th>Fare</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrips.map((ride) => {
                      const rid = ride.request_id || ride.trip_id;
                      const status = ride.status || ride.trip_status;
                      return (
                        <tr key={rid} className="hover:bg-slate-50/80 transition-colors">
                          <td>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-slate-600">#{rid}</span>
                            </div>
                          </td>
                          <td>
                            <div className="text-xs font-bold text-slate-900 max-w-xs truncate">
                              {ride.pickup_location} → {ride.destination}
                            </div>
                          </td>
                          <td>
                            <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                              <Clock size={12} className="text-slate-400" />
                              <span>{ride.requested_at || ride.start_time || 'Recent'}</span>
                            </div>
                          </td>
                          <td>
                            <span className="badge bg-slate-100 text-slate-700 capitalize font-medium">
                              {ride.vehicle_type || 'Sedan'}
                            </span>
                          </td>
                          <td>
                            <span className="text-xs font-black text-slate-900">
                              ₹{ride.fare || ride.estimated_fare || '—'}
                            </span>
                          </td>
                          <td>
                            <StatusBadge status={status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile View */}
              <div className="sm:hidden divide-y divide-slate-100">
                {filteredTrips.map((ride) => {
                  const rid = ride.request_id || ride.trip_id;
                  const status = ride.status || ride.trip_status;
                  return (
                    <div key={rid} className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {ride.pickup_location} → {ride.destination}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                          <span>#{rid}</span>
                          <span>•</span>
                          <span className="capitalize">{ride.vehicle_type || 'Sedan'}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xs font-black text-slate-900 mb-1">
                          ₹{ride.fare || ride.estimated_fare || '—'}
                        </div>
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
