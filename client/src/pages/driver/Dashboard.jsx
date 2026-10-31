import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { useTripStore } from '../../store/tripStore';
import { api } from '../../services/api';
import { socket } from '../../services/socket';
import LeafletMap from '../../components/map/LeafletMap';
import AppShell from '../../components/ui/AppShell';
import { KPICard, StatusBadge, EmptyState, Skeleton, Toast } from '../../components/ui/UIKit';
import {
  Power, CheckCircle2, XCircle, MapPin, Clock, DollarSign, Loader2,
  Navigation, Car, Award, ShieldCheck, Play, Flag, Wifi, Radio, ChevronRight
} from 'lucide-react';
import clsx from 'clsx';

export default function DriverDashboard() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { setDriverLocation, driverLocation } = useTripStore();

  const [toastMsg, setToastMsg] = useState('');
  const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3500); };

  // Fetch driver dashboard
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

  // Fetch pending ride requests
  const { data: requestsData, isLoading: isRequestsLoading } = useQuery({
    queryKey: ['rideRequests'],
    queryFn: () => api.get('/driver/ride-requests').then((r) => r.data),
    enabled: isOnline && !activeTrip,
    refetchInterval: isOnline && !activeTrip ? 4000 : false,
  });
  const requests = requestsData?.requests || requestsData?.data || [];

  // Toggle availability
  const availabilityMutation = useMutation({
    mutationFn: (newStatus) =>
      api.put('/driver/availability', { availability: newStatus ? 'online' : 'offline', is_available: newStatus }),
    onSuccess: (_, newStatus) => {
      showToast(newStatus ? 'Radar Online — Receiving ride dispatch requests' : 'Went Offline');
      queryClient.invalidateQueries({ queryKey: ['driverDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['rideRequests'] });
    },
    onError: (err) => showToast(err.response?.data?.message || 'Failed to update status.'),
  });

  const acceptMutation = useMutation({
    mutationFn: (id) => api.put(`/driver/ride-requests/${id}/accept`),
    onSuccess: () => {
      showToast('Ride accepted! Route loaded onto HUD.');
      queryClient.invalidateQueries({ queryKey: ['driverDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['rideRequests'] });
    },
    onError: (err) => showToast(err.response?.data?.message || 'Failed to accept ride.'),
  });

  const rejectMutation = useMutation({
    mutationFn: (id) => api.put(`/driver/ride-requests/${id}/reject`),
    onSuccess: () => {
      showToast('Ride declined.');
      queryClient.invalidateQueries({ queryKey: ['rideRequests'] });
    },
  });

  const startTripMutation = useMutation({
    mutationFn: (tripId) => api.put(`/driver/trips/${tripId}/start`),
    onSuccess: () => {
      showToast('Trip started! Driving towards destination.');
      queryClient.invalidateQueries({ queryKey: ['driverDashboard'] });
    },
    onError: (err) => showToast(err.response?.data?.message || 'Failed to start trip.'),
  });

  const completeTripMutation = useMutation({
    mutationFn: (tripId) => api.put(`/driver/trips/${tripId}/complete`, {}),
    onSuccess: () => {
      showToast('Trip successfully completed! Earnings credited.');
      queryClient.invalidateQueries({ queryKey: ['driverDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['rideRequests'] });
    },
    onError: (err) => showToast(err.response?.data?.message || 'Failed to complete trip.'),
  });

  // GPS & Socket heartbeat
  useEffect(() => {
    if (!isOnline) {
      socket.disconnect();
      return;
    }
    socket.connect();
    if (!driverLocation) setDriverLocation([13.0827, 80.2707]);
    let geoWatch;
    if (navigator.geolocation) {
      geoWatch = navigator.geolocation.watchPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setDriverLocation([coords.lat, coords.lng]);
          const tripId = activeTrip?.trip_id || activeTrip?.request_id;
          if (tripId) {
            socket.emit('driver:location', { trip_id: tripId, ...coords });
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
    }
    return () => {
      socket.disconnect();
      if (geoWatch !== undefined) navigator.geolocation.clearWatch(geoWatch);
    };
  }, [isOnline, activeTrip?.trip_id, setDriverLocation, driverLocation]);

  const activeTripId = activeTrip?.trip_id || activeTrip?.request?.trip_id;
  const activeTripStatus = activeTrip?.trip_status || activeTrip?.request?.trip_status || 'accepted';

  return (
    <AppShell
      title="Driver Partner Cockpit"
      subtitle={
        <span className={clsx('flex items-center gap-2 text-xs font-bold', isOnline ? 'text-emerald-600' : 'text-slate-500')}>
          <span className={clsx('w-2 h-2 rounded-full', isOnline ? 'bg-emerald-500 animate-ping' : 'bg-slate-400')} />
          {isOnline ? 'System Online — Accepting dispatch requests' : 'System Offline — Standby mode'}
        </span>
      }
    >
      <Toast message={toastMsg} />

      <div className="space-y-6">
        {/* Cockpit Top Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Availability Toggle */}
          <div
            className={clsx(
              'card p-5 flex flex-col justify-between transition-all duration-300 relative overflow-hidden',
              isOnline
                ? 'bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-white border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                : 'bg-white border-slate-200'
            )}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Driver Radar</span>
                <div className={clsx('text-base font-extrabold mt-0.5', isOnline ? 'text-emerald-700' : 'text-slate-600')}>
                  {isOnline ? 'Online (Beacon Active)' : 'Offline (Paused)'}
                </div>
              </div>
              <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center shadow-sm', isOnline ? 'bg-emerald-500 text-white shadow-emerald-500/30' : 'bg-slate-100 text-slate-400')}>
                <Power size={20} />
              </div>
            </div>

            <button
              onClick={() => availabilityMutation.mutate(!isOnline)}
              disabled={availabilityMutation.isPending}
              className={clsx(
                'w-full py-2.5 rounded-xl text-xs font-bold transition-all mt-4 cursor-pointer shadow-sm',
                isOnline
                  ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                  : 'btn-primary'
              )}
            >
              {availabilityMutation.isPending ? (
                <Loader2 size={15} className="animate-spin mx-auto" />
              ) : isOnline ? (
                'Switch to Offline'
              ) : (
                'Go Live & Online'
              )}
            </button>
          </div>

          {/* KPI Cards */}
          {isDashboardLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card p-5 space-y-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-16" />
              </div>
            ))
          ) : (
            <>
              <KPICard
                label="Total Trips"
                value={stats.total_trips ?? 0}
                icon={Car}
                gradient="linear-gradient(135deg,#3B82F6,#1D4ED8)"
              />
              <KPICard
                label="Today's Trips"
                value={stats.today_trips ?? 0}
                icon={Navigation}
                gradient="linear-gradient(135deg,#F59E0B,#D97706)"
              />
              <KPICard
                label="Total Earnings"
                value={`₹${stats.total_earnings ?? 0}`}
                icon={DollarSign}
                gradient="linear-gradient(135deg,#16A34A,#15803D)"
                accentBg
              />
            </>
          )}
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Driver Credentials Sidebar */}
          <div className="space-y-4">
            {/* Vehicle Card */}
            {vehicle?.vehicle_number && (
              <div className="card p-5 space-y-3 bg-gradient-to-br from-white to-slate-50">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Fleet Assigned</div>
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center justify-center text-2xl flex-shrink-0">
                    🚘
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono font-black text-slate-900 text-sm tracking-wider uppercase">
                      {vehicle.vehicle_number}
                    </div>
                    <div className="text-xs text-slate-500 capitalize mt-0.5">
                      {vehicle.model} • {vehicle.vehicle_type}
                    </div>
                    <div className="text-[11px] text-emerald-600 font-bold mt-1">
                      {vehicle.capacity || 4} Passenger Capacity
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Profile & Rating */}
            <div className="card p-5 space-y-3">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Partner Profile</div>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500 text-white font-black text-lg flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-500/20">
                  {user?.name?.[0]?.toUpperCase() || 'D'}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">{user?.name}</div>
                  <div className="badge bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold mt-0.5">
                    <ShieldCheck size={11} className="inline mr-1" /> Approved Commercial Driver
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Partner Rating</span>
                <span className="font-bold text-amber-500 flex items-center gap-1">
                  <Award size={14} /> {driver.rating || '4.95'} / 5.0
                </span>
              </div>
            </div>
          </div>

          {/* Center Main: Active Trip / Incoming Stream */}
          <div className="lg:col-span-2 space-y-5">
            {/* Active Trip HUD */}
            {activeTrip && (
              <div className="card overflow-hidden border-emerald-500/40 shadow-xl">
                <div className="p-4 bg-emerald-50/80 border-b border-emerald-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                      Live Trip #{activeTripId} Active
                    </span>
                  </div>
                  <StatusBadge status={activeTripStatus} />
                </div>

                {/* Map */}
                <div className="h-60 w-full">
                  <LeafletMap
                    pickupCoords={activeTrip.pickup_location}
                    dropCoords={activeTrip.destination}
                    driverCoords={driverLocation}
                    height="100%"
                    theme="voyager"
                  />
                </div>

                <div className="p-5 space-y-3.5">
                  <div className="flex items-start gap-3">
                    <MapPin size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Pickup Location</div>
                      <div className="text-xs font-bold text-slate-900">{activeTrip.pickup_location}</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Navigation size={16} className="text-rose-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Destination Drop-off</div>
                      <div className="text-xs font-bold text-slate-900">{activeTrip.destination}</div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">Settled Fare</span>
                    <span className="text-xl font-black text-slate-900">₹{activeTrip.estimated_fare || activeTrip.fare || '—'}</span>
                  </div>

                  {/* Trip Controls */}
                  <div className="flex gap-3 pt-2">
                    {activeTripStatus === 'accepted' && (
                      <button
                        onClick={() => startTripMutation.mutate(activeTripId)}
                        disabled={startTripMutation.isPending}
                        className="btn-primary flex-1 py-3 text-sm font-bold shadow-lg shadow-emerald-500/20"
                      >
                        {startTripMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                        Start Passenger Trip
                      </button>
                    )}
                    {activeTripStatus === 'in_progress' && (
                      <button
                        onClick={() => completeTripMutation.mutate(activeTripId)}
                        disabled={completeTripMutation.isPending}
                        className="btn-primary flex-1 py-3 text-sm font-bold shadow-lg shadow-emerald-500/20"
                      >
                        {completeTripMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Flag size={16} />}
                        Complete Trip & Settle Fare
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Incoming Requests Feed */}
            {isOnline && !activeTrip && (
              <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200/80 bg-slate-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Incoming Dispatch Feed</h3>
                    <span className="badge bg-emerald-100 text-emerald-800 text-[10px] font-bold">Live Stream</span>
                  </div>
                  {isRequestsLoading && <Loader2 size={14} className="animate-spin text-slate-400" />}
                </div>

                {requests.length === 0 ? (
                  <EmptyState
                    icon={Radio}
                    title="Scanning for nearby ride bookings..."
                    description="You are active on the dispatch grid. As soon as passengers book, requests will appear here with live routing."
                  />
                ) : (
                  <div className="divide-y divide-slate-100">
                    {requests.map((req) => (
                      <div key={req.request_id} className="p-5 hover:bg-slate-50 transition-colors">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 mb-1">
                              <MapPin size={14} className="text-emerald-600 flex-shrink-0" />
                              <span className="truncate">{req.pickup_location}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                              <Navigation size={14} className="text-rose-600 flex-shrink-0" />
                              <span className="truncate">{req.destination}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-base font-black text-slate-900">₹{req.estimated_fare}</span>
                              <span className="badge bg-slate-100 text-slate-700 capitalize font-medium text-[10px]">
                                {req.vehicle_type || 'Sedan'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <button
                              onClick={() => acceptMutation.mutate(req.request_id)}
                              disabled={acceptMutation.isPending}
                              className="btn-primary text-xs px-4 py-2.5 flex-1 sm:flex-initial shadow-md shadow-emerald-500/20"
                            >
                              <CheckCircle2 size={15} /> Accept Ride
                            </button>
                            <button
                              onClick={() => rejectMutation.mutate(req.request_id)}
                              disabled={rejectMutation.isPending}
                              className="btn-danger text-xs px-3.5 py-2.5"
                            >
                              <XCircle size={15} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Offline Notification */}
            {!isOnline && !activeTrip && (
              <div className="card p-10">
                <EmptyState
                  icon={Power}
                  title="Driver Radar is Offline"
                  description="Toggle the switch to go online and start receiving nearby trip dispatch notifications."
                  action={
                    <button
                      onClick={() => availabilityMutation.mutate(true)}
                      disabled={availabilityMutation.isPending}
                      className="btn-primary shadow-lg shadow-emerald-500/25"
                    >
                      Connect & Go Online
                    </button>
                  }
                />
              </div>
            )}

            {/* Recent Trips Table */}
            {recentTrips.length > 0 && (
              <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200/80 bg-slate-50/50 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Completed Journeys Today</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {recentTrips.map((trip) => (
                    <div key={trip.trip_id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {trip.pickup_location} → {trip.destination}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {trip.passenger_name || 'Passenger'} • {trip.start_time || 'Completed'}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <div className="text-xs font-black text-emerald-700">+₹{trip.fare}</div>
                        <StatusBadge status={trip.trip_status} className="mt-0.5" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
