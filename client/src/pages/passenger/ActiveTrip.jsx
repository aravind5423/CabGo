import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useTripStore } from '../../store/tripStore';
import { socket } from '../../services/socket';
import LeafletMap from '../../components/map/LeafletMap';
import {
  ArrowLeft, Navigation, Clock, Zap, XCircle, Loader2, MapPin, Car, Phone, Star, CheckCircle, Award
} from 'lucide-react';

export default function ActiveTrip() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeTrip: storeActiveTrip, driverLocation, setDriverLocation, clearActiveTrip } = useTripStore();
  const [sseStatus, setSseStatus] = useState('connecting');
  const [telemetry, setTelemetry] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const eventSourceRef = useRef(null);

  // 1. Fetch passenger dashboard to always get live activeRide even on refresh
  const { data: dashboardData } = useQuery({
    queryKey: ['passengerDashboard'],
    queryFn: () => api.get('/passenger/dashboard').then((r) => r.data),
    refetchInterval: 3000,
  });

  const activeRide = dashboardData?.activeRide || storeActiveTrip;
  const requestId = activeRide?.request_id;

  // 2. Poll for detailed status if request_id is known
  const { data: statusData } = useQuery({
    queryKey: ['rideStatus', requestId],
    queryFn: () => api.get(`/rides/status/${requestId}`).then((r) => r.data),
    enabled: !!requestId,
    refetchInterval: 3000,
  });

  const currentRide = statusData?.ride || statusData?.request || activeRide;
  const trip = statusData?.trip || currentRide?.trip || null;
  const tripId = trip?.trip_id || currentRide?.trip_id;
  const status = trip?.trip_status || currentRide?.status || 'pending';

  // 3. SSE Stream for real-time driver movement
  useEffect(() => {
    if (!requestId) return;
    const token = localStorage.getItem('cab_token');
    const targetId = tripId || requestId;
    const url = `http://localhost:5000/api/stream/trip/${targetId}?token=${token}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => setSseStatus('live');
    es.onerror = () => setSseStatus('polling');

    es.addEventListener('location', (e) => {
      try {
        const data = JSON.parse(e.data);
        setDriverLocation([data.lat, data.lng]);
        setTelemetry(data);
      } catch (_) {}
    });

    es.addEventListener('status', (e) => {
      try {
        queryClient.invalidateQueries({ queryKey: ['passengerDashboard'] });
        queryClient.invalidateQueries({ queryKey: ['rideStatus', requestId] });
      } catch (_) {}
    });

    // Socket.IO
    socket.connect();
    socket.emit('trip:join', targetId);

    socket.on('driver:location_tick', (data) => {
      if (data.lat && data.lng) {
        setDriverLocation([data.lat, data.lng]);
      }
    });

    return () => {
      es.close();
      socket.off('driver:location_tick');
      socket.disconnect();
    };
  }, [requestId, tripId]);

  // 4. Cancel ride mutation
  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/rides/cancel/${requestId}`),
    onSuccess: () => {
      clearActiveTrip();
      queryClient.invalidateQueries({ queryKey: ['passengerDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['passengerTrips'] });
      navigate('/passenger/dashboard');
    },
  });

  // 5. Submit rating mutation
  const ratingMutation = useMutation({
    mutationFn: () =>
      api.post('/ratings', {
        trip_id: tripId,
        rating: Number(rating),
        comment: comment.trim() || 'Great ride!',
      }),
    onSuccess: () => {
      setRatingSubmitted(true);
      clearActiveTrip();
      queryClient.invalidateQueries({ queryKey: ['passengerDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['passengerTrips'] });
      setTimeout(() => navigate('/passenger/dashboard'), 2000);
    },
  });

  if (!currentRide) {
    return (
      <div className="min-h-screen bg-[hsl(220,15%,10%)] flex items-center justify-center px-4">
        <div className="text-center max-w-sm p-8 rounded-2xl bg-[hsl(220,15%,14%)] border border-[hsl(220,15%,22%)]">
          <div className="text-5xl mb-4">🚖</div>
          <h2 className="text-xl font-bold text-white mb-2 font-['Outfit']">No Active Trip Found</h2>
          <p className="text-[hsl(220,10%,60%)] text-sm mb-6">
            You don't have any ongoing or pending cab bookings right now.
          </p>
          <Link
            to="/passenger/book-ride"
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold transition shadow cursor-pointer"
          >
            Book a Ride Now
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(220,15%,10%)] pb-12">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 border-b border-[hsl(220,15%,24%)] bg-[hsl(220,15%,10%)]/95 backdrop-blur">
        <Link
          to="/passenger/dashboard"
          className="flex items-center gap-2 text-[hsl(220,10%,60%)] hover:text-white transition font-medium"
        >
          <ArrowLeft size={18} />
          <span>Dashboard</span>
        </Link>
        <span className="text-white font-bold font-['Outfit']">Active Ride HUD</span>
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${sseStatus === 'live' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <span className="text-xs text-[hsl(220,10%,60%)] font-semibold">{sseStatus === 'live' ? 'Live Telemetry' : 'Polling'}</span>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Status Header Banner */}
        <div
          className={`p-5 rounded-2xl text-center border font-bold shadow-lg transition ${
            status === 'pending'
              ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
              : status === 'accepted'
              ? 'bg-blue-900/30 border-blue-500/40 text-blue-300'
              : status === 'in_progress'
              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
              : status === 'completed'
              ? 'bg-green-950/40 border-green-500/50 text-green-300'
              : 'bg-red-950/30 border-red-500/40 text-red-300'
          }`}
        >
          <div className="text-lg">
            {status === 'pending' && '⏳ Dispatching... Searching for nearby driver'}
            {status === 'accepted' && '🚖 Driver Assigned! Heading to your pickup location'}
            {status === 'in_progress' && '🏎️ Trip in Progress! Enjoy your ride'}
            {status === 'completed' && '🎉 Trip Completed! You have arrived'}
            {status === 'cancelled' && '❌ Trip Cancelled'}
          </div>
          <div className="text-xs text-[hsl(220,10%,60%)] mt-1 font-normal">
            Request #{currentRide.request_id} • {currentRide.vehicle_type?.toUpperCase()}
          </div>
        </div>

        {/* Assigned Driver & Vehicle Card (when driver accepted) */}
        {(currentRide.driver_name || trip?.driver_name) && (
          <div className="p-5 rounded-2xl bg-[hsl(220,15%,14%)] border border-[hsl(220,15%,22%)] shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-xl font-bold">
                  🚖
                </div>
                <div>
                  <div className="text-white font-bold text-base">
                    {currentRide.driver_name || trip?.driver_name}
                  </div>
                  <div className="text-xs text-[hsl(220,10%,60%)] flex items-center gap-1.5 mt-0.5">
                    <span>⭐ {currentRide.driver_rating || trip?.driver_rating || '4.9'} rating</span>
                    <span>•</span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <Phone size={11} /> {currentRide.driver_mobile || trip?.driver_mobile || '9876543210'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-white uppercase tracking-wider">
                  {currentRide.vehicle_number || trip?.vehicle_number || 'TN-09-AB-1234'}
                </div>
                <div className="text-xs text-[hsl(220,10%,60%)]">
                  {currentRide.vehicle_model || trip?.vehicle_model || 'Honda City'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Telemetry HUD (Speed / ETA / Progress) */}
        {telemetry && (
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-[hsl(220,15%,14%)] border border-[hsl(220,15%,22%)] text-center">
              <Zap size={16} className="mx-auto text-amber-400 mb-1" />
              <div className="text-lg font-bold text-white">{telemetry.speed_kmh ?? 38}</div>
              <div className="text-[11px] text-[hsl(220,10%,60%)]">km/h Speed</div>
            </div>
            <div className="p-3.5 rounded-xl bg-[hsl(220,15%,14%)] border border-[hsl(220,15%,22%)] text-center">
              <Clock size={16} className="mx-auto text-blue-400 mb-1" />
              <div className="text-lg font-bold text-white">{telemetry.eta_minutes ?? 12}</div>
              <div className="text-[11px] text-[hsl(220,10%,60%)]">min ETA</div>
            </div>
            <div className="p-3.5 rounded-xl bg-[hsl(220,15%,14%)] border border-[hsl(220,15%,22%)] text-center">
              <Navigation size={16} className="mx-auto text-emerald-400 mb-1" />
              <div className="text-lg font-bold text-white">{telemetry.progress_percent ?? 45}%</div>
              <div className="text-[11px] text-[hsl(220,10%,60%)]">Progress</div>
            </div>
          </div>
        )}

        {/* Live Interactive Leaflet Map */}
        <div className="rounded-2xl overflow-hidden border border-[hsl(220,15%,24%)] bg-[hsl(220,15%,14%)]">
          <div className="h-80">
            <LeafletMap
              pickupCoords={currentRide.pickup_location}
              dropCoords={currentRide.destination}
              driverCoords={driverLocation || (telemetry ? [telemetry.lat, telemetry.lng] : null)}
              bearing={telemetry?.bearing || 0}
            />
          </div>
        </div>

        {/* Route Details Card */}
        <div className="p-5 rounded-2xl bg-[hsl(220,15%,14%)] border border-[hsl(220,15%,22%)] space-y-3">
          <div className="text-xs font-bold text-[hsl(220,10%,60%)] uppercase tracking-wider">
            Ride Details
          </div>
          <div className="space-y-2.5 text-sm">
            <div className="flex items-start gap-2.5">
              <MapPin size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-xs text-gray-500 block">Pickup</span>
                <span className="text-white font-medium">{currentRide.pickup_location}</span>
              </div>
            </div>
            <div className="flex items-start gap-2.5 pt-2 border-t border-[hsl(220,15%,20%)]">
              <Navigation size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-xs text-gray-500 block">Destination</span>
                <span className="text-white font-medium">{currentRide.destination}</span>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-[hsl(220,15%,20%)]">
              <span className="text-xs text-gray-500">Estimated Fare</span>
              <span className="text-lg font-extrabold text-amber-400">
                ₹{currentRide.estimated_fare || trip?.fare || 250}
              </span>
            </div>
          </div>
        </div>

        {/* Cancel Button (Available while pending or accepted) */}
        {(status === 'pending' || status === 'accepted') && (
          <button
            type="button"
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending}
            className="w-full py-3 px-4 rounded-xl border border-red-500/40 text-red-400 hover:bg-red-950/30 font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {cancelMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <XCircle size={18} />}
            Cancel Ride Request
          </button>
        )}

        {/* Rating Submission Card (Shown when completed) */}
        {status === 'completed' && (
          <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/40 space-y-4">
            <div className="text-center">
              <Award size={32} className="mx-auto text-amber-400 mb-2" />
              <h3 className="text-lg font-bold text-white">How was your trip?</h3>
              <p className="text-xs text-[hsl(220,10%,60%)] mt-0.5">Rate your driver partner</p>
            </div>

            {ratingSubmitted ? (
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-center text-sm font-semibold flex items-center justify-center gap-2">
                <CheckCircle size={18} />
                <span>Thank you! Your rating has been recorded. Redirecting...</span>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="p-1 cursor-pointer transition transform hover:scale-125"
                    >
                      <Star
                        size={28}
                        className={star <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-600'}
                      />
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Optional review comment (e.g. Clean car, on-time)"
                  className="w-full px-4 py-2.5 rounded-xl bg-[hsl(220,15%,12%)] border border-[hsl(220,15%,24%)] text-white placeholder-gray-500 text-sm focus:outline-none focus:border-amber-400"
                />

                <button
                  type="button"
                  onClick={() => ratingMutation.mutate()}
                  disabled={ratingMutation.isPending}
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shadow"
                >
                  {ratingMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Star size={18} />}
                  Submit Rating ({rating} Stars)
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
