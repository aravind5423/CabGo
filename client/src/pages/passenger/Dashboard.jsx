import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import {
  Car, Clock, Plus, DollarSign, CheckCircle2, XCircle, Loader2,
  MapPin, Navigation, Zap, ChevronRight, ArrowUpRight
} from 'lucide-react';
import AppShell from '../../components/ui/AppShell';
import { KPICard, StatusBadge, EmptyState, Skeleton } from '../../components/ui/UIKit';

export default function PassengerDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['passengerDashboard'],
    queryFn: () => api.get('/passenger/dashboard').then((r) => r.data),
    refetchInterval: 4000,
  });

  const stats       = dashboardData?.stats       || { total_rides: 0, completed_rides: 0, cancelled_rides: 0, total_spent: 0 };
  const activeRide  = dashboardData?.activeRide  || null;
  const recentRides = dashboardData?.recentRides || [];

  const cancelMutation = useMutation({
    mutationFn: (requestId) => api.post(`/rides/cancel/${requestId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['passengerDashboard'] }),
  });

  const firstName = user?.name?.split(' ')[0] || 'Passenger';

  return (
    <AppShell
      title={`Welcome back, ${firstName} 👋`}
      subtitle="Here's a live overview of your urban transit activity."
      action={
        <Link to="/passenger/book-ride" className="btn-primary text-sm gap-2 shadow-lg shadow-emerald-500/20">
          <Plus size={16} /> Book New Ride
        </Link>
      }
    >
      <div className="space-y-6">
        {/* Active Ride Live Banner */}
        {activeRide && (
          <div className="card p-5 sm:p-6 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/30 shadow-lg shadow-amber-500/5 animate-slide-in relative overflow-hidden">
            <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-gradient-to-b from-amber-400 to-amber-600" />
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center flex-shrink-0 text-amber-600 shadow-inner">
                  <Car size={22} className="animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-amber-600 tracking-wider uppercase">Active Journey In Progress</span>
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  </div>
                  <div className="text-base font-bold text-slate-900 mt-0.5">
                    Ride #{activeRide.request_id}: {activeRide.pickup_location} → {activeRide.destination}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                    <span>Fare: ₹{activeRide.estimated_fare}</span>
                    <span>•</span>
                    <span className="capitalize">{activeRide.vehicle_type || 'Sedan'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 w-full md:w-auto">
                <StatusBadge status={activeRide.status} />
                <Link to="/passenger/active-trip" className="btn-primary text-xs px-4 py-2.5 gap-1.5 flex-1 md:flex-initial">
                  <Navigation size={14} /> Open Live Radar
                </Link>
                {(activeRide.status === 'pending' || activeRide.status === 'accepted') && (
                  <button
                    onClick={() => cancelMutation.mutate(activeRide.request_id)}
                    disabled={cancelMutation.isPending}
                    className="btn-danger text-xs px-3.5 py-2.5 gap-1.5"
                  >
                    {cancelMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={14} />}
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card p-5 space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-20" />
              </div>
            ))
          ) : (
            <>
              <KPICard
                label="Total Bookings"
                value={stats.total_rides ?? 0}
                icon={Car}
                gradient="linear-gradient(135deg,#3B82F6,#1D4ED8)"
                iconClass="text-white"
                trend={12}
                trendLabel="vs last month"
              />
              <KPICard
                label="Completed Trips"
                value={stats.completed_rides ?? 0}
                icon={CheckCircle2}
                gradient="linear-gradient(135deg,#10B981,#047857)"
                iconClass="text-white"
                trend={98}
                trendLabel="completion rate"
              />
              <KPICard
                label="Cancelled"
                value={stats.cancelled_rides ?? 0}
                icon={XCircle}
                gradient="linear-gradient(135deg,#EF4444,#B91C1C)"
                iconClass="text-white"
              />
              <KPICard
                label="Total Expenditure"
                value={`₹${stats.total_spent ?? 0}`}
                icon={DollarSign}
                gradient="linear-gradient(135deg,#16A34A,#15803D)"
                iconClass="text-white"
                accentBg
              />
            </>
          )}
        </div>

        {/* Layout Split: Quick Actions + Recent Rides */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions Panel */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Quick Actions</h3>

            <Link
              to="/passenger/book-ride"
              className="card card-hover p-4 flex items-center justify-between group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 flex items-center justify-center text-emerald-600 transition-transform duration-300 group-hover:scale-110">
                  <MapPin size={20} />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition">Book Instant Cab</div>
                  <div className="text-xs text-slate-500">Pick destination & dispatch</div>
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
            </Link>

            <Link
              to="/passenger/active-trip"
              className="card card-hover p-4 flex items-center justify-between group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-500/10 flex items-center justify-center text-blue-600 transition-transform duration-300 group-hover:scale-110">
                  <Navigation size={20} />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition">Live Ride Radar HUD</div>
                  <div className="text-xs text-slate-500">{activeRide ? 'Active trip streaming live' : 'View tracking stream'}</div>
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
            </Link>

            <Link
              to="/passenger/history"
              className="card card-hover p-4 flex items-center justify-between group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-500/10 flex items-center justify-center text-amber-600 transition-transform duration-300 group-hover:scale-110">
                  <Clock size={20} />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 group-hover:text-amber-700 transition">Trip History & Receipts</div>
                  <div className="text-xs text-slate-500">Past journeys & invoices</div>
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
            </Link>
          </div>

          {/* Recent Rides Table */}
          <div className="lg:col-span-2">
            <div className="card overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-sm font-bold text-slate-900">Recent Journeys</h3>
                <Link to="/passenger/history" className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                  View full history <ArrowUpRight size={14} />
                </Link>
              </div>

              {isLoading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="w-10 h-10 rounded-xl" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-28" />
                      </div>
                      <Skeleton className="h-6 w-16 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : recentRides.length === 0 ? (
                <EmptyState
                  icon={Car}
                  title="No rides taken yet"
                  description="When you take trips with Rydio, they'll appear here with live receipts and driver ratings."
                  action={
                    <Link to="/passenger/book-ride" className="btn-primary text-xs">
                      Book First Ride
                    </Link>
                  }
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Trip Route</th>
                        <th>Vehicle</th>
                        <th>Fare</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentRides.map((ride) => (
                        <tr key={ride.request_id} className="transition-colors hover:bg-slate-50">
                          <td>
                            <div>
                              <div className="text-xs font-bold text-slate-900 truncate max-w-xs">
                                {ride.pickup_location} → {ride.destination}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                #{ride.request_id} • {ride.requested_at || 'Recent'}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="badge bg-slate-100 text-slate-700 capitalize font-medium">
                              {ride.vehicle_type || 'Sedan'}
                            </span>
                          </td>
                          <td>
                            <span className="text-xs font-extrabold text-slate-900">
                              ₹{ride.estimated_fare || '—'}
                            </span>
                          </td>
                          <td>
                            <StatusBadge status={ride.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
