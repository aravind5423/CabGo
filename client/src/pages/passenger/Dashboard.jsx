import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import { MapPin, Car, Clock, LogOut, Plus } from 'lucide-react';

export default function PassengerDashboard() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const { data: tripsData, isLoading } = useQuery({
    queryKey: ['passengerTrips'],
    queryFn: () => api.get('/passenger/trips').then((r) => r.data),
  });

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch (_) {}
    logout();
    navigate('/login');
  };

  const trips = tripsData?.trips || tripsData?.data || [];

  return (
    <div className="min-h-screen bg-[hsl(220,15%,10%)]">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 border-b border-[hsl(220,15%,24%)] bg-[hsl(220,15%,10%)]/90 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🚖</span>
          <span className="font-bold text-white text-xl font-['Outfit']">CabGo</span>
          <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-[hsl(38,95%,55%)]/20 text-[hsl(38,95%,55%)]">Passenger</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[hsl(220,10%,60%)] text-sm hidden sm:block">👋 {user?.name}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-[hsl(220,10%,60%)] hover:text-white hover:bg-[hsl(220,15%,16%)] transition"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-4 font-['Outfit']">Dashboard</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              to="/passenger/book-ride"
              className="flex items-center gap-4 p-5 rounded-2xl border border-[hsl(220,15%,24%)] bg-[hsl(38,95%,55%)] hover:brightness-110 transition group"
            >
              <div className="w-12 h-12 rounded-xl bg-black/20 flex items-center justify-center">
                <Plus size={24} className="text-white" />
              </div>
              <div>
                <div className="font-bold text-[hsl(220,15%,10%)] text-lg">Book a Ride</div>
                <div className="text-[hsl(220,15%,10%)]/70 text-sm">Find a cab now</div>
              </div>
            </Link>
            <Link
              to="/passenger/active-trip"
              className="flex items-center gap-4 p-5 rounded-2xl border border-[hsl(220,15%,24%)] bg-[hsl(220,15%,16%)] hover:bg-[hsl(220,15%,20%)] transition"
            >
              <div className="w-12 h-12 rounded-xl bg-[hsl(220,80%,55%)]/20 flex items-center justify-center">
                <MapPin size={24} className="text-[hsl(220,80%,55%)]" />
              </div>
              <div>
                <div className="font-bold text-white text-lg">Active Trip</div>
                <div className="text-[hsl(220,10%,60%)] text-sm">Track your ride</div>
              </div>
            </Link>
          </div>
        </div>

        {/* Trip History */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4 font-['Outfit']">Recent Trips</h3>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-2xl bg-[hsl(220,15%,16%)] animate-pulse" />
              ))}
            </div>
          ) : trips.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Car size={48} className="text-[hsl(220,10%,40%)] mb-4" />
              <p className="text-[hsl(220,10%,60%)]">No trips yet. Book your first ride!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {trips.map((trip) => (
                <div
                  key={trip.trip_id || trip.request_id}
                  className="flex items-center gap-4 p-4 rounded-2xl border border-[hsl(220,15%,24%)] bg-[hsl(220,15%,16%)]"
                >
                  <div className="w-10 h-10 rounded-xl bg-[hsl(220,15%,24%)] flex items-center justify-center text-lg flex-shrink-0">
                    🚖
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white truncate">
                      {trip.pickup_location || trip.from_location}
                      {' → '}
                      {trip.destination || trip.to_location}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[hsl(220,10%,60%)] text-xs flex items-center gap-1">
                        <Clock size={12} />
                        {trip.start_time
                          ? new Date(trip.start_time).toLocaleDateString()
                          : new Date(trip.requested_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-semibold">
                      ₹{trip.fare || trip.estimated_fare || '—'}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      (trip.trip_status || trip.status) === 'completed'
                        ? 'bg-green-900/30 text-green-400'
                        : (trip.trip_status || trip.status) === 'cancelled'
                        ? 'bg-red-900/30 text-red-400'
                        : 'bg-yellow-900/30 text-yellow-400'
                    }`}>
                      {trip.trip_status || trip.status}
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
