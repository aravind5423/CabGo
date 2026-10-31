import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import {
  Car, Clock, Plus, DollarSign, CheckCircle, XCircle, Loader2,
  MapPin, Navigation, Zap, TrendingUp
} from 'lucide-react';
import AppShell from '../../components/ui/AppShell';
import { KPICard, StatusBadge, EmptyState, Skeleton, Toast } from '../../components/ui/UIKit';
import clsx from 'clsx';

export default function PassengerDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['passengerDashboard'],
    queryFn: () => api.get('/passenger/dashboard').then((r) => r.data),
    refetchInterval: 4000,
  });

  const stats      = dashboardData?.stats      || { total_rides: 0, completed_rides: 0, cancelled_rides: 0, total_spent: 0 };
  const activeRide = dashboardData?.activeRide || null;
  const recentRides = dashboardData?.recentRides || [];

  const cancelMutation = useMutation({
    mutationFn: (requestId) => api.post(`/rides/cancel/${requestId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['passengerDashboard'] }),
  });

  return (
    <AppShell
      title={`Welcome back, ${user?.name?.split(' ')[0] || 'there'} 👋`}
      subtitle="Here's what's happening with your rides."
      action={
        <Link to="/passenger/book-ride" className="btn-primary text-sm gap-2">
          <Plus size={15} /> Book a Ride
        </Link>
      }
    >
      {/* Active Ride Banner */}
      {activeRide && (
        <div className="mb-5 p-5 rounded-2xl bg-warning-bg border border-warning/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-warning animate-pulse flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-ink">Ride #{activeRide.request_id} is active</div>
              <div className="text-xs text-ink-muted mt-0.5">{activeRide.pickup_location} → {activeRide.destination}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <StatusBadge status={activeRide.status} />
            <Link to="/passenger/active-trip" className="btn-primary text-xs px-3 py-2 gap-1.5">
              <Navigation size={13} /> Track Ride
            </Link>
            {(activeRide.status === 'pending' || activeRide.status === 'accepted') && (
              <button
                onClick={() => cancelMutation.mutate(activeRide.request_id)}
                disabled={cancelMutation.isPending}
                className="btn-danger text-xs px-3 py-2 gap-1.5"
              >
                {cancelMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card-sm p-5 space-y-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))
        ) : (
          <>
            <KPICard label="Total Rides"    value={stats.total_rides ?? 0}     icon={Car}         iconClass="text-info" />
            <KPICard label="Completed"      value={stats.completed_rides ?? 0} icon={CheckCircle} iconClass="text-success" />
            <KPICard label="Cancelled"      value={stats.cancelled_rides ?? 0} icon={XCircle}     iconClass="text-error" />
            <KPICard label="Total Spent"    value={`₹${stats.total_spent ?? 0}`} icon={DollarSign} iconClass="text-brand" accentBg />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Quick Actions */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-ink-muted uppercase tracking-wide">Quick Actions</h2>

          <Link
            to="/passenger/book-ride"
            className="card-sm p-4 flex items-center gap-4 hover:border-brand/30 hover:shadow-md transition group"
          >
            <div className="w-10 h-10 rounded-xl bg-brand-light flex items-center justify-center flex-shrink-0 group-hover:bg-brand/20 transition">
              <MapPin size={18} className="text-brand" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-ink">Book a Ride</div>
              <div className="text-xs text-ink-muted">Find a driver nearby</div>
            </div>
          </Link>

          <Link
            to="/passenger/active-trip"
            className="card-sm p-4 flex items-center gap-4 hover:border-info/30 hover:shadow-md transition group"
          >
            <div className="w-10 h-10 rounded-xl bg-info-bg flex items-center justify-center flex-shrink-0 group-hover:bg-info/20 transition">
              <Navigation size={18} className="text-info" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-ink">Active Trip HUD</div>
              <div className="text-xs text-ink-muted">
                {activeRide ? 'Ride in progress · View live tracking' : 'Track ongoing rides'}
              </div>
            </div>
          </Link>

          <Link
            to="/passenger/history"
            className="card-sm p-4 flex items-center gap-4 hover:border-warning/30 hover:shadow-md transition group"
          >
            <div className="w-10 h-10 rounded-xl bg-warning-bg flex items-center justify-center flex-shrink-0 group-hover:bg-warning/20 transition">
              <Clock size={18} className="text-warning" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-ink">Ride History</div>
              <div className="text-xs text-ink-muted">View all past journeys</div>
            </div>
          </Link>
        </div>

        {/* Recent Rides */}
        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-line flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Recent Rides</h2>
              <Link to="/passenger/history" className="text-xs text-brand font-semibold hover:underline">
                View all
              </Link>
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
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            ) : recentRides.length === 0 ? (
              <EmptyState
                icon={Car}
                title="No rides yet"
                description="Your recent ride history will appear here."
                action={
                  <Link to="/passenger/book-ride" className="btn-primary text-sm">
                    Book your first ride
                  </Link>
                }
              />
            ) : (
              <div className="divide-y divide-[#F3F4F6]">
                {recentRides.map((ride) => (
                  <div key={ride.request_id} className="px-5 py-4 flex items-center gap-3 hover:bg-canvas transition">
                    <div className="w-10 h-10 rounded-xl bg-canvas flex items-center justify-center text-lg flex-shrink-0">
                      🚖
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-ink truncate">
                        {ride.pickup_location} → {ride.destination}
                      </div>
                      <div className="text-xs text-ink-muted mt-0.5 flex items-center gap-2">
                        <Clock size={11} />
                        <span>{ride.requested_at || 'Recent'}</span>
                        <span className="text-ink-faint">·</span>
                        <span className="capitalize">{ride.vehicle_type || 'Sedan'}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-semibold text-ink mb-1">₹{ride.estimated_fare || '—'}</div>
                      <StatusBadge status={ride.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
