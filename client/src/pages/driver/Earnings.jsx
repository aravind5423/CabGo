import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import {
  DollarSign, TrendingUp, Clock, Star, ArrowLeft, Navigation, Award, Calendar, CheckCircle
} from 'lucide-react';

export default function DriverEarnings() {
  const navigate = useNavigate();

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
    <div className="min-h-screen bg-[hsl(220,15%,10%)] pb-12">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 border-b border-[hsl(220,15%,24%)] bg-[hsl(220,15%,10%)]/95 backdrop-blur">
        <div className="flex items-center gap-4">
          <Link
            to="/driver/dashboard"
            className="flex items-center gap-2 text-[hsl(220,10%,60%)] hover:text-white transition"
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-semibold">Console</span>
          </Link>
          <span className="text-gray-600">|</span>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🚖</span>
            <span className="font-bold text-white text-xl font-['Outfit']">CabGo</span>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-900/40 text-emerald-400 border border-emerald-500/30">
              Financial Earnings
            </span>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-white font-['Outfit']">Driver Earnings Breakdown</h1>
          <p className="text-sm text-[hsl(220,10%,60%)] mt-1">Direct payout analytics, trip fare disbursements, and ratings</p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-[hsl(220,15%,14%)] border border-amber-500/30 shadow-lg">
            <div className="flex items-center justify-between text-xs text-[hsl(220,10%,60%)] mb-2">
              <span className="font-bold uppercase tracking-wider text-amber-400">Total Net Payout</span>
              <DollarSign size={18} className="text-amber-400" />
            </div>
            <div className="text-3xl font-extrabold text-white">
              ₹{isLoading ? '…' : Number(totalEarnings).toFixed(2)}
            </div>
            <div className="text-xs text-emerald-400 mt-2 flex items-center gap-1 font-medium">
              <CheckCircle size={13} /> Direct 100% daily settlement
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[hsl(220,15%,14%)] border border-blue-500/30 shadow-lg">
            <div className="flex items-center justify-between text-xs text-[hsl(220,10%,60%)] mb-2">
              <span className="font-bold uppercase tracking-wider text-blue-400">Fulfilled Trips</span>
              <Navigation size={18} className="text-blue-400" />
            </div>
            <div className="text-3xl font-extrabold text-white">
              {isLoading ? '…' : tripCount}
            </div>
            <div className="text-xs text-[hsl(220,10%,50%)] mt-2">
              Zero trip cancellation deductions
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[hsl(220,15%,14%)] border border-yellow-500/30 shadow-lg">
            <div className="flex items-center justify-between text-xs text-[hsl(220,10%,60%)] mb-2">
              <span className="font-bold uppercase tracking-wider text-yellow-400">Service Rating</span>
              <Star size={18} className="text-yellow-400 fill-yellow-400" />
            </div>
            <div className="text-3xl font-extrabold text-white">
              {isLoading ? '…' : avgRating}
            </div>
            <div className="text-xs text-amber-300 mt-2 font-medium">
              Top 5% Partner in Chennai Metro
            </div>
          </div>
        </div>

        {/* Trips Statement */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white">Per-Trip Fare Receipts</h2>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-2xl bg-[hsl(220,15%,16%)] animate-pulse" />
              ))}
            </div>
          ) : trips.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-[hsl(220,15%,24%)] rounded-2xl bg-[hsl(220,15%,12%)]">
              <DollarSign size={40} className="text-[hsl(220,10%,40%)] mb-3" />
              <h3 className="text-base font-bold text-white">No Trips Settled Yet</h3>
              <p className="text-xs text-[hsl(220,10%,50%)] mt-1">
                Completed passenger rides will appear here with detailed fare accounting.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {trips.map((trip, idx) => (
                <div
                  key={trip.trip_id || idx}
                  className="p-4 sm:p-5 rounded-2xl border border-[hsl(220,15%,22%)] bg-[hsl(220,15%,14%)] flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="text-white text-sm font-semibold truncate">
                      {trip.pickup_location} → {trip.destination}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[hsl(220,10%,50%)] mt-1">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {trip.end_time ? new Date(trip.end_time).toLocaleString() : 'Settled'}
                      </span>
                      {trip.passenger_name && (
                        <span>Passenger: <strong className="text-gray-300">{trip.passenger_name}</strong></span>
                      )}
                      {trip.distance_km && <span>{trip.distance_km} km</span>}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-extrabold text-emerald-400">
                      +₹{trip.fare || '—'}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-500/30">
                      Paid
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
