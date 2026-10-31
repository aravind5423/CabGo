import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useTripStore } from '../../store/tripStore';
import LeafletMap from '../../components/map/LeafletMap';
import AppShell from '../../components/ui/AppShell';
import { EmptyState, StatusBadge, Spinner } from '../../components/ui/UIKit';
import {
  MapPin, Navigation, Car, AlertCircle, XCircle, CheckCircle2, Sparkles, ArrowRight
} from 'lucide-react';
import clsx from 'clsx';

const VEHICLE_TYPES = [
  { id: 'sedan',     label: 'Sedan',     icon: '🚘', desc: 'Comfortable 4-seater' },
  { id: 'suv',       label: 'SUV',       icon: '🚙', desc: 'Spacious 6-seater' },
  { id: 'hatchback', label: 'Hatchback', icon: '🚗', desc: 'City compact economy' },
  { id: 'auto',      label: 'Auto',      icon: '🛺', desc: 'Fast & affordable' },
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
      setError('Please provide both pickup and drop-off addresses.');
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
        distance_km: data.estimated_km || 7.5,
        availableDrivers: data.availableDrivers || 3,
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not calculate routing. Please check addresses.');
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
      setError(err.response?.data?.message || 'Booking failed. Please try again.');
      queryClient.invalidateQueries({ queryKey: ['passengerDashboard'] });
    },
  });

  const showMapPreview = Boolean(form.pickup_location.trim() && form.destination.trim());

  return (
    <AppShell title="Book a Ride" subtitle="Instant on-demand cab dispatch across Chennai">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Active Ride Alert */}
        {activeRide && (
          <div className="card p-4 bg-amber-500/10 border-amber-500/30 flex items-center justify-between gap-4 animate-slide-in">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center flex-shrink-0">
                <AlertCircle size={20} />
              </div>
              <div>
                <div className="text-xs font-bold text-amber-900">You already have an ongoing ride (#{activeRide.request_id})</div>
                <div className="text-[11px] text-amber-700">Track your current driver on the Live Radar.</div>
              </div>
            </div>
            <button
              onClick={() => navigate('/passenger/active-trip')}
              className="btn-primary text-xs px-3.5 py-2 shadow-sm"
            >
              Open Active Ride
            </button>
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div className="card p-4 bg-rose-50 border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-3 animate-fade-in">
            <XCircle size={18} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Notification */}
        {successMsg && (
          <div className="card p-4 bg-emerald-50 border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-3 animate-fade-in">
            <CheckCircle2 size={18} className="flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Booking Interface Card */}
        <div className="card p-6 sm:p-8 space-y-6">
          {/* Pickup Address */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Pickup Location
            </label>
            <div className="relative">
              <input
                type="text"
                name="pickup_location"
                value={form.pickup_location}
                onChange={handleChange}
                placeholder="Enter pickup address, station or landmark"
                className="input-field pl-10"
              />
              <MapPin size={17} className="text-emerald-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Quick chips */}
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {POPULAR_LOCATIONS.slice(0, 3).map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => { setForm({ ...form, pickup_location: loc }); setFareEstimate(null); }}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 transition"
                >
                  {loc.split(',')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Destination Address */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500" /> Destination Drop-off
            </label>
            <div className="relative">
              <input
                type="text"
                name="destination"
                value={form.destination}
                onChange={handleChange}
                placeholder="Where to? (e.g. Airport, T. Nagar, Central)"
                className="input-field pl-10"
              />
              <Navigation size={17} className="text-rose-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Quick chips */}
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {POPULAR_LOCATIONS.slice(3, 6).map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => { setForm({ ...form, destination: loc }); setFareEstimate(null); }}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 border border-slate-200 transition"
                >
                  {loc.split(',')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Vehicle Selection Grid */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              Select Fleet Category
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {VEHICLE_TYPES.map((v) => {
                const isSelected = form.vehicle_type === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => { setForm({ ...form, vehicle_type: v.id }); setFareEstimate(null); }}
                    className={clsx(
                      'p-4 rounded-2xl flex flex-col items-center text-center transition-all cursor-pointer border relative overflow-hidden',
                      isSelected
                        ? 'bg-gradient-to-b from-emerald-50 to-white border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    )}
                  >
                    <span className="text-3xl mb-1 transition-transform duration-300 group-hover:scale-110">{v.icon}</span>
                    <span className="text-xs font-bold text-slate-900">{v.label}</span>
                    <span className="text-[10px] text-slate-500 mt-0.5 leading-tight">{v.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Fare Estimate Card */}
          {fareEstimate && (
            <div className="card p-5 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-white border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-pop-in">
              <div>
                <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Quote Estimate</div>
                <div className="text-3xl font-black text-slate-900 mt-0.5">
                  ₹{fareEstimate.fare}
                </div>
                <div className="text-xs text-slate-600 mt-1 flex items-center gap-2">
                  <span>~{fareEstimate.distance_km} km distance</span>
                  <span>•</span>
                  <span>{fareEstimate.availableDrivers} verified driver(s) nearby</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="badge bg-emerald-100 text-emerald-800 border-emerald-300 text-xs px-3 py-1 font-bold">
                  Zero Surge Pricing
                </span>
              </div>
            </div>
          )}

          {/* Route Map Preview */}
          {showMapPreview && (
            <div className="space-y-2 animate-fade-in">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Interactive Route Preview</span>
                <span className="text-[11px] text-emerald-600">CartoDB Voyager Satellite Tiles</span>
              </div>
              <div className="rounded-2xl overflow-hidden border border-slate-200 h-64 shadow-inner">
                <LeafletMap
                  pickupCoords={form.pickup_location}
                  dropCoords={form.destination}
                  theme="voyager"
                />
              </div>
            </div>
          )}

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={estimateFare}
              disabled={estimating || !form.pickup_location.trim() || !form.destination.trim()}
              className="btn-secondary flex-1 py-3 text-sm font-bold"
            >
              {estimating ? <Spinner size={16} className="text-slate-600" /> : <Sparkles size={16} />}
              {estimating ? 'Calculating...' : 'Calculate Route & Fare'}
            </button>
            <button
              type="button"
              onClick={() => bookMutation.mutate()}
              disabled={bookMutation.isPending || !!activeRide || !form.pickup_location.trim() || !form.destination.trim()}
              className="btn-primary flex-1 py-3 text-sm font-bold shadow-lg shadow-emerald-500/25"
            >
              {bookMutation.isPending ? <Spinner size={16} className="text-white" /> : <Car size={16} />}
              {bookMutation.isPending ? 'Dispatching Ride...' : 'Confirm & Request Driver'}
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
