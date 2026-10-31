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
  Navigation, Car, Award, ShieldCheck, Play, Flag
} from 'lucide-react';

export default function DriverDashboard() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setDriverLocation, driverLocation } = useTripStore();

  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  // 1. Fetch comprehensive driver profile, stats, vehicle, and active trip
  const { data: dashboardData, isLoading: isDashboardLoading } = useQuery({
    queryKey: ['driverDashboard'],
    queryFn: () => api.get('/driver/dashboard').then((r) => r.data),
    refetchInterval: 5000,
  });

  const driver = dashboardData?.driver || {};
  const vehicle = dashboardData?.vehicle || {};
  const stats = dashboardData?.stats || {};
  const activeTrip = dashboardData?.activeTrip || null;
  const recentTrips = dashboardData?.recentTrips || [];

  const isOnline = driver.availability === 'online';

  // 2. Fetch pending ride requests when online
  const { data: requestsData, isLoading: isRequestsLoading } = useQuery({
    queryKey: ['rideRequests'],
    queryFn: () => api.get('/driver/ride-requests').then((r) => r.data),
    enabled: isOnline && !activeTrip,
    refetchInterval: isOnline && !activeTrip ? 4000 : false,
  });

  const requests = requestsData?.requests || requestsData?.data || [];

  // 3. Toggle availability
  const availabilityMutation = useMutation({
    mutationFn: (newStatus) =>
      api.put('/driver/availability', {
        availability: newStatus ? 'online' : 'offline',
        is_available: newStatus,
      }),
    onSuccess: (_, newStatus) => {
      showToast(newStatus ? '🟢 You are now Online and accepting rides' : '🔴 You went Offline');
      queryClient.invalidateQueries({ queryKey: ['driverDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['rideRequests'] });
    },
    onError: (err) => {
      showToast(err.response?.data?.message || 'Failed to update availability status.');
    },
  });

  // 4. Accept ride request
  const acceptMutation = useMutation({
    mutationFn: (id) => api.put(`/driver/ride-requests/${id}/accept`),
    onSuccess: () => {
      showToast('🚖 Ride accepted! Active navigation initialized.');
      queryClient.invalidateQueries({ queryKey: ['driverDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['rideRequests'] });
    },
    onError: (err) => {
      showToast(err.response?.data?.message || 'Failed to accept ride.');
    },
  });

  // 5. Reject ride request
  const rejectMutation = useMutation({
    mutationFn: (id) => api.put(`/driver/ride-requests/${id}/reject`),
    onSuccess: () => {
      showToast('Ride rejected.');
      queryClient.invalidateQueries({ queryKey: ['rideRequests'] });
    },
  });

  // 6. Start active trip
  const startTripMutation = useMutation({
    mutationFn: (tripId) => api.put(`/driver/trips/${tripId}/start`),
    onSuccess: () => {
      showToast('🚀 Trip started! Drive safely.');
      queryClient.invalidateQueries({ queryKey: ['driverDashboard'] });
    },
    onError: (err) => {
      showToast(err.response?.data?.message || 'Failed to start trip.');
    },
  });

  // 7. Complete active trip
  const completeTripMutation = useMutation({
    mutationFn: (tripId) => api.put(`/driver/trips/${tripId}/complete`, {}),
    onSuccess: () => {
      showToast('🎉 Trip completed! Fare settled.');
      queryClient.invalidateQueries({ queryKey: ['driverDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['rideRequests'] });
    },
    onError: (err) => {
      showToast(err.response?.data?.message || 'Failed to complete trip.');
    },
  });

  // Socket: connect when online, send GPS telemetry
  useEffect(() => {
    if (!isOnline) {
      socket.disconnect();
      return;
    }
    socket.connect();

    // Default driver location to Chennai center if GPS unavailable
    if (!driverLocation) {
      setDriverLocation([13.0827, 80.2707]);
    }

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

    return () => {
      socket.disconnect();
      if (geoWatch !== undefined) navigator.geolocation.clearWatch(geoWatch);
    };
  }, [isOnline]);

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch (_) {}
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[hsl(220,15%,10%)] pb-12">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl bg-[hsl(220,15%,16%)] border border-amber-500/40 text-amber-300 shadow-xl text-sm font-medium animate-fade-in flex items-center gap-2">
          <span>🔔</span> {toastMsg}
        </div>
      )}

      {/* Navbar */}
      <nav className="sticky top-0 z-40 flex items-center justify-between px-6 py-4 border-b border-[hsl(220,15%,24%)] bg-[hsl(220,15%,10%)]/95 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🚖</span>
          <span className="font-bold text-white text-xl font-['Outfit']">CabGo</span>
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-900/40 text-emerald-400 border border-emerald-500/30">
            Driver Partner
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-white text-sm font-semibold">{user?.name || driver.name || 'Driver'}</div>
            <div className="text-[hsl(220,10%,60%)] text-xs">{driver.license_no || 'TN-01-2021-008976'}</div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm text-[hsl(220,10%,60%)] hover:text-white hover:bg-[hsl(220,15%,16%)] border border-transparent hover:border-[hsl(220,15%,24%)] transition cursor-pointer"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Availability Toggle Banner */}
        <div
          className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl border transition-all ${
            isOnline
              ? 'border-emerald-500/40 bg-emerald-950/20 shadow-lg shadow-emerald-950/20'
              : 'border-[hsl(220,15%,24%)] bg-[hsl(220,15%,16%)]'
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-white font-bold text-lg">
                {isOnline ? 'You are Online' : 'You are Offline'}
              </span>
            </div>
            <p className="text-[hsl(220,10%,60%)] text-sm mt-1">
              {isOnline
                ? 'Your radar is live. Ready to receive passenger bookings.'
                : 'Switch online to broadcast location and receive ride dispatches.'}
            </p>
          </div>

          <button
            onClick={() => availabilityMutation.mutate(!isOnline)}
            disabled={availabilityMutation.isPending}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition shadow-md cursor-pointer disabled:opacity-50 ${
              isOnline
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {availabilityMutation.isPending ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Power size={18} />
            )}
            {isOnline ? 'Go Offline' : 'Go Online'}
          </button>
        </div>

        {/* Driver KPI Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[hsl(220,15%,14%)] border border-[hsl(220,15%,22%)]">
            <div className="flex items-center justify-between text-xs text-[hsl(220,10%,60%)] mb-1">
              <span>Today's Earnings</span>
              <DollarSign size={14} className="text-amber-400" />
            </div>
            <div className="text-xl font-bold text-white">₹{stats.today_earnings ?? 0}</div>
            <div className="text-[10px] text-[hsl(220,10%,50%)] mt-1">Total: ₹{stats.total_earnings ?? 0}</div>
          </div>

          <div className="p-4 rounded-xl bg-[hsl(220,15%,14%)] border border-[hsl(220,15%,22%)]">
            <div className="flex items-center justify-between text-xs text-[hsl(220,10%,60%)] mb-1">
              <span>Completed Trips</span>
              <Navigation size={14} className="text-blue-400" />
            </div>
            <div className="text-xl font-bold text-white">{stats.completed_trips ?? 0}</div>
            <div className="text-[10px] text-emerald-400 mt-1">100% fulfillment</div>
          </div>

          <div className="p-4 rounded-xl bg-[hsl(220,15%,14%)] border border-[hsl(220,15%,22%)]">
            <div className="flex items-center justify-between text-xs text-[hsl(220,10%,60%)] mb-1">
              <span>Driver Rating</span>
              <Award size={14} className="text-amber-400" />
            </div>
            <div className="text-xl font-bold text-white">⭐ {driver.rating ? Number(driver.rating).toFixed(1) : '5.0'}</div>
            <div className="text-[10px] text-[hsl(220,10%,50%)] mt-1">Top Tier Driver</div>
          </div>

          <div className="p-4 rounded-xl bg-[hsl(220,15%,14%)] border border-[hsl(220,15%,22%)]">
            <div className="flex items-center justify-between text-xs text-[hsl(220,10%,60%)] mb-1">
              <span>Active Vehicle</span>
              <Car size={14} className="text-emerald-400" />
            </div>
            <div className="text-sm font-bold text-white truncate">{vehicle.model || 'Sedan'}</div>
            <div className="text-[10px] text-emerald-400 mt-1 uppercase tracking-wider">{vehicle.vehicle_number || 'TN-09-AB-1234'}</div>
          </div>
        </div>

        {/* ACTIVE TRIP CONSOLE (If driver has an ongoing ride) */}
        {activeTrip && (
          <div className="p-6 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500 text-[hsl(220,15%,10%)]">
                  Active Trip #{activeTrip.trip_id}
                </span>
                <span className="text-sm text-amber-300 font-medium capitalize">
                  Status: {activeTrip.trip_status.replace('_', ' ')}
                </span>
              </div>
              <div className="text-xl font-extrabold text-amber-400">
                ₹{activeTrip.fare}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-5">
              <div className="space-y-2 bg-[hsl(220,15%,12%)]/80 p-4 rounded-xl border border-[hsl(220,15%,20%)]">
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <MapPin size={16} className="text-emerald-400 flex-shrink-0" />
                  <div>
                    <span className="text-xs text-gray-500 block">Pickup</span>
                    <span className="font-semibold">{activeTrip.pickup_location || 'Pickup Location'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-300 pt-2 border-t border-[hsl(220,15%,18%)]">
                  <MapPin size={16} className="text-red-400 flex-shrink-0" />
                  <div>
                    <span className="text-xs text-gray-500 block">Destination</span>
                    <span className="font-semibold">{activeTrip.destination || 'Destination'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-[hsl(220,15%,12%)]/80 p-4 rounded-xl border border-[hsl(220,15%,20%)] flex flex-col justify-between">
                <div>
                  <span className="text-xs text-gray-500 block">Passenger</span>
                  <span className="text-base font-bold text-white">{activeTrip.passenger_name || 'Passenger'}</span>
                  {activeTrip.passenger_mobile && (
                    <span className="text-xs text-gray-400 block mt-0.5">📱 {activeTrip.passenger_mobile}</span>
                  )}
                </div>

                <div className="pt-3">
                  {activeTrip.trip_status === 'accepted' ? (
                    <button
                      onClick={() => startTripMutation.mutate(activeTrip.trip_id)}
                      disabled={startTripMutation.isPending}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-[hsl(220,15%,10%)] font-bold transition cursor-pointer disabled:opacity-50"
                    >
                      {startTripMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                      Start Trip (Passenger Onboard)
                    </button>
                  ) : (
                    <button
                      onClick={() => completeTripMutation.mutate(activeTrip.trip_id)}
                      disabled={completeTripMutation.isPending}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition cursor-pointer disabled:opacity-50"
                    >
                      {completeTripMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Flag size={16} />}
                      Complete Trip &amp; Collect Fare
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Live Interactive GIS Map */}
        <div className="rounded-2xl overflow-hidden border border-[hsl(220,15%,24%)] bg-[hsl(220,15%,14%)]">
          <div className="p-3.5 border-b border-[hsl(220,15%,20%)] flex items-center justify-between">
            <span className="text-sm font-semibold text-white flex items-center gap-2">
              <Navigation size={16} className="text-emerald-400" />
              Live Vehicle Radar &amp; GPS HUD
            </span>
            <span className="text-xs text-[hsl(220,10%,50%)]">OpenStreetMap + Leaflet GIS</span>
          </div>
          <div className="h-72">
            <LeafletMap driverCoords={driverLocation || [13.0827, 80.2707]} />
          </div>
        </div>

        {/* Pending Ride Requests Radar */}
        {isOnline && !activeTrip && (
          <div>
            <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <span>Incoming Dispatch Radar</span>
              {requests.length > 0 && (
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500 text-black animate-bounce">
                  {requests.length} Available
                </span>
              )}
            </h3>

            {isRequestsLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-24 rounded-2xl bg-[hsl(220,15%,16%)] animate-pulse" />
                ))}
              </div>
            ) : requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed border-[hsl(220,15%,24%)] rounded-2xl bg-[hsl(220,15%,12%)]">
                <Clock size={32} className="text-[hsl(220,10%,40%)] mb-2" />
                <p className="text-white font-medium text-sm">Searching for passenger requests...</p>
                <p className="text-[hsl(220,10%,50%)] text-xs mt-1">New trip bookings will appear here instantly with sound &amp; vibration alert.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((req) => (
                  <div
                    key={req.request_id}
                    className="p-4 rounded-2xl border border-amber-500/30 bg-[hsl(220,15%,16%)] shadow-lg hover:border-amber-500/60 transition"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm text-white mb-1.5 font-medium">
                          <MapPin size={14} className="text-emerald-400 flex-shrink-0" />
                          <span className="truncate">Pickup: {req.pickup_location}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-[hsl(220,10%,70%)] font-medium">
                          <MapPin size={14} className="text-red-400 flex-shrink-0" />
                          <span className="truncate">Destination: {req.destination}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-3">
                          <span className="text-base font-bold text-amber-400">
                            ₹{req.estimated_fare}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded bg-[hsl(220,15%,22%)] text-[hsl(220,10%,60%)] uppercase font-semibold">
                            {req.vehicle_type || 'Sedan'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => acceptMutation.mutate(req.request_id)}
                          disabled={acceptMutation.isPending}
                          className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition shadow cursor-pointer disabled:opacity-50"
                        >
                          <CheckCircle size={16} />
                          Accept Ride
                        </button>
                        <button
                          onClick={() => rejectMutation.mutate(req.request_id)}
                          disabled={rejectMutation.isPending}
                          className="flex items-center justify-center p-2.5 rounded-xl border border-red-500/40 text-red-400 hover:bg-red-950/30 transition cursor-pointer disabled:opacity-50"
                          title="Decline"
                        >
                          <XCircle size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Recent Completed Trips */}
        {recentTrips.length > 0 && (
          <div className="rounded-2xl border border-[hsl(220,15%,22%)] bg-[hsl(220,15%,14%)] p-5">
            <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider text-[hsl(220,10%,70%)]">
              Recent Trip Receipts ({recentTrips.length})
            </h3>
            <div className="divide-y divide-[hsl(220,15%,20%)]">
              {recentTrips.map((trip) => (
                <div key={trip.trip_id} className="py-3 flex items-center justify-between text-sm">
                  <div>
                    <div className="text-white font-medium">
                      {trip.pickup_location} → {trip.destination}
                    </div>
                    <div className="text-xs text-[hsl(220,10%,50%)] mt-0.5">
                      {trip.passenger_name} • {trip.distance_km} km • {trip.start_time}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-emerald-400">+₹{trip.fare}</div>
                    <div className="text-[10px] text-gray-500 capitalize">{trip.trip_status}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
