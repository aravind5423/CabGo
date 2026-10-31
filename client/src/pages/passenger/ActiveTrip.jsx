import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, streamUrl, errorMessage } from '../../services/api';
import { useTripStore } from '../../store/tripStore';
import { socket } from '../../services/socket';
import LeafletMap from '../../components/map/LeafletMap';
import AppShell from '../../components/ui/AppShell';
import { StatusBadge, EmptyState, Spinner, Alert, IconChip } from '../../components/ui/UIKit';
import { Navigation, XCircle, MapPin, Car, Star, CheckCircle2, Phone, Clock, Gauge } from 'lucide-react';
import { formatCurrency, formatDistance, capitalize, initials } from '../../utils/format';
import clsx from 'clsx';

const STEPS = [
  { key: 'pending',     label: 'Finding driver' },
  { key: 'accepted',    label: 'Driver on the way' },
  { key: 'in_progress', label: 'Trip in progress' },
  { key: 'completed',   label: 'Arrived' },
];
const STEP_INDEX = { pending: 0, accepted: 1, in_progress: 2, completed: 3 };

const HEADLINES = {
  pending:     'Looking for a nearby driver…',
  accepted:    'Your driver is on the way to the pickup point',
  in_progress: 'Trip in progress — heading to your destination',
  completed:   'You have arrived. Thanks for riding with Rydio.',
  cancelled:   'This ride was cancelled.',
};

