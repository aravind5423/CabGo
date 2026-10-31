import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { api, streamUrl, errorMessage } from '../../services/api';
import { socket } from '../../services/socket';
import LeafletMap from '../../components/map/LeafletMap';
import AppShell from '../../components/ui/AppShell';
import { KPICard, StatusBadge, EmptyState, SkeletonKPIs, Skeleton, Toast, useToast, Spinner, Alert, RouteLabel, IconChip } from '../../components/ui/UIKit';
import { Power, CheckCircle2, X, Car, Wallet, Play, Flag, Radio, Phone, Star, Navigation, Clock, User } from 'lucide-react';
import { formatCurrency, formatDate, formatDistance, capitalize, timeAgo } from '../../utils/format';
import clsx from 'clsx';

export default function DriverDashboard() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [toast, showToast] = useToast();
  const [dismissed, setDismissed] = useState(() => new Set());
  const [telemetry, setTelemetry] = useState(null);

  const { data, isLoading, error: dashError } = useQuery({
    queryKey: ['driverDashboard'],
    queryFn: () => api.get('/driver/dashboard').then((r) => r.data),
    refetchInterval: 5000,
  });

  const driver      = data?.driver || {};
  const vehicle     = data?.vehicle || null;
  const stats       = data?.stats || {};
  const activeTrip  = data?.activeTrip || null;
  const recentTrips = data?.recentTrips || [];
  const isOnline    = driver.availability === 'online';
  const isApproved  = !driver.verification_status || driver.verification_status === 'approved';

  const { data: requestsData, isFetching: fetchingRequests } = useQuery({
    queryKey: ['rideRequests'],
    queryFn: () => api.get('/driver/ride-requests').then((r) => r.data),
    enabled: isOnline && !activeTrip,
    refetchInterval: isOnline && !activeTrip ? 4000 : false,
  });
  const requests = (requestsData?.requests || []).filter((r) => !dismissed.has(r.request_id));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['driverDashboard'] });
    queryClient.invalidateQueries({ queryKey: ['rideRequests'] });
  };

  const availabilityMutation = useMutation({
    mutationFn: (online) => api.put('/driver/availability', { availability: online ? 'online' : 'offline' }),
    onSuccess: (_, online) => { showToast(online ? 'You are online and receiving requests.' : 'You are now offline.'); invalidate(); },
    onError: (err) => showToast(errorMessage(err, 'Failed to update availability.'), 'error'),
  });

  const acceptMutation = useMutation({
    mutationFn: (id) => api.put(`/driver/ride-requests/${id}/accept`),
    onSuccess: () => { showToast('Ride accepted. Head to the pickup point.'); invalidate(); },
    onError: (err) => { showToast(errorMessage(err, 'Failed to accept ride.'), 'error'); invalidate(); },
  });

  const rejectMutation = useMutation({
    mutationFn: (id) => api.put(`/driver/ride-requests/${id}/reject`),
    onSuccess: (_, id) => { setDismissed((s) => new Set(s).add(id)); showToast('Request declined.', 'info'); },
  });

  const startMutation = useMutation({
    mutationFn: (tripId) => api.put(`/driver/trips/${tripId}/start`),
    onSuccess: () => { showToast('Trip started.'); invalidate(); },
    onError: (err) => showToast(errorMessage(err, 'Failed to start trip.'), 'error'),
  });

  const completeMutation = useMutation({
    mutationFn: (tripId) => api.put(`/driver/trips/${tripId}/complete`, { payment_method: 'cash' }),
    onSuccess: (res) => { showToast(`Trip completed. Fare collected: ${formatCurrency(res.data?.fare)}`); setTelemetry(null); invalidate(); },
    onError: (err) => showToast(errorMessage(err, 'Failed to complete trip.'), 'error'),
  });

  // Live trip telemetry (server simulation via SSE) + relay position over Socket.IO to the passenger room.
  const activeTripId = activeTrip?.trip_id;
  const activeStatus = activeTrip?.trip_status;
  useEffect(() => {
    if (!activeTripId) { setTelemetry(null); return undefined; }

    const es = new EventSource(streamUrl(`/stream/trip/${activeTripId}`));
    socket.connect();
    socket.emit('join:trip', activeTripId);

    es.addEventListener('telemetry', (e) => {
      try {
        const t = JSON.parse(e.data);
        setTelemetry(t);
        socket.emit('driver:ping_location', { tripId: activeTripId, lat: t.lat, lng: t.lng, bearing: t.bearing });
      } catch { /* ignore */ }
    });
    es.addEventListener('ride_cancelled', () => { showToast('The passenger cancelled this ride.', 'error'); invalidate(); });
    es.addEventListener('trip_arrived', () => showToast('Vehicle has arrived at the destination.', 'info'));

    return () => { es.close(); socket.disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTripId]);

  const vehiclePos = telemetry?.lat && telemetry?.lng ? [telemetry.lat, telemetry.lng] : null;

  return (
    <AppShell
      title="Driver dashboard"
      subtitle={isOnline ? 'Online — receiving ride requests' : 'Offline'}
      action={
        <button
          onClick={() => availabilityMutation.mutate(!isOnline)}
          disabled={availabilityMutation.isPending || isLoading || (!isOnline && !isApproved)}
          className={clsx(isOnline ? 'btn-danger-soft' : 'btn-primary')}
        >
          {availabilityMutation.isPending ? <Spinner size={15} /> : <Power size={15} />}
          {isOnline ? 'Go offline' : 'Go online'}
        </button>
      }
    >
      <Toast toast={toast} />
      <div className="space-y-6">
        {dashError && <Alert type="error">{errorMessage(dashError, 'Could not load your dashboard.')}</Alert>}

        {!isLoading && !isApproved && (
          <Alert type={driver.verification_status === 'rejected' ? 'error' : 'warning'}>
            {driver.verification_status === 'rejected'
              ? 'Your driver application was rejected. Please contact support.'
              : 'Your account is pending verification by an operations admin. You can manage your vehicles now and go online once approved.'}
          </Alert>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading ? <SkeletonKPIs /> : (
            <>
              <KPICard label="Today's earnings" value={formatCurrency(stats.today_earnings ?? 0)} icon={Wallet} tone="brand" hint={`${stats.today_trips ?? 0} trip${stats.today_trips === 1 ? '' : 's'} today`} />
              <KPICard label="Total earnings" value={formatCurrency(stats.total_earnings ?? 0)} icon={Wallet} tone="amber" />
              <KPICard label="Completed trips" value={stats.completed_trips ?? 0} icon={CheckCircle2} tone="blue" hint={`${stats.cancelled_trips ?? 0} cancelled`} />
              <KPICard label="Rating" value={Number(driver.rating || 0).toFixed(2)} icon={Star} tone="amber" hint="out of 5" />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: profile + vehicle */}
          <div className="space-y-4">
            <div className="card p-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white font-semibold text-lg flex items-center justify-center flex-shrink-0">
                  {user?.name?.[0]?.toUpperCase() || 'D'}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">{driver.name || user?.name}</div>
                  <div className="text-xs text-slate-500 truncate">{driver.email || user?.email}</div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs">
                <div className="flex items-center justify-between"><span className="text-slate-500">Verification</span><StatusBadge status={driver.verification_status || 'approved'} /></div>
                <div className="flex items-center justify-between"><span className="text-slate-500">Availability</span><StatusBadge status={driver.availability || 'offline'} /></div>
                <div className="flex items-center justify-between"><span className="text-slate-500">Licence</span><span className="font-mono text-slate-700">{driver.license_no || '—'}</span></div>
              </div>
            </div>

            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Active vehicle</div>
                <Link to="/driver/vehicles" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">Manage</Link>
              </div>
              {isLoading ? (
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-xl" />
                  <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-28" /><Skeleton className="h-3 w-40" /></div>
                </div>
              ) : vehicle ? (
                <div className="flex items-center gap-3">
                  <IconChip icon={Car} tone="slate" />
                  <div className="min-w-0">
                    <div className="font-mono font-semibold text-slate-900 text-sm">{vehicle.vehicle_number}</div>
                    <div className="text-xs text-slate-500 truncate">{vehicle.model} · {capitalize(vehicle.vehicle_type)} · {vehicle.capacity} seats</div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">No vehicle registered yet. Add one to receive requests.</p>
              )}
            </div>
          </div>

          {/* Main column */}
          <div className="lg:col-span-2 space-y-5">
            {activeTrip && (
              <div className="card overflow-hidden border-emerald-200">
                <div className="card-header bg-emerald-50/60">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                    <span className="live-dot" /> Current trip #{activeTripId}
                  </div>
                  <StatusBadge status={activeStatus} />
                </div>
                <div className="h-64">
                  <LeafletMap pickupCoords={activeTrip.pickup_location} dropCoords={activeTrip.destination} driverCoords={vehiclePos} bearing={telemetry?.bearing || 0} />
                </div>
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <RouteLabel pickup={activeTrip.pickup_location} destination={activeTrip.destination} />
                    <div className="flex items-center gap-3 sm:justify-end">
                      <IconChip icon={User} tone="blue" size="sm" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">{activeTrip.passenger_name}</div>
                        {activeTrip.passenger_mobile && (
                          <a href={`tel:${activeTrip.passenger_mobile}`} className="text-xs text-emerald-700 font-medium flex items-center gap-1"><Phone size={11} /> {activeTrip.passenger_mobile}</a>
                        )}
                      </div>
                    </div>
                  </div>

                  {telemetry && activeStatus === 'in_progress' && (
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-lg bg-slate-50 p-2.5"><div className="text-[11px] text-slate-500">Speed</div><div className="text-sm font-semibold text-slate-900">{telemetry.speed_kmh ?? 0} km/h</div></div>
                      <div className="rounded-lg bg-slate-50 p-2.5"><div className="text-[11px] text-slate-500">ETA</div><div className="text-sm font-semibold text-slate-900">{telemetry.eta_minutes ?? '—'} min</div></div>
                      <div className="rounded-lg bg-slate-50 p-2.5"><div className="text-[11px] text-slate-500">Progress</div><div className="text-sm font-semibold text-slate-900">{telemetry.progress_percent ?? 0}%</div></div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] text-slate-500">Fare</div>
                      <div className="text-xl font-semibold text-slate-900">{formatCurrency(activeTrip.fare ?? activeTrip.estimated_fare)}</div>
                    </div>
                    {activeStatus === 'accepted' && (
                      <button onClick={() => startMutation.mutate(activeTripId)} disabled={startMutation.isPending} className="btn-primary btn-lg">
                        {startMutation.isPending ? <Spinner size={15} /> : <Play size={15} />} Start trip
                      </button>
                    )}
                    {activeStatus === 'in_progress' && (
                      <button onClick={() => completeMutation.mutate(activeTripId)} disabled={completeMutation.isPending} className="btn-primary btn-lg">
                        {completeMutation.isPending ? <Spinner size={15} /> : <Flag size={15} />} Complete trip
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!activeTrip && isOnline && (
              <div className="card overflow-hidden">
                <div className="card-header">
                  <div className="flex items-center gap-2">
                    <div className="card-title">Incoming requests</div>
                    {vehicle && <span className="badge badge-neutral">{capitalize(vehicle.vehicle_type)}</span>}
                  </div>
                  {fetchingRequests && <Spinner size={14} className="text-slate-400" />}
                </div>
                {requests.length === 0 ? (
                  <EmptyState icon={Radio} title="Waiting for ride requests" description="You're online. New bookings matching your vehicle type will show up here." compact />
                ) : (
                  <div className="divide-y divide-slate-100">
                    {requests.map((req) => (
                      <div key={req.request_id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <RouteLabel pickup={req.pickup_location} destination={req.destination} />
                          <div className="flex items-center gap-3 mt-2.5 text-xs text-slate-500">
                            <span className="text-base font-semibold text-slate-900">{formatCurrency(req.estimated_fare)}</span>
                            <span>{req.passenger_name}</span>
                            <span className="flex items-center gap-1"><Clock size={11} /> {timeAgo(req.requested_at)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => acceptMutation.mutate(req.request_id)} disabled={acceptMutation.isPending} className="btn-primary flex-1 sm:flex-initial">
                            {acceptMutation.isPending && acceptMutation.variables === req.request_id ? <Spinner size={14} /> : <CheckCircle2 size={14} />} Accept
                          </button>
                          <button onClick={() => rejectMutation.mutate(req.request_id)} disabled={rejectMutation.isPending} className="btn-secondary" aria-label="Decline">
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!activeTrip && !isOnline && !isLoading && (
              <div className="card">
                <EmptyState
                  icon={Power}
                  title="You're offline"
                  description={isApproved ? 'Go online to start receiving ride requests near you.' : 'You can go online once your account has been verified.'}
                  action={isApproved && (
                    <button onClick={() => availabilityMutation.mutate(true)} disabled={availabilityMutation.isPending} className="btn-primary">
                      <Power size={15} /> Go online
                    </button>
                  )}
                />
              </div>
            )}

            <div className="card overflow-hidden">
              <div className="card-header">
                <div className="card-title">Recent trips</div>
                <Link to="/driver/earnings" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">Earnings</Link>
              </div>
              {recentTrips.length === 0 ? (
                <EmptyState icon={Navigation} title="No trips yet" description="Completed trips will appear here." compact />
              ) : (
                <div className="divide-y divide-slate-100">
                  {recentTrips.map((t) => (
                    <div key={t.trip_id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-slate-900 truncate">{t.pickup_location} → {t.destination}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{t.passenger_name} · {formatDate(t.end_time || t.start_time)}{t.distance_km ? ` · ${formatDistance(t.distance_km)}` : ''}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-semibold text-slate-900">{formatCurrency(t.fare)}</div>
                        <StatusBadge status={t.trip_status} className="mt-1" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
