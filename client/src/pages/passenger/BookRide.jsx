import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useTripStore } from '../../store/tripStore';
import LeafletMap from '../../components/map/LeafletMap';
import AppShell from '../../components/ui/AppShell';
import { EmptyState, StatusBadge, Spinner } from '../../components/ui/UIKit';
import {
  MapPin, Navigation, Car, Loader2, AlertCircle, XCircle, CheckCircle, Sparkles
} from 'lucide-react';
import clsx from 'clsx';

const VEHICLE_TYPES = [
  { id: 'sedan',    label: 'Sedan',    icon: '🚗', desc: 'Comfortable 4-seater' },
  { id: 'suv',      label: 'SUV',      icon: '🚙', desc: 'Spacious 6-seater' },
  { id: 'hatchback',label: 'Hatchback',icon: '🚘', desc: 'Budget compact' },
  { id: 'auto',     label: 'Auto',     icon: '🛺', desc: 'Quick & nimble' },
];

const POPULAR_LOCATIONS = [
  'Chennai Central Railway Station',
  'Anna Nagar Roundtana',
  'T. Nagar Ranganathan St',
  'Chennai Airport',
  'Phoenix Market City, Velachery',
  'Marina Beach Lighthouse',
];

export default function BookRide() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setActiveTrip = useTripStore((s) => s.setActiveTrip);

  const [form, setForm] = useState({ pickup_location: '', destination: '', vehicle_type: 'sedan' });
  const [fareEstimate, setFareEstimate] = useState(null);
  const [estimating, setEstimating] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const { data: dashboardData } = useQuery({
    queryKey: ['passengerDashboard'],
    queryFn: () => api.get('/passenger/dashboard').then((r) => r.data),
    refetchInterval: 5000,
  });
  const activeRide = dashboardData?.activeRide;

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setFareEstimate(null);
    setError('');
  };

  const estimateFare = async () => {
    if (!form.pickup_location.trim() || !form.destination.trim()) {
      setError('Please enter both pickup and destination locations.');
      return;
    }
    setEstimating(true);
    setError('');
    try {
      const { data } = await api.get('/rides/search', {
        params: {
          pickup: form.pickup_location.trim(),
          destination: form.destination.trim(),
          type: form.vehicle_type,
        },
      });
      const fare = data.estimated_fare || data.fareOptions?.[0]?.estimated_fare || 250;
      setFareEstimate({
        fare,
        distance_km: data.estimated_km || 8.5,
        availableDrivers: data.availableDrivers || 3,
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not estimate fare. Please check your addresses.');
    } finally {
      setEstimating(false);
    }
  };

  const bookMutation = useMutation({
    mutationFn: () =>
      api.post('/rides/book', {
        pickup_location: form.pickup_location.trim(),
        destination: form.destination.trim(),
        vehicle_type: form.vehicle_type,
        estimated_fare: fareEstimate?.fare,
      }),
    onSuccess: (res) => {
      const newRide = res.data.request || res.data;
      setActiveTrip(newRide);
      queryClient.invalidateQueries({ queryKey: ['passengerDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['passengerTrips'] });
      navigate('/passenger/active-trip');
    },
    onError: (err) => {
      setError(err.response?.data?.message || 'Booking failed.');
      queryClient.invalidateQueries({ queryKey: ['passengerDashboard'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (requestId) => api.post(`/rides/cancel/${requestId}`),
    onSuccess: () => {
      setSuccessMsg('Active ride cancelled. You can now book a new ride.');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['passengerDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['passengerTrips'] });
      setTimeout(() => setSuccessMsg(''), 4000);
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to cancel active ride.'),
  });

  const showMapPreview = form.pickup_location.trim() && form.destination.trim();

  return (
    <AppShell title="Book a Ride" subtitle="Enter your route and request a driver">
      <div className="max-w-2xl mx-auto space-y-5 animate-fade-in">

        {/* Active Ride Warning */}
        {activeRide && (
          <div className="card-sm p-4 bg-warning-bg border-warning/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertCircle size={18} className="text-warning flex-shrink-0" />
              <div>
                <div className="text-sm font-semibold text-ink">You already have an active ride</div>
                <div className="text-xs text-ink-muted">Cancel it first to book a new one.</div>
              </div>
            </div>
            <button
              onClick={() => cancelMutation.mutate(activeRide.request_id)}
              disabled={cancelMutation.isPending}
              className="btn-danger text-xs px-3 py-2"
            >
              {cancelMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : null}
              Cancel Ride
            </button>
          </div>
        )}

        {/* Success Message */}
        {successMsg && (
          <div className="card-sm p-4 bg-success-bg border-success/20 flex items-center gap-2 text-success text-sm font-medium">
            <CheckCircle size={16} /> {successMsg}
          </div>
        )}

        {/* Booking Form */}
        <div className="card p-6 space-y-5">
          <h2 className="text-base font-semibold text-ink">Route Details</h2>

          {/* Error */}
          {error && (
            <div className="px-4 py-3 rounded-xl bg-error-bg border border-error/20 text-error text-sm flex items-center gap-2">
              <AlertCircle size={15} /> {error}
            </div>
          )}

          {/* Pickup */}
          <div>
            <label className="block text-xs font-semibold text-ink-muted mb-2 flex items-center gap-1.5">
              <MapPin size={13} className="text-success" /> Pickup Location
            </label>
            <input
              type="text"
              name="pickup_location"
              value={form.pickup_location}
              onChange={handleChange}
              placeholder="Enter pickup address or landmark"
              className="input-field"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {POPULAR_LOCATIONS.slice(0, 3).map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => { setForm({ ...form, pickup_location: loc }); setFareEstimate(null); }}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-canvas border border-line text-ink-muted hover:text-ink hover:border-line-2 transition"
                >
                  {loc.split(',')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Destination */}
          <div>
            <label className="block text-xs font-semibold text-ink-muted mb-2 flex items-center gap-1.5">
              <Navigation size={13} className="text-error" /> Destination
            </label>
            <input
              type="text"
              name="destination"
              value={form.destination}
              onChange={handleChange}
              placeholder="Enter drop-off address or landmark"
              className="input-field"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {POPULAR_LOCATIONS.slice(3, 6).map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => { setForm({ ...form, destination: loc }); setFareEstimate(null); }}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-canvas border border-line text-ink-muted hover:text-ink hover:border-line-2 transition"
                >
                  {loc.split(',')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Vehicle Selection */}
          <div>
            <label className="block text-xs font-semibold text-ink-muted mb-3 flex items-center gap-1.5">
              <Car size={13} className="text-info" /> Vehicle Type
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {VEHICLE_TYPES.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => { setForm({ ...form, vehicle_type: v.id }); setFareEstimate(null); }}
                  className={clsx(
                    'py-3.5 px-3 rounded-xl text-sm font-medium transition flex flex-col items-center gap-1.5 border cursor-pointer',
                    form.vehicle_type === v.id
                      ? 'bg-brand-light border-brand/30 text-brand shadow-sm'
                      : 'bg-white border-line text-ink-muted hover:border-line-2 hover:text-ink'
                  )}
                >
                  <span className="text-xl">{v.icon}</span>
                  <span className="font-semibold text-xs">{v.label}</span>
                  <span className="text-[10px] text-center leading-tight opacity-70">{v.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Fare Estimate */}
          {fareEstimate && (
            <div className="p-4 rounded-xl bg-brand-50 border border-brand/20 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs text-ink-muted font-medium mb-1">Estimated Fare</div>
                <div className="text-2xl font-bold text-ink">₹{fareEstimate.fare}</div>
                <div className="text-xs text-ink-muted mt-1">~{fareEstimate.distance_km} km · {fareEstimate.availableDrivers} driver(s) nearby</div>
              </div>
              <span className="badge bg-success-bg text-success text-xs">Instant Dispatch</span>
            </div>
          )}

          {/* Map Preview */}
          {showMapPreview && (
            <div>
              <div className="text-xs font-semibold text-ink-muted mb-2 flex items-center justify-between">
                <span>Route Preview</span>
                <span className="text-[11px] text-brand font-medium">Interactive Map</span>
              </div>
              <div className="rounded-2xl overflow-hidden border border-line h-56">
                <LeafletMap
                  pickupCoords={form.pickup_location}
                  dropCoords={form.destination}
                  theme="voyager"
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={estimateFare}
              disabled={estimating || !form.pickup_location.trim() || !form.destination.trim()}
              className="btn-secondary flex-1 disabled:opacity-50"
            >
              {estimating ? <Spinner size={15} className="text-ink-muted" /> : <Sparkles size={15} />}
              Get Fare Quote
            </button>
            <button
              type="button"
              onClick={() => bookMutation.mutate()}
              disabled={bookMutation.isPending || !!activeRide || !form.pickup_location.trim() || !form.destination.trim()}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              {bookMutation.isPending ? <Spinner size={15} className="text-white" /> : <Car size={15} />}
              Request Ride
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
