import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { useTripStore } from '../../store/tripStore';
import { api, errorMessage } from '../../services/api';
import { Car, Clock, Plus, Wallet, CheckCircle2, XCircle, MapPin, Navigation, ChevronRight, ArrowUpRight } from 'lucide-react';
import AppShell from '../../components/ui/AppShell';
import { KPICard, StatusBadge, EmptyState, SkeletonKPIs, SkeletonRows, IconChip, Toast, useToast, Spinner } from '../../components/ui/UIKit';
import { formatCurrency, formatDate, capitalize } from '../../utils/format';

const QUICK_ACTIONS = [
  { to: '/passenger/book-ride',   icon: MapPin,     tone: 'brand', title: 'Book a ride',   desc: 'Get a fare quote and request a driver' },
  { to: '/passenger/active-trip', icon: Navigation, tone: 'blue',  title: 'Active trip',   desc: 'Track your current ride live' },
  { to: '/passenger/history',     icon: Clock,      tone: 'amber', title: 'Trip history',  desc: 'Past trips, receipts and ratings' },
];

export default function PassengerDashboard() {
  const { user } = useAuthStore();
  const setActiveTrip = useTripStore((s) => s.setActiveTrip);
  const queryClient = useQueryClient();
  const [toast, showToast] = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['passengerDashboard'],
    queryFn: () => api.get('/passenger/dashboard').then((r) => r.data),
    refetchInterval: 5000,
  });

  const stats       = data?.stats       || {};
  const activeRide  = data?.activeRide  || null;
  const recentRides = data?.recentRides || [];

  const cancelMutation = useMutation({
    mutationFn: (requestId) => api.post(`/rides/cancel/${requestId}`),
    onSuccess: () => {
      setActiveTrip(null);
      showToast('Ride request cancelled.');
      queryClient.invalidateQueries({ queryKey: ['passengerDashboard'] });
    },
    onError: (err) => showToast(errorMessage(err), 'error'),
  });

  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <AppShell
      title={`Welcome back, ${firstName}`}
      subtitle="Overview of your rides and spending"
      action={
        <Link to="/passenger/book-ride" className="btn-primary">
          <Plus size={16} /> Book a ride
        </Link>
      }
    >
      <Toast toast={toast} />
      <div className="space-y-6">
        {activeRide && (
          <div className="card p-5 border-l-4 border-l-emerald-500 animate-slide-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <IconChip icon={Car} tone="brand" size="lg" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                    <span className="live-dot" /> Current ride · #{activeRide.request_id}
                  </div>
                  <div className="text-[15px] font-semibold text-slate-900 mt-0.5 truncate">
                    {activeRide.pickup_location} → {activeRide.destination}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {capitalize(activeRide.vehicle_type)} · {formatCurrency(activeRide.estimated_fare)}
                    {activeRide.driver_name && <> · Driver: {activeRide.driver_name}</>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={activeRide.trip_status || activeRide.status} />
                <Link to="/passenger/active-trip" className="btn-primary btn-sm">
                  <Navigation size={14} /> Track ride
                </Link>
                {['pending', 'accepted'].includes(activeRide.status) && (
                  <button
                    onClick={() => window.confirm('Cancel this ride request?') && cancelMutation.mutate(activeRide.request_id)}
                    disabled={cancelMutation.isPending}
                    className="btn-danger-soft btn-sm"
                  >
                    {cancelMutation.isPending ? <Spinner size={13} /> : <XCircle size={14} />} Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading ? <SkeletonKPIs /> : (
            <>
              <KPICard label="Total bookings" value={stats.total_rides ?? 0} icon={Car} tone="blue" />
              <KPICard label="Completed trips" value={stats.completed_rides ?? 0} icon={CheckCircle2} tone="brand" />
              <KPICard label="Cancelled" value={stats.cancelled_rides ?? 0} icon={XCircle} tone="rose" />
              <KPICard label="Total spent" value={formatCurrency(stats.total_spent ?? 0)} icon={Wallet} tone="amber" hint="Completed trips only" />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">Quick actions</h3>
            {QUICK_ACTIONS.map(({ to, icon, tone, title, desc }) => (
              <Link key={to} to={to} className="card card-hover p-4 flex items-center justify-between gap-3 group">
                <div className="flex items-center gap-3.5 min-w-0">
                  <IconChip icon={icon} tone={tone} />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">{title}</div>
                    <div className="text-xs text-slate-500 truncate">{desc}</div>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400 group-hover:text-slate-700 transition-colors flex-shrink-0" />
              </Link>
            ))}
          </div>

          <div className="lg:col-span-2 card overflow-hidden">
            <div className="card-header">
              <div className="card-title">Recent rides</div>
              <Link to="/passenger/history" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1">
                View all <ArrowUpRight size={13} />
              </Link>
            </div>
            {isLoading ? <SkeletonRows rows={4} /> : recentRides.length === 0 ? (
              <EmptyState
                icon={Car}
                title="No rides yet"
                description="Your trips will appear here once you book your first ride."
                action={<Link to="/passenger/book-ride" className="btn-primary btn-sm">Book your first ride</Link>}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr><th>Route</th><th>When</th><th>Vehicle</th><th>Fare</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {recentRides.map((ride) => (
                      <tr key={ride.request_id}>
                        <td>
                          <div className="font-medium text-slate-900 max-w-[260px] truncate">{ride.pickup_location} → {ride.destination}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">#{ride.request_id}</div>
                        </td>
                        <td className="text-slate-600 whitespace-nowrap">{formatDate(ride.requested_at)}</td>
                        <td><span className="badge badge-neutral">{capitalize(ride.vehicle_type)}</span></td>
                        <td className="font-semibold text-slate-900">{formatCurrency(ride.estimated_fare)}</td>
                        <td><StatusBadge status={ride.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
