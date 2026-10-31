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
  Power, CheckCircle, XCircle, MapPin, Clock, DollarSign, Loader2,
  Navigation, Car, Award, ShieldCheck, Play, Flag, Wifi
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
      showToast(newStatus ? 'You are now Online — accepting rides' : 'You went Offline');
      queryClient.invalidateQueries({ queryKey: ['driverDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['rideRequests'] });
    },
    onError: (err) => showToast(err.response?.data?.message || 'Failed to update status.'),
  });

  const acceptMutation = useMutation({
    mutationFn: (id) => api.put(`/driver/ride-requests/${id}/accept`),
    onSuccess: () => { showToast('Ride accepted!'); queryClient.invalidateQueries({ queryKey: ['driverDashboard'] }); queryClient.invalidateQueries({ queryKey: ['rideRequests'] }); },
    onError: (err) => showToast(err.response?.data?.message || 'Failed to accept ride.'),
  });

  const rejectMutation = useMutation({
    mutationFn: (id) => api.put(`/driver/ride-requests/${id}/reject`),
    onSuccess: () => { showToast('Ride rejected.'); queryClient.invalidateQueries({ queryKey: ['rideRequests'] }); },
  });

  const startTripMutation = useMutation({
    mutationFn: (tripId) => api.put(`/driver/trips/${tripId}/start`),
    onSuccess: () => { showToast('Trip started! Drive safely.'); queryClient.invalidateQueries({ queryKey: ['driverDashboard'] }); },
    onError: (err) => showToast(err.response?.data?.message || 'Failed to start trip.'),
  });

  const completeTripMutation = useMutation({
    mutationFn: (tripId) => api.put(`/driver/trips/${tripId}/complete`, {}),
    onSuccess: () => { showToast('Trip completed! Fare settled.'); queryClient.invalidateQueries({ queryKey: ['driverDashboard'] }); queryClient.invalidateQueries({ queryKey: ['rideRequests'] }); },
    onError: (err) => showToast(err.response?.data?.message || 'Failed to complete trip.'),
  });

  // GPS & Socket
  useEffect(() => {
    if (!isOnline) { socket.disconnect(); return; }
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
  }, [isOnline, activeTrip?.trip_id]);

  const activeTripId = activeTrip?.trip_id || activeTrip?.request?.trip_id;
  const activeTripStatus = activeTrip?.trip_status || activeTrip?.request?.trip_status || 'accepted';

  return (
    <AppShell
      title="Driver Dashboard"
      subtitle={
        <span className={clsx('flex items-center gap-1.5 text-xs font-medium', isOnline ? 'text-success' : 'text-ink-muted')}>
          <span className={clsx('w-1.5 h-1.5 rounded-full', isOnline ? 'bg-success animate-pulse' : 'bg-ink-faint')} />
          {isOnline ? 'Online — Accepting rides' : 'Offline'}
        </span>
      }
    >
      <Toast message={toastMsg} />

      <div className="space-y-5 animate-fade-in">
        {/* Top Bar: Toggle + Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Availability Toggle */}
          <div className={clsx(
            'card-sm p-5 flex flex-col gap-4',
            isOnline ? 'border-success/30 bg-success-bg/30' : 'border-line'
          )}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-1">Availability</div>
                <div className={clsx('text-sm font-bold', isOnline ? 'text-success' : 'text-ink-muted')}>
                  {isOnline ? 'Online' : 'Offline'}
                </div>
              </div>
              <Power size={20} className={isOnline ? 'text-success' : 'text-ink-faint'} />
            </div>
            <button
              onClick={() => availabilityMutation.mutate(!isOnline)}
              disabled={availabilityMutation.isPending}
              className={clsx(
                'w-full py-2 rounded-xl text-sm font-semibold transition',
                isOnline
                  ? 'bg-error-bg text-error border border-error/20 hover:bg-error/10'
                  : 'btn-primary'
              )}
            >
              {availabilityMutation.isPending
                ? <Loader2 size={14} className="animate-spin mx-auto" />
                : isOnline ? 'Go Offline' : 'Go Online'
              }
            </button>
          </div>

          {/* KPIs */}
          {isDashboardLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card-sm p-5 space-y-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-16" />
              </div>
            ))
          ) : (
            <>
              <KPICard label="Total Trips"    value={stats.total_trips ?? 0}    icon={Car}         iconClass="text-info" />
              <KPICard label="Today's Trips"  value={stats.today_trips ?? 0}    icon={Navigation}  iconClass="text-brand" />
              <KPICard label="Total Earnings" value={`₹${stats.total_earnings ?? 0}`} icon={DollarSign} iconClass="text-brand" accentBg />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left Column: Vehicle & Active Trip */}
          <div className="space-y-4">
            {/* Vehicle Card */}
            {vehicle?.vehicle_number && (
              <div className="card-sm p-4">
                <div className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-3">My Vehicle</div>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-brand-light flex items-center justify-center text-xl flex-shrink-0">
                    🚗
                  </div>
                  <div>
                    <div className="font-bold text-ink text-sm tracking-wider font-mono uppercase">
                      {vehicle.vehicle_number}
                    </div>
                    <div className="text-xs text-ink-muted mt-0.5 capitalize">
                      {vehicle.model} · {vehicle.vehicle_type} · {vehicle.capacity || 4} seats
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Driver Profile */}
            <div className="card-sm p-4 space-y-3">
              <div className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Profile</div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-light flex items-center justify-center font-bold text-brand flex-shrink-0">
                  {user?.name?.[0]?.toUpperCase() || 'D'}
                </div>
                <div>
                  <div className="text-sm font-semibold text-ink">{user?.name}</div>
                  <span className="badge bg-success-bg text-success text-[11px]">
                    <ShieldCheck size={11} className="inline mr-0.5" /> Verified Partner
                  </span>
                </div>
              </div>
              {driver.avg_rating && (
                <div className="flex items-center gap-1.5 pt-2 border-t border-line">
                  <Award size={14} className="text-warning" />
                  <span className="text-sm font-semibold text-ink">{driver.avg_rating}</span>
                  <span className="text-xs text-ink-muted">avg rating</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Active Trip / Requests */}
          <div className="lg:col-span-2 space-y-4">

            {/* Active Trip Control */}
            {activeTrip && (
              <div className="card overflow-hidden border-brand/20">
                <div className="px-5 py-4 border-b border-line bg-brand-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
                    <span className="text-sm font-semibold text-brand">Active Trip #{activeTripId}</span>
                  </div>
                  <StatusBadge status={activeTripStatus} />
                </div>

                {/* Map */}
                <div className="h-52">
                  <LeafletMap
                    pickupCoords={activeTrip.pickup_location}
                    dropCoords={activeTrip.destination}
                    driverCoords={driverLocation}
                    height="100%"
                    theme="voyager"
                  />
                </div>

                <div className="p-5 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <MapPin size={15} className="text-success mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-[11px] text-ink-muted">Pickup</div>
                      <div className="text-sm font-medium text-ink">{activeTrip.pickup_location}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Navigation size={15} className="text-error mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-[11px] text-ink-muted">Destination</div>
                      <div className="text-sm font-medium text-ink">{activeTrip.destination}</div>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-line flex items-center justify-between">
                    <span className="text-xs text-ink-muted">Fare</span>
                    <span className="text-lg font-bold text-ink">₹{activeTrip.estimated_fare || activeTrip.fare || '—'}</span>
                  </div>

                  <div className="flex gap-2 pt-1">
                    {activeTripStatus === 'accepted' && (
                      <button
                        onClick={() => startTripMutation.mutate(activeTripId)}
                        disabled={startTripMutation.isPending}
                        className="btn-primary flex-1 text-sm"
                      >
                        {startTripMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                        Start Trip
                      </button>
                    )}
                    {activeTripStatus === 'in_progress' && (
                      <button
                        onClick={() => completeTripMutation.mutate(activeTripId)}
                        disabled={completeTripMutation.isPending}
                        className="btn-primary flex-1 text-sm"
                      >
                        {completeTripMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Flag size={15} />}
                        Complete Trip
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Ride Requests */}
            {isOnline && !activeTrip && (
              <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-line flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-ink">Incoming Requests</h2>
                  {isRequestsLoading && <Loader2 size={15} className="animate-spin text-ink-muted" />}
                </div>

                {requests.length === 0 ? (
                  <EmptyState
                    icon={Clock}
                    title="Waiting for requests"
                    description="New trip bookings will appear here instantly."
                  />
                ) : (
                  <div className="divide-y divide-[#F3F4F6]">
                    {requests.map((req) => (
                      <div key={req.request_id} className="p-5 hover:bg-canvas transition">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-sm font-medium text-ink mb-1">
                              <MapPin size={13} className="text-success flex-shrink-0" />
                              <span className="truncate">{req.pickup_location}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-ink-muted">
                              <Navigation size={13} className="text-error flex-shrink-0" />
                              <span className="truncate">{req.destination}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-2.5">
                              <span className="text-base font-bold text-ink">₹{req.estimated_fare}</span>
                              <span className="badge bg-canvas text-ink-muted capitalize">{req.vehicle_type || 'Sedan'}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => acceptMutation.mutate(req.request_id)}
                              disabled={acceptMutation.isPending}
                              className="btn-primary text-sm px-4 py-2.5"
                            >
                              <CheckCircle size={14} /> Accept
                            </button>
                            <button
                              onClick={() => rejectMutation.mutate(req.request_id)}
                              disabled={rejectMutation.isPending}
                              className="btn-danger text-sm px-4 py-2.5"
                            >
                              <XCircle size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Offline State */}
            {!isOnline && !activeTrip && (
              <div className="card p-10">
                <EmptyState
                  icon={Power}
                  title="You're Offline"
                  description="Go online to start accepting passenger ride requests."
                  action={
                    <button
                      onClick={() => availabilityMutation.mutate(true)}
                      disabled={availabilityMutation.isPending}
                      className="btn-primary"
                    >
                      Go Online
                    </button>
                  }
                />
              </div>
            )}

            {/* Recent Trips */}
            {recentTrips.length > 0 && (
              <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-line">
                  <h2 className="text-sm font-semibold text-ink">Recent Trips</h2>
                </div>
                <div className="divide-y divide-[#F3F4F6]">
                  {recentTrips.map((trip) => (
                    <div key={trip.trip_id} className="px-5 py-4 flex items-center justify-between hover:bg-canvas transition">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-ink truncate">
                          {trip.pickup_location} → {trip.destination}
                        </div>
                        <div className="text-xs text-ink-muted mt-0.5">
                          {trip.passenger_name} · {trip.distance_km} km · {trip.start_time}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <div className="text-sm font-semibold text-success">+₹{trip.fare}</div>
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
