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
  Navigation, Clock, XCircle, Loader2, MapPin, Car, Star, CheckCircle, Award,
  Phone, Zap
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

  // SSE Stream
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
  }, [requestId, tripId]);

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
      <AppShell title="Active Trip" subtitle="Track your live ride">
        <div className="max-w-md mx-auto mt-8">
          <div className="card p-10">
            <EmptyState
              icon={Car}
              title="No Active Trip Found"
              description="You don't have any ongoing or pending cab bookings right now."
              action={
                <Link to="/passenger/book-ride" className="btn-primary">
                  Book a Ride
                </Link>
              }
            />
          </div>
        </div>
      </AppShell>
    );
  }

  const STATUS_LABELS = {
    pending:     { text: 'Searching for driver…',  color: 'text-warning' },
    accepted:    { text: 'Driver is on the way',   color: 'text-info' },
    in_progress: { text: 'Ride in progress',       color: 'text-brand' },
    completed:   { text: 'Ride completed',         color: 'text-success' },
  };
  const statusInfo = STATUS_LABELS[status] || { text: status, color: 'text-ink-muted' };

  return (
    <AppShell
      title="Active Trip"
      subtitle={
        <span className={clsx('flex items-center gap-1.5 text-xs font-medium', statusInfo.color)}>
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          {statusInfo.text}
        </span>
      }
    >
      <div className="max-w-2xl mx-auto space-y-5 animate-fade-in">

        {/* Live Map */}
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-line flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Navigation size={15} className="text-brand" />
              Live Tracking
            </div>
            <div className="flex items-center gap-1.5">
              <span className={clsx(
                'w-2 h-2 rounded-full',
                sseStatus === 'live' ? 'bg-success animate-pulse' : 'bg-warning animate-pulse'
              )} />
              <span className="text-xs text-ink-muted capitalize">{sseStatus}</span>
            </div>
          </div>
          <div className="h-72">
            <LeafletMap
              pickupCoords={currentRide?.pickup_location}
              dropCoords={currentRide?.destination}
              driverCoords={driverLocation}
              bearing={telemetry?.bearing || 0}
              height="100%"
              theme="voyager"
            />
          </div>

          {/* Telemetry Strip */}
          {telemetry && (
            <div className="px-5 py-3 bg-canvas border-t border-line grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xs text-ink-muted">Speed</div>
                <div className="text-sm font-bold text-ink">{telemetry.speed?.toFixed(0) || 0} km/h</div>
              </div>
              <div>
                <div className="text-xs text-ink-muted">ETA</div>
                <div className="text-sm font-bold text-ink">{telemetry.eta || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-ink-muted">Distance</div>
                <div className="text-sm font-bold text-ink">{telemetry.distance_remaining || '—'}</div>
              </div>
            </div>
          )}
        </div>

        {/* Trip Info */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-ink">Ride Details</h2>
            <StatusBadge status={status} />
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-success-bg flex items-center justify-center flex-shrink-0">
                <MapPin size={14} className="text-success" />
              </div>
              <div>
                <div className="text-xs text-ink-muted">Pickup</div>
                <div className="text-sm font-medium text-ink">{currentRide.pickup_location}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-error-bg flex items-center justify-center flex-shrink-0">
                <Navigation size={14} className="text-error" />
              </div>
              <div>
                <div className="text-xs text-ink-muted">Destination</div>
                <div className="text-sm font-medium text-ink">{currentRide.destination}</div>
              </div>
            </div>
            <div className="pt-3 border-t border-line flex items-center justify-between">
              <span className="text-xs text-ink-muted">Estimated Fare</span>
              <span className="text-lg font-bold text-ink">₹{currentRide.estimated_fare || trip?.fare || 250}</span>
            </div>
          </div>
        </div>

        {/* Driver Info (if accepted) */}
        {trip?.driver_name && (
          <div className="card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-light flex items-center justify-center text-xl flex-shrink-0">
              🚖
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-ink">{trip.driver_name}</div>
              <div className="text-xs text-ink-muted mt-0.5 capitalize">{trip.vehicle_type || 'Sedan'} · {trip.vehicle_number || '—'}</div>
            </div>
            {trip.driver_phone && (
              <a href={`tel:${trip.driver_phone}`} className="btn-secondary p-2.5">
                <Phone size={16} />
              </a>
            )}
          </div>
        )}

        {/* Cancel Button */}
        {(status === 'pending' || status === 'accepted') && (
          <button
            type="button"
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending}
            className="btn-danger w-full"
          >
            {cancelMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
            Cancel Ride Request
          </button>
        )}

        {/* Rating Card */}
        {status === 'completed' && (
          <div className="card p-6 space-y-5">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-brand-light flex items-center justify-center mx-auto mb-3">
                <Award size={22} className="text-brand" />
              </div>
              <h3 className="text-base font-semibold text-ink">How was your trip?</h3>
              <p className="text-sm text-ink-muted mt-1">Rate your driver partner</p>
            </div>

            {ratingSubmitted ? (
              <div className="p-4 rounded-xl bg-success-bg border border-success/20 text-success text-sm font-semibold text-center flex items-center justify-center gap-2">
                <CheckCircle size={16} /> Thank you! Your rating has been recorded.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="p-1 transition hover:scale-110 cursor-pointer"
                    >
                      <Star
                        size={28}
                        className={star <= rating ? 'text-warning fill-warning' : 'text-line-2'}
                      />
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Optional comment (e.g. Clean car, on time)"
                  className="input-field"
                />
                <button
                  type="button"
                  onClick={() => ratingMutation.mutate()}
                  disabled={ratingMutation.isPending}
                  className="btn-primary w-full"
                >
                  {ratingMutation.isPending ? <Spinner size={15} className="text-white" /> : <Star size={15} />}
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