export default function ActiveTrip() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeTrip: storedTrip, setActiveTrip, clearActiveTrip } = useTripStore();

  const [telemetry, setTelemetry] = useState(null);
  const [streamState, setStreamState] = useState('idle'); // idle | live | reconnecting
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [ratingError, setRatingError] = useState('');

  const { data: dashboardData } = useQuery({
    queryKey: ['passengerDashboard'],
    queryFn: () => api.get('/passenger/dashboard').then((r) => r.data),
    refetchInterval: 4000,
  });

  const activeRide = dashboardData?.activeRide || null;
  const requestId  = activeRide?.request_id || storedTrip?.request_id || null;

  // Remember the current ride so a reload still shows this page (incl. the rating prompt).
  useEffect(() => {
    if (activeRide && activeRide.request_id !== storedTrip?.request_id) setActiveTrip(activeRide);
  }, [activeRide, storedTrip?.request_id, setActiveTrip]);

  const { data: statusData, error: statusError } = useQuery({
    queryKey: ['rideStatus', requestId],
    queryFn: () => api.get(`/rides/status/${requestId}`).then((r) => r.data),
    enabled: !!requestId,
    refetchInterval: (q) => (['completed', 'cancelled'].includes(q.state.data?.status) ? false : 3000),
    retry: false,
  });

  useEffect(() => {
    if (statusError?.response?.status === 404) clearActiveTrip();
  }, [statusError, clearActiveTrip]);

  const ride   = statusData?.ride || activeRide || storedTrip || null;
  const trip   = statusData?.trip || null;
  const tripId = trip?.trip_id || activeRide?.trip_id || null;
  const status = trip?.trip_status || ride?.status || 'pending';

  // Has this trip been rated already?
  const { data: ratingData } = useQuery({
    queryKey: ['tripRating', tripId],
    queryFn: () => api.get(`/ratings/trip/${tripId}`).then((r) => r.data),
    enabled: !!tripId && status === 'completed',
  });
  const alreadyRated = ratingData?.rated === true;

  // Live telemetry: SSE from the server simulation + Socket.IO room updates.
  useEffect(() => {
    if (!tripId || ['completed', 'cancelled'].includes(status)) { setStreamState('idle'); return undefined; }

    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ['rideStatus', requestId] });
      queryClient.invalidateQueries({ queryKey: ['passengerDashboard'] });
    };

    const es = new EventSource(streamUrl(`/stream/trip/${tripId}`));
    es.onopen  = () => setStreamState('live');
    es.onerror = () => setStreamState('reconnecting');
    es.addEventListener('telemetry', (e) => {
      try { setTelemetry(JSON.parse(e.data)); } catch { /* ignore malformed frame */ }
    });
    ['trip_started', 'trip_completed', 'ride_cancelled', 'trip_arrived', 'trip_status'].forEach((evt) => es.addEventListener(evt, refresh));

    socket.connect();
    socket.emit('join:trip', tripId);
    const onTick = (data) => {
      if (data && Number(data.tripId) === Number(tripId) && data.lat && data.lng) {
        setTelemetry((t) => ({ ...(t || {}), lat: data.lat, lng: data.lng, bearing: data.bearing ?? t?.bearing }));
      }
    };
    socket.on('driver:location_tick', onTick);

    return () => {
      es.close();
      socket.off('driver:location_tick', onTick);
      socket.disconnect();
    };
  }, [tripId, status, requestId, queryClient]);

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/rides/cancel/${requestId}`),
    onSuccess: () => {
      clearActiveTrip();
      queryClient.invalidateQueries({ queryKey: ['passengerDashboard'] });
      navigate('/passenger/dashboard');
    },
  });

  const ratingMutation = useMutation({
    mutationFn: () => api.post('/ratings', { trip_id: tripId, rating: Number(rating), comment: comment.trim() || undefined }),
    onSuccess: () => {
      clearActiveTrip();
      queryClient.invalidateQueries({ queryKey: ['rideHistory'] });
      navigate('/passenger/history');
    },
    onError: (err) => setRatingError(errorMessage(err, 'Could not submit rating.')),
  });

  if (!ride || status === 'cancelled') {
    return (
      <AppShell title="Active trip" subtitle="No ride in progress">
        <div className="max-w-md mx-auto mt-10 card">
          <EmptyState
            icon={Car}
            title={status === 'cancelled' ? 'Ride cancelled' : 'No active ride'}
            description="You don't have a pending or ongoing ride right now."
            action={
              <div className="flex gap-2">
                <Link to="/passenger/book-ride" className="btn-primary btn-sm">Book a ride</Link>
                {status === 'cancelled' && <button onClick={clearActiveTrip} className="btn-secondary btn-sm">Dismiss</button>}
              </div>
            }
          />
        </div>
      </AppShell>
    );
  }

  const stepIdx = STEP_INDEX[status] ?? 0;
  const vehiclePos = telemetry?.lat && telemetry?.lng ? [telemetry.lat, telemetry.lng] : null;
  const fare = trip?.fare ?? ride?.estimated_fare;

  return (
    <AppShell title={`Trip #${ride.request_id}`} subtitle={HEADLINES[status]}>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Progress */}
        <div className="card p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              {status !== 'completed' && <span className="live-dot" />}
              <div className="text-[15px] font-semibold text-slate-900">{HEADLINES[status]}</div>
            </div>
            <div className="flex items-center gap-2">
              {tripId && status !== 'completed' && (
                <span className={clsx('badge', streamState === 'live' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'badge-neutral')}>
                  {streamState === 'live' ? 'Live' : streamState === 'reconnecting' ? 'Reconnecting…' : 'Polling'}
                </span>
              )}
              <StatusBadge status={status} />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-5">
            {STEPS.map((s, i) => (
              <div key={s.key}>
                <div className={clsx('h-1.5 rounded-full transition-colors', i <= stepIdx ? 'bg-emerald-500' : 'bg-slate-200')} />
                <div className={clsx('text-[11px] font-medium mt-1.5', i <= stepIdx ? 'text-slate-900' : 'text-slate-400')}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Map */}
          <div className="lg:col-span-3 card overflow-hidden">
            <div className="card-header">
              <div className="card-title flex items-center gap-2"><Navigation size={14} className="text-emerald-600" /> Live map</div>
              {telemetry && status === 'in_progress' && (
                <div className="flex items-center gap-4 text-xs text-slate-600">
                  <span className="flex items-center gap-1"><Gauge size={13} /> {telemetry.speed_kmh ?? 0} km/h</span>
                  <span className="flex items-center gap-1"><Clock size={13} /> ETA {telemetry.eta_minutes ?? '—'} min</span>
                  <span>{telemetry.progress_percent ?? 0}%</span>
                </div>
              )}
            </div>
            <div className="h-80 sm:h-[400px]">
              <LeafletMap pickupCoords={ride.pickup_location} dropCoords={ride.destination} driverCoords={vehiclePos} bearing={telemetry?.bearing || 0} />
            </div>
          </div>

          {/* Details */}
          <div className="lg:col-span-2 space-y-4">
            <div className="card p-5 space-y-4">
              <div className="flex items-start gap-3">
                <IconChip icon={MapPin} tone="brand" size="sm" />
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase">Pickup</div>
                  <div className="text-sm font-medium text-slate-900">{ride.pickup_location}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <IconChip icon={Navigation} tone="rose" size="sm" />
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase">Destination</div>
                  <div className="text-sm font-medium text-slate-900">{ride.destination}</div>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 uppercase">{status === 'completed' ? 'Final fare' : 'Estimated fare'}</div>
                  <div className="text-2xl font-semibold text-slate-900">{formatCurrency(fare)}</div>
                  {trip?.distance_km && <div className="text-xs text-slate-500">{formatDistance(trip.distance_km)}</div>}
                </div>
                <span className="badge badge-neutral">{capitalize(ride.vehicle_type)}</span>
              </div>
            </div>

            {trip?.driver_name ? (
              <div className="card p-5">
                <div className="text-[11px] font-semibold text-slate-400 uppercase mb-3">Your driver</div>
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-slate-900 text-white font-semibold text-lg flex items-center justify-center flex-shrink-0">
                    {initials(trip.driver_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{trip.driver_name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{trip.vehicle_model} · <span className="font-mono">{trip.vehicle_number}</span></div>
                    <div className="flex items-center gap-1 text-xs text-amber-600 font-semibold mt-1">
                      <Star size={12} className="fill-amber-400 text-amber-400" /> {Number(trip.driver_rating || 0).toFixed(1)}
                    </div>
                  </div>
                  {trip.driver_mobile && (
                    <a href={`tel:${trip.driver_mobile}`} className="btn-secondary btn-sm" aria-label="Call driver"><Phone size={14} /></a>
                  )}
                </div>
              </div>
            ) : status === 'pending' ? (
              <div className="card p-5 border-dashed text-center">
                <Spinner size={22} className="text-emerald-600 mx-auto" />
                <div className="text-sm font-semibold text-slate-900 mt-2">Matching you with a driver</div>
                <p className="text-xs text-slate-500 mt-1">Nearby drivers with a matching vehicle have been notified.</p>
              </div>
            ) : null}

            {['pending', 'accepted'].includes(status) && (
              <button type="button"
                onClick={() => window.confirm('Cancel this ride?') && cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                className="btn-danger-soft w-full">
                {cancelMutation.isPending ? <Spinner size={15} /> : <XCircle size={15} />} Cancel ride
              </button>
            )}
          </div>
        </div>

        {status === 'completed' && (
          <div className="card p-6 sm:p-8 animate-slide-in">
            {alreadyRated ? (
              <div className="flex flex-col items-center text-center gap-3">
                <IconChip icon={CheckCircle2} tone="brand" size="lg" />
                <div className="text-base font-semibold text-slate-900">Thanks, your rating was recorded.</div>
                <div className="flex gap-2">
                  <Link to="/passenger/history" className="btn-secondary btn-sm">View trip history</Link>
                  <button onClick={() => { clearActiveTrip(); navigate('/passenger/book-ride'); }} className="btn-primary btn-sm">Book another ride</button>
                </div>
              </div>
            ) : (
              <div className="max-w-md mx-auto space-y-5">
                <div className="text-center">
                  <h3 className="text-base font-semibold text-slate-900">How was your trip?</h3>
                  <p className="text-xs text-slate-500 mt-1">Rate {trip?.driver_name || 'your driver'} to help keep the community safe.</p>
                </div>
                {ratingError && <Alert type="error">{ratingError}</Alert>}
                <div className="flex items-center justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} type="button" onClick={() => setRating(star)} aria-label={`${star} star${star > 1 ? 's' : ''}`}
                      className="p-1 transition-transform hover:scale-110">
                      <Star size={30} className={clsx('transition-colors', star <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300')} />
                    </button>
                  ))}
                </div>
                <input type="text" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000}
                  placeholder="Add a comment (optional)" className="input-field" />
                <div className="flex gap-2">
                  <button type="button" onClick={() => { clearActiveTrip(); navigate('/passenger/dashboard'); }} className="btn-secondary flex-1">Skip</button>
                  <button type="button" onClick={() => ratingMutation.mutate()} disabled={ratingMutation.isPending || !tripId} className="btn-primary flex-1">
                    {ratingMutation.isPending ? <Spinner size={15} /> : <Star size={15} />} Submit rating
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
