import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useTripStore } from '../../store/tripStore';
import { socket } from '../../services/socket';
import LeafletMap from '../../components/map/LeafletMap';
import { ArrowLeft, Navigation, Clock, Zap, XCircle, Loader2 } from 'lucide-react';

export default function ActiveTrip() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeTrip, driverLocation, setDriverLocation, clearActiveTrip } = useTripStore();
  const [sseStatus, setSseStatus] = useState('connecting');
  const [telemetry, setTelemetry] = useState(null);
  const eventSourceRef = useRef(null);

  // Poll for trip status if no active trip in store
  const { data: tripData } = useQuery({
    queryKey: ['activeTrip'],
    queryFn: () => api.get('/rides/status/' + activeTrip?.request_id).then((r) => r.data),
    enabled: !!activeTrip?.request_id,
    refetchInterval: 5000,
  });

  const currentTrip = tripData?.request || activeTrip;
  const tripId = currentTrip?.request_id;

  // SSE stream for live telemetry
  useEffect(() => {
    if (!tripId) return;
    const token = localStorage.getItem('cab_token');
    const url = `http://localhost:5000/api/stream/trip/${tripId}?token=${token}`;
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
        const data = JSON.parse(e.data);
        if (data.status === 'completed' || data.status === 'cancelled') {
          queryClient.invalidateQueries({ queryKey: ['passengerTrips'] });
        }
      } catch (_) {}
    });

    // Socket.IO for bidirectional
    socket.connect();
    socket.emit('trip:join', tripId);

    socket.on('driver:location_tick', (data) => {
      if (data.tripId === tripId) {
        setDriverLocation([data.lat, data.lng]);
      }
    });

    return () => {
      es.close();
      socket.off('driver:location_tick');
      socket.disconnect();
    };
  }, [tripId]);

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/rides/cancel/${tripId}`),
    onSuccess: () => {
      clearActiveTrip();
      queryClient.invalidateQueries({ queryKey: ['passengerTrips'] });
      navigate('/passenger/dashboard');
    },
  });

  if (!currentTrip) {
    return (
      <div className="min-h-screen bg-[hsl(220,15%,10%)] flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-[hsl(220,10%,60%)]">No active trip found.</p>
          <Link
            to="/passenger/book-ride"
            className="mt-4 inline-block px-6 py-2.5 rounded-xl bg-[hsl(38,95%,55%)] text-[hsl(220,15%,10%)] font-bold"
          >
            Book a Ride
          </Link>
        </div>
      </div>
    );
  }

  const status = currentTrip.status || 'pending';

  return (
    <div className="min-h-screen bg-[hsl(220,15%,10%)]">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 flex items-center gap-4 px-6 py-4 border-b border-[hsl(220,15%,24%)] bg-[hsl(220,15%,10%)]/90 backdrop-blur">
        <Link to="/passenger/dashboard" className="flex items-center gap-2 text-[hsl(220,10%,60%)] hover:text-white transition">
          <ArrowLeft size={18} />
          <span className="text-sm">Back</span>
        </Link>
        <span className="text-white font-semibold">Active Trip</span>
        <div className="ml-auto flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${sseStatus === 'live' ? 'bg-green-400' : 'bg-yellow-400'}`} />
          <span className="text-xs text-[hsl(220,10%,60%)]">{sseStatus === 'live' ? 'Live' : 'Polling'}</span>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Status Banner */}
        <div className={`p-4 rounded-2xl text-center font-semibold ${
          status === 'accepted' ? 'bg-blue-900/30 border border-blue-500/30 text-blue-400'
          : status === 'in_progress' ? 'bg-green-900/30 border border-green-500/30 text-green-400'
          : status === 'pending' ? 'bg-yellow-900/30 border border-yellow-500/30 text-yellow-400'
          : 'bg-[hsl(220,15%,16%)] border border-[hsl(220,15%,24%)] text-white'
        }`}>
          {status === 'pending' && '⏳ Finding your driver…'}
          {status === 'accepted' && '🚖 Driver is on the way!'}
          {status === 'in_progress' && '🏎️ Trip in progress!'}
          {status === 'completed' && '✅ Trip completed!'}
          {status === 'cancelled' && '❌ Trip cancelled'}
        </div>

        {/* Telemetry HUD */}
        {telemetry && (
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-[hsl(220,15%,16%)] border border-[hsl(220,15%,24%)] text-center">
              <Zap size={16} className="mx-auto text-[hsl(38,95%,55%)] mb-1" />
              <div className="text-white font-bold">{telemetry.speed_kmh ?? '—'}</div>
              <div className="text-xs text-[hsl(220,10%,60%)]">km/h</div>
            </div>
            <div className="p-3 rounded-xl bg-[hsl(220,15%,16%)] border border-[hsl(220,15%,24%)] text-center">
              <Clock size={16} className="mx-auto text-[hsl(220,80%,55%)] mb-1" />
              <div className="text-white font-bold">{telemetry.eta_minutes ?? '—'}</div>
              <div className="text-xs text-[hsl(220,10%,60%)]">min ETA</div>
            </div>
            <div className="p-3 rounded-xl bg-[hsl(220,15%,16%)] border border-[hsl(220,15%,24%)] text-center">
              <Navigation size={16} className="mx-auto text-green-400 mb-1" />
              <div className="text-white font-bold">{telemetry.progress_percent ?? '—'}%</div>
              <div className="text-xs text-[hsl(220,10%,60%)]">Progress</div>
            </div>
          </div>
        )}

        {/* Map */}
        <div className="rounded-2xl overflow-hidden">
          <LeafletMap
            driverCoords={driverLocation}
          />
        </div>

        {/* Trip Details */}
        <div className="p-4 rounded-2xl border border-[hsl(220,15%,24%)] bg-[hsl(220,15%,16%)]">
          <h3 className="text-white font-semibold mb-3">Trip Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[hsl(220,10%,60%)]">From</span>
              <span className="text-white text-right">{currentTrip.pickup_location}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[hsl(220,10%,60%)]">To</span>
              <span className="text-white text-right">{currentTrip.destination}</span>
            </div>
            {currentTrip.estimated_fare && (
              <div className="flex justify-between">
                <span className="text-[hsl(220,10%,60%)]">Est. Fare</span>
                <span className="text-[hsl(38,95%,55%)] font-bold">₹{currentTrip.estimated_fare}</span>
              </div>
            )}
          </div>
        </div>

        {/* Cancel Button */}
        {(status === 'pending') && (
          <button
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending}
            className="w-full py-3 rounded-xl border border-red-500/50 text-red-400 font-semibold hover:bg-red-900/20 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {cancelMutation.isPending
              ? <><Loader2 size={16} className="animate-spin" /> Cancelling…</>
              : <><XCircle size={16} /> Cancel Ride</>
            }
          </button>
        )}
      </main>
    </div>
  );
}
