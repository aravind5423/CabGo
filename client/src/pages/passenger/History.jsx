import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import {
  MapPin, Clock, LogOut, ArrowLeft, DollarSign, Car, Calendar, CheckCircle, XCircle
} from 'lucide-react';

const STATUS_COLORS = {
  completed:   'bg-emerald-900/40 text-emerald-400 border border-emerald-500/30',
  cancelled:   'bg-red-900/40 text-red-400 border border-red-500/30',
  pending:     'bg-amber-900/40 text-amber-400 border border-amber-500/30',
  accepted:    'bg-blue-900/40 text-blue-400 border border-blue-500/30',
  in_progress: 'bg-purple-900/40 text-purple-400 border border-purple-500/30',
};

export default function PassengerHistory() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['passengerTrips'],
    queryFn: () => api.get('/passenger/trips').then((r) => r.data),
  });

  const trips = data?.trips || data?.data || [];

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch (_) {}
    logout();
    navigate('/login');
  };

  const totalSpent = trips.reduce(
    (acc, t) => acc + (t.status === 'completed' || t.trip_status === 'completed' ? Number(t.fare || t.estimated_fare || 0) : 0),
    0
  );

  return (
    <div className="min-h-screen bg-[hsl(220,15%,10%)] pb-12">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 border-b border-[hsl(220,15%,24%)] bg-[hsl(220,15%,10%)]/95 backdrop-blur">
        <div className="flex items-center gap-4">
          <Link
            to="/passenger/dashboard"
            className="flex items-center gap-2 text-[hsl(220,10%,60%)] hover:text-white transition"
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-semibold">Dashboard</span>
          </Link>
          <span className="text-gray-600">|</span>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🚖</span>
            <span className="font-bold text-white text-xl font-['Outfit']">CabGo</span>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-cyan-900/40 text-cyan-400 border border-cyan-500/30">
              Trip History
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link
            to="/passenger/book-ride"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500 text-black hover:bg-amber-400 transition"
          >
            + Book Ride
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm text-[hsl(220,10%,60%)] hover:text-white hover:bg-[hsl(220,15%,16%)] transition cursor-pointer"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header & KPI Summary */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-white font-['Outfit']">My Ride History</h1>
            <p className="text-sm text-[hsl(220,10%,60%)] mt-1">Review all your completed, active, and cancelled journeys</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 rounded-xl bg-[hsl(220,15%,16%)] border border-[hsl(220,15%,24%)] text-right">
              <span className="text-[11px] text-[hsl(220,10%,50%)] block">Total Trips</span>
              <span className="text-base font-bold text-white">{trips.length}</span>
            </div>
            <div className="px-4 py-2 rounded-xl bg-[hsl(220,15%,16%)] border border-[hsl(220,15%,24%)] text-right">
              <span className="text-[11px] text-[hsl(220,10%,50%)] block">Total Spent</span>
              <span className="text-base font-bold text-amber-400">₹{totalSpent.toFixed(0)}</span>
            </div>
          </div>
        </div>

        {/* Trips List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-[hsl(220,15%,16%)] animate-pulse" />
            ))}
          </div>
        ) : trips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-[hsl(220,15%,24%)] rounded-2xl bg-[hsl(220,15%,12%)]">
            <Car size={40} className="text-[hsl(220,10%,40%)] mb-3" />
            <h3 className="text-base font-bold text-white">No Trips Recorded</h3>
            <p className="text-xs text-[hsl(220,10%,50%)] mt-1 max-w-sm">
              You haven't taken any trips yet. Book your first ride across Chennai!
            </p>
            <Link
              to="/passenger/book-ride"
              className="mt-4 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition"
            >
              Book a Ride Now
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {trips.map((trip) => {
              const status = trip.trip_status || trip.status || 'completed';
              return (
                <div
                  key={trip.trip_id || trip.request_id}
                  className="p-5 rounded-2xl border border-[hsl(220,15%,22%)] bg-[hsl(220,15%,14%)] hover:border-[hsl(220,15%,30%)] transition shadow-md"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 text-sm text-white font-medium">
                        <MapPin size={15} className="text-emerald-400 flex-shrink-0" />
                        <span className="truncate">From: {trip.pickup_location}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[hsl(220,10%,70%)] font-medium">
                        <MapPin size={15} className="text-red-400 flex-shrink-0" />
                        <span className="truncate">To: {trip.destination}</span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-[hsl(220,10%,50%)] pt-1">
                        <span className="flex items-center gap-1">
                          <Calendar size={13} />
                          {trip.start_time
                            ? new Date(trip.start_time).toLocaleDateString()
                            : new Date(trip.requested_at).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={13} />
                          {trip.start_time
                            ? new Date(trip.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : new Date(trip.requested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {trip.driver_name && (
                          <span className="text-gray-400">
                            Driver: <strong className="text-white">{trip.driver_name}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-[hsl(220,15%,20%)]">
                      <div className="text-xl font-extrabold text-amber-400">
                        ₹{trip.fare || trip.estimated_fare || '—'}
                      </div>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider mt-1 ${STATUS_COLORS[status] || STATUS_COLORS.completed}`}>
                        {status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
