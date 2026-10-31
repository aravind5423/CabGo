import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useTripStore } from '../../store/tripStore';
import { socket } from '../../services/socket';
import LeafletMap from '../../components/map/LeafletMap';
import AppShell from '../../components/ui/AppShell';
import { StatusBadge, EmptyState, Spinner } from '../../components/ui/UIKit';
import {
  Navigation, Clock, XCircle, Loader2, MapPin, Car, Star, CheckCircle2, Award,
  Phone, Zap, ShieldCheck, Radio
} from 'lucide-react';
import clsx from 'clsx';

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

  const { data: dashboardData } = useQuery({
    queryKey: ['passengerDashboard'],
    queryFn: () => api.get('/passenger/dashboard').then((r) => r.data),
    refetchInterval: 3000,
  });

  const activeRide = dashboardData?.activeRide || storeActiveTrip;
  const requestId = activeRide?.request_id;

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

  // Real-time SSE and Socket.IO bindings
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
    es.addEventListener('status', () => {
      queryClient.invalidateQueries({ queryKey: ['passengerDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['rideStatus', requestId] });
    });

    socket.connect();
    socket.emit('trip:join', targetId);
    socket.on('driver:location_tick', (data) => {
      if (data.lat && data.lng) setDriverLocation([data.lat, data.lng]);
    });

    return () => {
      es.close();
      socket.off('driver:location_tick');
      socket.disconnect();
    };
  }, [requestId, tripId, queryClient, setDriverLocation]);

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/rides/cancel/${requestId}`),
    onSuccess: () => {
      clearActiveTrip();
      queryClient.invalidateQueries({ queryKey: ['passengerDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['passengerTrips'] });
      navigate('/passenger/dashboard');
    },
  });

  const ratingMutation = useMutation({
    mutationFn: () =>
      api.post('/ratings', {
        trip_id: tripId,
        rating: Number(rating),
        comment: comment.trim() || 'Superb ride service!',
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
      <AppShell title="Live Ride Radar" subtitle="No active trip in session">
        <div className="max-w-md mx-auto mt-12 card p-8">
          <EmptyState
            icon={Car}
            title="No Ongoing Journeys"
            description="You don't have any pending or active rides at the moment. Request a ride now to start tracking."
            action={
              <Link to="/passenger/book-ride" className="btn-primary text-sm shadow-md">
                Book a Cab
              </Link>
            }
          />
        </div>
      </AppShell>
    );
  }

  const STEPS = [
    { key: 'pending',     label: 'Driver Matching', done: true },
    { key: 'accepted',    label: 'Driver En Route', done: ['accepted', 'in_progress', 'completed'].includes(status) },
    { key: 'in_progress', label: 'Trip In Progress', done: ['in_progress', 'completed'].includes(status) },
    { key: 'completed',   label: 'Arrived at Destination', done: status === 'completed' },
  ];

  return (
    <AppShell title={`Live Trip #${currentRide.request_id}`} subtitle="Real-time vehicle telemetry stream">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Live Radar Header HUD */}
        <div className="card p-5 bg-slate-900 text-white border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                <Radio size={22} className="animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    {status === 'completed' ? 'Journey Completed' : 'Live GPS Radar Active'}
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                </div>
                <div className="text-xl font-black mt-0.5 tracking-tight">
                  {status === 'pending' && 'Searching for Nearest Available Driver...'}
                  {status === 'accepted' && 'Driver Assigned — En Route to Pickup'}
                  {status === 'in_progress' && 'Trip In Progress — Heading to Destination'}
                  {status === 'completed' && 'You have arrived safely at your destination'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl font-mono">
                SSE: {sseStatus}
              </span>
              <StatusBadge status={status} />
            </div>
          </div>

          {/* Stepper Progress Bar */}
          <div className="mt-6 pt-5 border-t border-slate-800/80">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {STEPS.map((step, idx) => (
                <div key={step.key} className="flex flex-col gap-1.5">
                  <div
                    className={clsx(
                      'h-1.5 rounded-full transition-all duration-500',
                      step.done ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-slate-800'
                    )}
                  />
                  <div className="flex items-center gap-1.5 text-[11px] font-bold">
                    <span className={clsx(step.done ? 'text-emerald-400' : 'text-slate-500')}>
                      {idx + 1}. {step.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Interactive Radar Leaflet Map */}
        <div className="card overflow-hidden shadow-xl border-slate-200">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
            <span className="flex items-center gap-2">
              <Navigation size={14} className="text-emerald-600" /> Live Vehicle Position
            </span>
            <span className="text-[11px] text-slate-500">Live coordinates auto-refresh</span>
          </div>
          <div className="h-80 sm:h-96 w-full">
            <LeafletMap
              pickupCoords={currentRide.pickup_location}
              dropCoords={currentRide.destination}
              driverCoords={driverLocation || telemetry}
              theme="voyager"
              height="100%"
            />
          </div>
        </div>

        {/* Trip Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Route Specification */}
          <div className="card p-6 space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Journey Specifications</h3>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MapPin size={16} />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase">Pickup Location</div>
                  <div className="text-sm font-bold text-slate-900">{currentRide.pickup_location}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Navigation size={16} />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase">Destination Drop-off</div>
                  <div className="text-sm font-bold text-slate-900">{currentRide.destination}</div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase">Estimated Fare</div>
                <div className="text-2xl font-black text-slate-900">₹{currentRide.estimated_fare || trip?.fare || 250}</div>
              </div>
              <span className="badge bg-slate-100 text-slate-700 capitalize font-bold">
                {currentRide.vehicle_type || 'Sedan'}
              </span>
            </div>
          </div>

          {/* Driver Partner / Actions */}
          <div className="space-y-4">
            {trip?.driver_name ? (
              <div className="card p-6 bg-gradient-to-br from-white to-slate-50">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white font-black text-xl flex items-center justify-center shadow-lg shadow-emerald-500/25 flex-shrink-0">
                    {trip.driver_name[0]?.toUpperCase() || 'D'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-slate-900 truncate">{trip.driver_name}</span>
                      <ShieldCheck size={16} className="text-emerald-600" />
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {trip.vehicle_type?.toUpperCase() || 'SEDAN'} • {trip.vehicle_number || 'TN-09-DR-404'}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-amber-500 font-bold mt-1">
                      <Star size={13} className="fill-amber-400 text-amber-400" />
                      <span>4.9 Star Rating</span>
                    </div>
                  </div>
                  {trip.driver_phone && (
                    <a
                      href={`tel:${trip.driver_phone}`}
                      className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center hover:bg-emerald-100 transition shadow-sm"
                    >
                      <Phone size={18} />
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="card p-6 border-dashed border-slate-300 text-center space-y-2">
                <Spinner size={24} className="text-emerald-600 mx-auto" />
                <div className="text-xs font-bold text-slate-800">Assigning Closest Driver Partner</div>
                <p className="text-[11px] text-slate-500">Drivers in your area have received this trip notification.</p>
              </div>
            )}

            {/* Cancel Button */}
            {(status === 'pending' || status === 'accepted') && (
              <button
                type="button"
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                className="btn-danger w-full py-3 text-xs font-bold shadow-md shadow-rose-500/20"
              >
                {cancelMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                Cancel This Ride Request
              </button>
            )}
          </div>
        </div>

        {/* Rating Submission Card */}
        {status === 'completed' && (
          <div className="card p-6 sm:p-8 space-y-5 animate-card-in border-emerald-500/30 bg-gradient-to-br from-white to-emerald-50/30 shadow-xl">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3 shadow-inner">
                <Award size={28} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">How was your journey?</h3>
              <p className="text-xs text-slate-500 mt-1">Rate your driver partner to keep our community safe and high-quality.</p>
            </div>

            {ratingSubmitted ? (
              <div className="p-4 rounded-2xl bg-emerald-100 border border-emerald-200 text-emerald-800 text-sm font-bold text-center flex items-center justify-center gap-2">
                <CheckCircle2 size={18} /> Thank you! Your rating has been submitted successfully.
              </div>
            ) : (
              <div className="max-w-md mx-auto space-y-4">
                <div className="flex items-center justify-center gap-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="p-1.5 transition-all duration-200 hover:scale-120 cursor-pointer"
                    >
                      <Star
                        size={32}
                        className={clsx(
                          'transition-colors',
                          star <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'
                        )}
                      />
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Optional review note (e.g. Smooth driving, very polite)"
                  className="input-field text-center"
                />

                <button
                  type="button"
                  onClick={() => ratingMutation.mutate()}
                  disabled={ratingMutation.isPending}
                  className="btn-primary w-full py-3 font-bold shadow-lg shadow-emerald-500/25"
                >
                  {ratingMutation.isPending ? <Spinner size={16} className="text-white" /> : <Star size={16} />}
                  Submit Rating ({rating} Stars)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
