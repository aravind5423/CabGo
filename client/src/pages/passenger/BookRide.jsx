import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useTripStore } from '../../store/tripStore';
import LeafletMap from '../../components/map/LeafletMap';
import {
  ArrowLeft, MapPin, Navigation, Car, Loader2, AlertCircle, Eye, XCircle, CheckCircle, Sparkles
} from 'lucide-react';

const VEHICLE_TYPES = [
  { id: 'sedan', label: 'Sedan', icon: '🚗' },
  { id: 'suv', label: 'SUV', icon: '🚙' },
  { id: 'hatchback', label: 'Hatchback', icon: '🚘' },
  { id: 'auto', label: 'Auto', icon: '🛺' },
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

  const [form, setForm] = useState({
    pickup_location: '',
    destination: '',
    vehicle_type: 'sedan',
  });
  const [fareEstimate, setFareEstimate] = useState(null);
  const [estimating, setEstimating] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 1. Check if passenger already has an active ride in progress
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

  // 2. Estimate fare
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

  // 3. Book ride mutation
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

  // 4. Cancel active ride mutation
  const cancelMutation = useMutation({
    mutationFn: (requestId) => api.post(`/rides/cancel/${requestId}`),
    onSuccess: () => {
      setSuccessMsg('Active ride cancelled. You can now book a new ride.');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['passengerDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['passengerTrips'] });
      setTimeout(() => setSuccessMsg(''), 4000);
    },
    onError: (err) => {
      setError(err.response?.data?.message || 'Failed to cancel active ride.');
    },
  });

  return (
    <div className="min-h-screen bg-[hsl(220,15%,10%)] pb-12">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 border-b border-[hsl(220,15%,24%)] bg-[hsl(220,15%,10%)]/95 backdrop-blur">
        <Link
          to="/passenger/dashboard"
          className="flex items-center gap-2 text-[hsl(220,10%,60%)] hover:text-white transition font-medium"
        >
          <ArrowLeft size={18} />
          <span>Back to Dashboard</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xl">🚖</span>
          <span className="text-white font-bold font-['Outfit']">Book a Ride</span>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* ACTIVE RIDE WARNING BANNER */}
        {activeRide && (
          <div className="p-5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 shadow-xl space-y-3">
            <div className="flex items-start gap-3">
              <AlertCircle size={22} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-amber-300 font-bold text-base">
                  You already have an active ride request in progress!
                </div>
                <p className="text-gray-300 text-sm mt-0.5">
                  Request #{activeRide.request_id}: <strong className="text-white">{activeRide.pickup_location}</strong> → <strong className="text-white">{activeRide.destination}</strong>
                </p>
                <div className="text-xs text-amber-400 mt-1 uppercase font-semibold">
                  Status: {activeRide.status.replace('_', ' ')}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Link
                to="/passenger/active-trip"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition cursor-pointer shadow"
              >
                <Eye size={16} />
                Track Live Ride
              </Link>
              <button
                type="button"
                onClick={() => cancelMutation.mutate(activeRide.request_id)}
                disabled={cancelMutation.isPending}
                className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl border border-red-500/40 text-red-400 hover:bg-red-950/30 font-semibold text-sm transition cursor-pointer disabled:opacity-50"
              >
                {cancelMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                Cancel This Ride
              </button>
            </div>
          </div>
        )}

        {/* Feedback Alerts */}
        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-sm flex items-center gap-2">
            <CheckCircle size={18} />
            <span>{successMsg}</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-sm flex items-center gap-2">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Booking Card */}
        <div
          className="rounded-2xl p-6 sm:p-8"
          style={{
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(12px)',
            border: '1px solid hsl(220,15%,24%)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}
        >
          <div className="space-y-5">
            {/* Pickup */}
            <div>
              <label className="block text-sm text-[hsl(220,10%,70%)] mb-1.5 flex items-center gap-2 font-medium">
                <MapPin size={16} className="text-emerald-400" />
                Pickup Location
              </label>
              <input
                type="text"
                name="pickup_location"
                value={form.pickup_location}
                onChange={handleChange}
                placeholder="e.g. Anna Nagar Roundtana"
                className="w-full px-4 py-3 rounded-xl bg-[hsl(220,15%,12%)] border border-[hsl(220,15%,24%)] text-white placeholder-[hsl(220,10%,40%)] focus:outline-none focus:border-amber-400 transition"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="text-[11px] text-[hsl(220,10%,50%)] mr-1 self-center">Suggestions:</span>
                {POPULAR_LOCATIONS.slice(0, 3).map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => { setForm({ ...form, pickup_location: loc }); setFareEstimate(null); }}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-[hsl(220,15%,18%)] hover:bg-[hsl(220,15%,24%)] text-gray-300 transition"
                  >
                    {loc.split(',')[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* Destination */}
            <div>
              <label className="block text-sm text-[hsl(220,10%,70%)] mb-1.5 flex items-center gap-2 font-medium">
                <Navigation size={16} className="text-red-400" />
                Destination Location
              </label>
              <input
                type="text"
                name="destination"
                value={form.destination}
                onChange={handleChange}
                placeholder="e.g. Chennai Airport"
                className="w-full px-4 py-3 rounded-xl bg-[hsl(220,15%,12%)] border border-[hsl(220,15%,24%)] text-white placeholder-[hsl(220,10%,40%)] focus:outline-none focus:border-amber-400 transition"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="text-[11px] text-[hsl(220,10%,50%)] mr-1 self-center">Suggestions:</span>
                {POPULAR_LOCATIONS.slice(3).map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => { setForm({ ...form, destination: loc }); setFareEstimate(null); }}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-[hsl(220,15%,18%)] hover:bg-[hsl(220,15%,24%)] text-gray-300 transition"
                  >
                    {loc.split(',')[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* Vehicle Type Selection */}
            <div>
              <label className="block text-sm text-[hsl(220,10%,70%)] mb-2 flex items-center gap-2 font-medium">
                <Car size={16} className="text-amber-400" />
                Select Vehicle Tier
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {VEHICLE_TYPES.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => { setForm({ ...form, vehicle_type: v.id }); setFareEstimate(null); }}
                    className={`py-3 px-3 rounded-xl text-sm font-semibold transition flex flex-col items-center gap-1 cursor-pointer border ${
                      form.vehicle_type === v.id
                        ? 'bg-amber-500 text-black border-amber-400 shadow-md'
                        : 'bg-[hsl(220,15%,14%)] text-gray-300 border-[hsl(220,15%,22%)] hover:bg-[hsl(220,15%,18%)]'
                    }`}
                  >
                    <span className="text-xl">{v.icon}</span>
                    <span>{v.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Fare Estimate Display */}
            {fareEstimate && (
              <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                <div>
                  <span className="text-xs text-[hsl(220,10%,60%)] block font-medium">Estimated Road Fare</span>
                  <div className="text-3xl font-extrabold text-amber-400">
                    ₹{fareEstimate.fare}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    ~{fareEstimate.distance_km} km • {fareEstimate.availableDrivers} driver(s) nearby
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-900/40 text-emerald-400 border border-emerald-500/30 font-medium">
                    Instant Dispatch
                  </span>
                </div>
              </div>
            )}

            {/* Route Map Preview */}
            {form.pickup_location.trim() && form.destination.trim() && (
              <div className="space-y-2">
                <div className="text-xs text-[hsl(220,10%,60%)] font-semibold uppercase tracking-wider flex items-center justify-between">
                  <span>🗺️ Route Overview</span>
                  <span className="text-[11px] text-emerald-400">Interactive GIS Preview</span>
                </div>
                <div className="rounded-2xl overflow-hidden border border-[hsl(220,15%,24%)] h-64 bg-[hsl(220,15%,12%)]">
                  <LeafletMap
                    pickupCoords={form.pickup_location}
                    dropCoords={form.destination}
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-3">
              <button
                type="button"
                onClick={estimateFare}
                disabled={estimating || !form.pickup_location.trim() || !form.destination.trim()}
                className="flex-1 py-3 rounded-xl border border-amber-500/50 text-amber-400 font-bold hover:bg-amber-500/10 transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {estimating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                Get Fare Quote
              </button>
              <button
                type="button"
                onClick={() => bookMutation.mutate()}
                disabled={bookMutation.isPending || !form.pickup_location.trim() || !form.destination.trim()}
                className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold transition cursor-pointer disabled:opacity-50 shadow-lg flex items-center justify-center gap-2"
              >
                {bookMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Car size={18} />}
                Request Ride Now
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
