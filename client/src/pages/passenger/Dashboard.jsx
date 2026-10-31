import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import {
  MapPin, Car, Clock, LogOut, Plus, Navigation, DollarSign, CheckCircle, XCircle, Loader2, Eye
} from 'lucide-react';

export default function PassengerDashboard() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // 1. Fetch dashboard data (stats, activeRide, recentRides)
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['passengerDashboard'],
    queryFn: () => api.get('/passenger/dashboard').then((r) => r.data),
    refetchInterval: 4000,
  });

  const stats = dashboardData?.stats || { total_rides: 0, completed_rides: 0, cancelled_rides: 0, total_spent: 0 };
  const activeRide = dashboardData?.activeRide || null;
  const recentRides = dashboardData?.recentRides || [];

  // 2. Cancel ride mutation
  const cancelMutation = useMutation({
    mutationFn: (requestId) => api.post(`/rides/cancel/${requestId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passengerDashboard'] });
    },
  });

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch (_) {}
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[hsl(220,15%,10%)] pb-12">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 border-b border-[hsl(220,15%,24%)] bg-[hsl(220,15%,10%)]/95 backdrop-blur">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚖</span>
            <span className="font-bold text-white text-xl font-['Outfit']">CabGo</span>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-cyan-900/40 text-cyan-400 border border-cyan-500/30">
              Passenger
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1 text-xs font-semibold">
            <Link
              to="/passenger/dashboard"
              className="px-3 py-1.5 rounded-lg bg-[hsl(220,15%,18%)] text-white"
            >
              Dashboard
            </Link>
            <Link
              to="/passenger/book-ride"
              className="px-3 py-1.5 rounded-lg text-[hsl(220,10%,60%)] hover:text-white hover:bg-[hsl(220,15%,16%)] transition"
            >
              Book Ride
            </Link>
            <Link
              to="/passenger/active-trip"
              className="px-3 py-1.5 rounded-lg text-[hsl(220,10%,60%)] hover:text-white hover:bg-[hsl(220,15%,16%)] transition"
            >
              Active Trip
            </Link>
            <Link
              to="/passenger/history"
              className="px-3 py-1.5 rounded-lg text-[hsl(220,10%,60%)] hover:text-white hover:bg-[hsl(220,15%,16%)] transition"
            >
              History
            </Link>
            <Link
              to="/passenger/profile"
              className="px-3 py-1.5 rounded-lg text-[hsl(220,10%,60%)] hover:text-white hover:bg-[hsl(220,15%,16%)] transition"
            >
              Profile
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link
            to="/passenger/profile"
            className="text-[hsl(220,10%,60%)] hover:text-white text-sm hidden sm:block font-medium"
          >
            👋 {user?.name}
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm text-[hsl(220,10%,60%)] hover:text-white hover:bg-[hsl(220,15%,16%)] border border-transparent hover:border-[hsl(220,15%,24%)] transition cursor-pointer"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* ACTIVE RIDE CARD (If ongoing) */}
        {activeRide && (
          <div className="p-6 rounded-2xl bg-amber-500/10 border-2 border-amber-500/50 shadow-xl space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-amber-300 font-extrabold text-lg">
                  Ongoing Ride #{activeRide.request_id}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500 text-black">
                  {activeRide.status.replace('_', ' ')}
                </span>
              </div>
              <div className="text-xl font-extrabold text-amber-400">
                ₹{activeRide.estimated_fare}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 text-sm bg-[hsl(220,15%,12%)] p-4 rounded-xl border border-[hsl(220,15%,20%)]">
              <div className="flex items-center gap-2 text-white">
                <MapPin size={16} className="text-emerald-400 flex-shrink-0" />
                <span className="truncate">From: {activeRide.pickup_location}</span>
              </div>
              <div className="flex items-center gap-2 text-white">
                <Navigation size={16} className="text-red-400 flex-shrink-0" />
                <span className="truncate">To: {activeRide.destination}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Link
                to="/passenger/active-trip"
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-sm transition cursor-pointer shadow"
              >
                <Eye size={18} />
                Track on Live Map
              </Link>
              <button
                type="button"
                onClick={() => cancelMutation.mutate(activeRide.request_id)}
                disabled={cancelMutation.isPending}
                className="flex items-center justify-center gap-1.5 py-3 px-5 rounded-xl border border-red-500/40 text-red-400 hover:bg-red-950/30 font-bold text-sm transition cursor-pointer disabled:opacity-50"
              >
                {cancelMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                Cancel Ride
              </button>
            </div>
          </div>
        )}

        {/* Quick CTA Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            to="/passenger/book-ride"
            className="flex items-center gap-4 p-5 rounded-2xl border border-amber-500/40 bg-amber-500 hover:bg-amber-400 transition group cursor-pointer shadow-lg"
          >
            <div className="w-12 h-12 rounded-xl bg-black/20 flex items-center justify-center flex-shrink-0">
              <Plus size={26} className="text-black" />
            </div>
            <div>
              <div className="font-extrabold text-black text-lg">Book a New Ride</div>
              <div className="text-black/75 text-sm">Find nearby cabs with live fare quote</div>
            </div>
          </Link>

          <Link
            to="/passenger/active-trip"
            className="flex items-center gap-4 p-5 rounded-2xl border border-[hsl(220,15%,24%)] bg-[hsl(220,15%,14%)] hover:bg-[hsl(220,15%,18%)] transition cursor-pointer shadow"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
              <MapPin size={26} />
            </div>
            <div>
              <div className="font-bold text-white text-lg">Active Trip HUD</div>
              <div className="text-[hsl(220,10%,60%)] text-sm">
                {activeRide ? 'Ride in progress • View live telemetry' : 'Track ongoing ride or status'}
              </div>
            </div>
          </Link>
        </div>

        {/* Passenger KPI Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[hsl(220,15%,14%)] border border-[hsl(220,15%,22%)]">
            <div className="flex items-center justify-between text-xs text-[hsl(220,10%,60%)] mb-1">
              <span>Total Rides</span>
              <Car size={14} className="text-cyan-400" />
            </div>
            <div className="text-2xl font-extrabold text-white">{stats.total_rides ?? 0}</div>
          </div>

          <div className="p-4 rounded-xl bg-[hsl(220,15%,14%)] border border-[hsl(220,15%,22%)]">
            <div className="flex items-center justify-between text-xs text-[hsl(220,10%,60%)] mb-1">
              <span>Completed</span>
              <CheckCircle size={14} className="text-emerald-400" />
            </div>
            <div className="text-2xl font-extrabold text-emerald-400">{stats.completed_rides ?? 0}</div>
          </div>

          <div className="p-4 rounded-xl bg-[hsl(220,15%,14%)] border border-[hsl(220,15%,22%)]">
            <div className="flex items-center justify-between text-xs text-[hsl(220,10%,60%)] mb-1">
              <span>Total Spent</span>
              <DollarSign size={14} className="text-amber-400" />
            </div>
            <div className="text-2xl font-extrabold text-amber-400">₹{stats.total_spent ?? 0}</div>
          </div>
        </div>

        {/* Trip History */}
        <div className="p-6 rounded-2xl border border-[hsl(220,15%,22%)] bg-[hsl(220,15%,14%)]">
          <h3 className="text-base font-bold text-white mb-4 uppercase tracking-wider text-[hsl(220,10%,70%)]">
            Recent Rides History
          </h3>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-[hsl(220,15%,18%)] animate-pulse" />
              ))}
            </div>
          ) : recentRides.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Car size={40} className="text-[hsl(220,10%,40%)] mb-2" />
              <p className="text-[hsl(220,10%,60%)] text-sm">No rides booked yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-[hsl(220,15%,20%)]">
              {recentRides.map((ride) => (
                <div key={ride.request_id} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[hsl(220,15%,20%)] flex items-center justify-center text-base flex-shrink-0">
                      🚖
                    </div>
                    <div className="min-w-0">
                      <div className="text-white font-medium text-sm truncate">
                        {ride.pickup_location} → {ride.destination}
                      </div>
                      <div className="text-xs text-[hsl(220,10%,50%)] mt-0.5 flex items-center gap-2">
                        <Clock size={11} />
                        <span>{ride.requested_at || 'Recent'}</span>
                        <span>•</span>
                        <span className="uppercase">{ride.vehicle_type || 'Sedan'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="text-white font-bold text-sm">
                      ₹{ride.estimated_fare || '—'}
                    </div>
                    <span
                      className={`inline-block mt-0.5 text-[11px] px-2 py-0.5 rounded-full font-semibold uppercase ${
                        ride.status === 'completed'
                          ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30'
                          : ride.status === 'cancelled'
                          ? 'bg-red-950/40 text-red-400 border border-red-500/30'
                          : 'bg-amber-950/40 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {ride.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
