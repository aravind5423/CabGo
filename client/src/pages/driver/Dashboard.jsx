import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { useTripStore } from '../../store/tripStore';
import { api } from '../../services/api';
import { socket } from '../../services/socket';
import LeafletMap from '../../components/map/LeafletMap';
import {
  Power, CheckCircle, XCircle, LogOut, MapPin, Clock, DollarSign, Loader2,
} from 'lucide-react';

export default function DriverDashboard() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setDriverLocation, driverLocation } = useTripStore();

  const [isOnline, setIsOnline] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  // Fetch ride requests
  const { data: requestsData, isLoading } = useQuery({
    queryKey: ['rideRequests'],
    queryFn: () => api.get('/driver/ride-requests').then((r) => r.data),
    enabled: isOnline,
    refetchInterval: isOnline ? 10000 : false,
  });

  const requests = requestsData?.requests || requestsData?.data || [];

  // Toggle availability
  const availabilityMutation = useMutation({
    mutationFn: (status) => api.put('/driver/availability', { is_available: status }),
    onSuccess: (_, status) => {
      setIsOnline(status);
      showToast(status ? '✅ You are now online' : '🔴 You went offline');
      queryClient.invalidateQueries({ queryKey: ['rideRequests'] });
    },
  });

  // Accept ride
  const acceptMutation = useMutation({
    mutationFn: (id) => api.put(`/driver/ride-requests/${id}/accept`),
    onSuccess: () => {
      showToast('🚖 Ride accepted!');
      queryClient.invalidateQueries({ queryKey: ['rideRequests'] });
    },
    onError: (err) => {
      showToast(err.response?.data?.message || 'Failed to accept ride');
    },
  });

  // Reject ride
  const rejectMutation = useMutation({
    mutationFn: (id) => api.put(`/driver/ride-requests/${id}/reject`),
    onSuccess: () => {
      showToast('Ride rejected');
      queryClient.invalidateQueries({ queryKey: ['rideRequests'] });
    },
  });

  // Socket: connect when online, send GPS pings
  useEffect(() => {
    if (!isOnline) {
      socket.disconnect();
      return;
    }
    socket.connect();

    // Simulate GPS heartbeat using geolocation
    let geoWatch;
    if (navigator.geolocation) {
      geoWatch = navigator.geolocation.watchPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          socket.emit('driver:ping_location', coords);
          setDriverLocation([coords.lat, coords.lng]);
        },
        () => {},
        { enableHighAccuracy: true }
      );
    }

    // SSE: listen for new ride requests
    const token = localStorage.getItem('cab_token');
    const es = new EventSource(`http://localhost:5000/api/stream/driver-dispatch?token=${token}`);
    es.addEventListener('new_request', () => {
      showToast('🔔 New ride request!');
      queryClient.invalidateQueries({ queryKey: ['rideRequests'] });
    });

    return () => {
      socket.disconnect();
      es.close();
      if (geoWatch !== undefined) navigator.geolocation.clearWatch(geoWatch);
    };
  }, [isOnline]);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch (_) {}
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[hsl(220,15%,10%)]">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl bg-[hsl(220,15%,16%)] border border-[hsl(220,15%,24%)] text-white shadow-lg text-sm">
          {toastMsg}
        </div>
      )}

      {/* Navbar */}
      <nav className="sticky top-0 z-40 flex items-center justify-between px-6 py-4 border-b border-[hsl(220,15%,24%)] bg-[hsl(220,15%,10%)]/90 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🚖</span>
          <span className="font-bold text-white text-xl font-['Outfit']">CabGo</span>
          <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-blue-900/30 text-blue-400">Driver</span>
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

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Online / Offline Toggle */}
        <div
          className={`flex items-center justify-between p-5 rounded-2xl border ${
            isOnline
              ? 'border-green-500/30 bg-green-900/10'
              : 'border-[hsl(220,15%,24%)] bg-[hsl(220,15%,16%)]'
          }`}
        >
          <div>
            <div className="text-white font-semibold text-lg">
              {isOnline ? '🟢 You are Online' : '🔴 You are Offline'}
            </div>
            <div className="text-[hsl(220,10%,60%)] text-sm mt-0.5">
              {isOnline ? 'Accepting ride requests' : 'Go online to start receiving rides'}
            </div>
          </div>
          <button
            onClick={() => availabilityMutation.mutate(!isOnline)}
            disabled={availabilityMutation.isPending}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition disabled:opacity-50 ${
              isOnline
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {availabilityMutation.isPending
              ? <Loader2 size={16} className="animate-spin" />
              : <Power size={16} />
            }
            {isOnline ? 'Go Offline' : 'Go Online'}
          </button>
        </div>

        {/* Map */}
        {isOnline && (
          <div className="rounded-2xl overflow-hidden">
            <LeafletMap driverCoords={driverLocation} />
          </div>
        )}

        {/* Ride Requests */}
        {isOnline && (
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">
              Pending Ride Requests
              {requests.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-[hsl(38,95%,55%)] text-[hsl(220,15%,10%)]">
                  {requests.length}
                </span>
              )}
            </h3>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-24 rounded-2xl bg-[hsl(220,15%,16%)] animate-pulse" />
                ))}
              </div>
            ) : requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-[hsl(220,15%,24%)] rounded-2xl">
                <Clock size={36} className="text-[hsl(220,10%,40%)] mb-3" />
                <p className="text-[hsl(220,10%,60%)]">No pending requests right now.</p>
                <p className="text-[hsl(220,10%,40%)] text-sm">New requests will appear here instantly.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((req) => (
                  <div
                    key={req.request_id}
                    className="p-4 rounded-2xl border border-[hsl(220,15%,24%)] bg-[hsl(220,15%,16%)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm text-[hsl(220,10%,60%)] mb-1">
                          <MapPin size={12} className="text-green-400" />
                          <span className="truncate">{req.pickup_location}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-[hsl(220,10%,60%)]">
                          <MapPin size={12} className="text-red-400" />
                          <span className="truncate">{req.destination}</span>
                        </div>
                        {req.estimated_fare && (
                          <div className="flex items-center gap-1 mt-2 text-[hsl(38,95%,55%)] font-bold">
                            <DollarSign size={14} />
                            ₹{req.estimated_fare}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <button
                          onClick={() => acceptMutation.mutate(req.request_id)}
                          disabled={acceptMutation.isPending}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition disabled:opacity-50"
                        >
                          <CheckCircle size={14} />
                          Accept
                        </button>
                        <button
                          onClick={() => rejectMutation.mutate(req.request_id)}
                          disabled={rejectMutation.isPending}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-500/50 text-red-400 text-sm font-semibold hover:bg-red-900/20 transition disabled:opacity-50"
                        >
                          <XCircle size={14} />
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
