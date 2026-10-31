import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useTripStore } from '../../store/tripStore';
import { ArrowLeft, MapPin, Navigation, Car, Loader2 } from 'lucide-react';

const VEHICLE_TYPES = ['sedan', 'suv', 'hatchback', 'auto'];

export default function BookRide() {
  const navigate = useNavigate();
  const setActiveTrip = useTripStore((s) => s.setActiveTrip);

  const [form, setForm] = useState({
    pickup_location: '',
    destination: '',
    vehicle_type: 'sedan',
  });
  const [fareEstimate, setFareEstimate] = useState(null);
  const [estimating, setEstimating] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setFareEstimate(null);
    setError('');
  };

  const estimateFare = async () => {
    if (!form.pickup_location || !form.destination) {
      setError('Please enter both pickup and destination.');
      return;
    }
    setEstimating(true);
    setError('');
    try {
      const { data } = await api.get('/rides/search', {
        params: {
          pickup: form.pickup_location,
          destination: form.destination,
          type: form.vehicle_type,
        },
      });
      setFareEstimate(data.estimated_fare || data.fare || data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not estimate fare.');
    } finally {
      setEstimating(false);
    }
  };

  const bookMutation = useMutation({
    mutationFn: () => api.post('/rides/book', form),
    onSuccess: (res) => {
      setActiveTrip(res.data.request || res.data);
      navigate('/passenger/active-trip');
    },
    onError: (err) => {
      setError(err.response?.data?.message || 'Booking failed.');
    },
  });

  return (
    <div className="min-h-screen bg-[hsl(220,15%,10%)]">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 flex items-center gap-4 px-6 py-4 border-b border-[hsl(220,15%,24%)] bg-[hsl(220,15%,10%)]/90 backdrop-blur">
        <Link
          to="/passenger/dashboard"
          className="flex items-center gap-2 text-[hsl(220,10%,60%)] hover:text-white transition"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Dashboard</span>
        </Link>
        <span className="text-white font-semibold ml-2">Book a Ride</span>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div
          className="rounded-2xl p-6"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid hsl(220,15%,24%)',
          }}
        >
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-900/30 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Pickup */}
            <div>
              <label className="block text-sm text-[hsl(220,10%,60%)] mb-1.5 flex items-center gap-2">
                <MapPin size={14} className="text-green-400" />
                Pickup Location
              </label>
              <input
                type="text"
                name="pickup_location"
                value={form.pickup_location}
                onChange={handleChange}
                placeholder="e.g. Chennai Central Railway Station"
                className="w-full px-4 py-2.5 rounded-xl bg-[hsl(220,15%,10%)] border border-[hsl(220,15%,24%)] text-white placeholder-[hsl(220,10%,40%)] focus:outline-none focus:border-[hsl(38,95%,55%)] transition-colors"
              />
            </div>

            {/* Destination */}
            <div>
              <label className="block text-sm text-[hsl(220,10%,60%)] mb-1.5 flex items-center gap-2">
                <Navigation size={14} className="text-red-400" />
                Destination
              </label>
              <input
                type="text"
                name="destination"
                value={form.destination}
                onChange={handleChange}
                placeholder="e.g. Chennai Airport"
                className="w-full px-4 py-2.5 rounded-xl bg-[hsl(220,15%,10%)] border border-[hsl(220,15%,24%)] text-white placeholder-[hsl(220,10%,40%)] focus:outline-none focus:border-[hsl(38,95%,55%)] transition-colors"
              />
            </div>

            {/* Vehicle Type */}
            <div>
              <label className="block text-sm text-[hsl(220,10%,60%)] mb-1.5 flex items-center gap-2">
                <Car size={14} className="text-[hsl(38,95%,55%)]" />
                Vehicle Type
              </label>
              <div className="grid grid-cols-4 gap-2">
                {VEHICLE_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setForm({ ...form, vehicle_type: type })}
                    className={`py-2 rounded-xl text-sm font-medium capitalize transition ${
                      form.vehicle_type === type
                        ? 'bg-[hsl(38,95%,55%)] text-[hsl(220,15%,10%)]'
                        : 'bg-[hsl(220,15%,10%)] border border-[hsl(220,15%,24%)] text-[hsl(220,10%,60%)] hover:text-white'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Fare Estimate */}
            {fareEstimate !== null && (
              <div className="p-4 rounded-xl bg-[hsl(38,95%,55%)]/10 border border-[hsl(38,95%,55%)]/30">
                <div className="text-sm text-[hsl(220,10%,60%)]">Estimated Fare</div>
                <div className="text-2xl font-bold text-[hsl(38,95%,55%)]">
                  ₹{typeof fareEstimate === 'object' ? fareEstimate.estimated_fare || '—' : fareEstimate}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={estimateFare}
                disabled={estimating}
                className="flex-1 py-2.5 rounded-xl border border-[hsl(38,95%,55%)] text-[hsl(38,95%,55%)] font-semibold hover:bg-[hsl(38,95%,55%)]/10 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {estimating && <Loader2 size={16} className="animate-spin" />}
                Get Estimate
              </button>
              <button
                type="button"
                onClick={() => bookMutation.mutate()}
                disabled={bookMutation.isPending || !form.pickup_location || !form.destination}
                className="flex-1 py-2.5 rounded-xl bg-[hsl(38,95%,55%)] text-[hsl(220,15%,10%)] font-bold hover:brightness-110 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {bookMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                Book Now
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
