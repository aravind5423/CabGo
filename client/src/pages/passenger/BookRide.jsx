import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../services/api';
import { useTripStore } from '../../store/tripStore';
import LeafletMap from '../../components/map/LeafletMap';
import AppShell from '../../components/ui/AppShell';
import { Alert, Spinner } from '../../components/ui/UIKit';
import { MapPin, Navigation, Car, CarFront, CarTaxiFront, Bike, Truck, Calculator, Users } from 'lucide-react';
import { formatCurrency, formatDistance } from '../../utils/format';
import clsx from 'clsx';

const VEHICLE_TYPES = [
  { id: 'sedan',     label: 'Sedan',     icon: CarFront,     seats: 4 },
  { id: 'suv',       label: 'SUV',       icon: Truck,        seats: 6 },
  { id: 'hatchback', label: 'Hatchback', icon: Car,          seats: 4 },
  { id: 'auto',      label: 'Auto',      icon: CarTaxiFront, seats: 3 },
  { id: 'bike',      label: 'Bike',      icon: Bike,         seats: 1 },
];

const PICKUP_SUGGESTIONS = ['Chennai Central Railway Station', 'Anna Nagar Roundtana', 'T. Nagar Ranganathan St'];
const DROP_SUGGESTIONS   = ['Chennai Airport', 'Phoenix Market City, Velachery', 'Marina Beach Lighthouse'];

export default function BookRide() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setActiveTrip = useTripStore((s) => s.setActiveTrip);

  const [form, setForm] = useState({ pickup_location: '', destination: '', vehicle_type: 'sedan' });
  const [quote, setQuote] = useState(null);     // { estimated_km, availableDrivers, fares: { sedan: 227.8, ... } }
  const [estimating, setEstimating] = useState(false);
  const [error, setError] = useState('');

  const { data: dashboardData } = useQuery({
    queryKey: ['passengerDashboard'],
    queryFn: () => api.get('/passenger/dashboard').then((r) => r.data),
    refetchInterval: 8000,
  });
  const activeRide = dashboardData?.activeRide;

  const setField = (patch) => { setForm((f) => ({ ...f, ...patch })); setError(''); };
  const setAddress = (patch) => { setField(patch); setQuote(null); };

  const canQuote = form.pickup_location.trim() && form.destination.trim();

  const estimateFare = async () => {
    if (!canQuote) { setError('Enter both a pickup and a destination.'); return; }
    setEstimating(true);
    setError('');
    try {
      const { data } = await api.get('/rides/search', {
        params: { pickup: form.pickup_location.trim(), destination: form.destination.trim() },
      });
      const fares = {};
      (data.fareOptions || []).forEach((o) => { fares[o.vehicle_type] = o.estimated_fare; });
      setQuote({ estimated_km: data.estimated_km, availableDrivers: data.availableDrivers ?? 0, fares });
    } catch (err) {
      setError(errorMessage(err, 'Could not calculate the route. Check the addresses and try again.'));
    } finally {
      setEstimating(false);
    }
  };

  const bookMutation = useMutation({
    mutationFn: () => api.post('/rides/book', {
      pickup_location: form.pickup_location.trim(),
      destination: form.destination.trim(),
      vehicle_type: form.vehicle_type,
    }),
    onSuccess: (res) => {
      const d = res.data;
      setActiveTrip({
        request_id: d.request_id,
        pickup_location: d.pickup_location,
        destination: d.destination,
        vehicle_type: d.vehicle_type,
        estimated_fare: d.estimated_fare,
        status: d.status,
      });
      queryClient.invalidateQueries({ queryKey: ['passengerDashboard'] });
      navigate('/passenger/active-trip');
    },
    onError: (err) => {
      setError(errorMessage(err, 'Booking failed. Please try again.'));
      queryClient.invalidateQueries({ queryKey: ['passengerDashboard'] });
    },
  });

  const selectedFare = quote?.fares?.[form.vehicle_type];

  return (
    <AppShell title="Book a ride" subtitle="Get a quote, pick a vehicle and request a driver">
      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-4">
          {activeRide && (
            <Alert type="warning">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span>You already have an active ride (#{activeRide.request_id}). Finish or cancel it before booking another.</span>
                <Link to="/passenger/active-trip" className="btn-secondary btn-sm">Open active trip</Link>
              </div>
            </Alert>
          )}
          {error && <Alert type="error">{error}</Alert>}

          <div className="card p-6 space-y-6">
            <div>
              <label className="label flex items-center gap-2" htmlFor="pickup"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Pickup location</label>
              <div className="relative">
                <MapPin size={16} className="text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input id="pickup" name="pickup_location" type="text" value={form.pickup_location}
                  onChange={(e) => setAddress({ pickup_location: e.target.value })}
                  placeholder="Address, station or landmark" className="input-field pl-10" />
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {PICKUP_SUGGESTIONS.map((loc) => (
                  <button key={loc} type="button" onClick={() => setAddress({ pickup_location: loc })}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 border border-slate-200 transition-colors">
                    {loc.split(',')[0]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label flex items-center gap-2" htmlFor="destination"><span className="w-2 h-2 rounded-full bg-rose-500" /> Destination</label>
              <div className="relative">
                <Navigation size={16} className="text-rose-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input id="destination" name="destination" type="text" value={form.destination}
                  onChange={(e) => setAddress({ destination: e.target.value })}
                  placeholder="Where are you going?" className="input-field pl-10" />
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {DROP_SUGGESTIONS.map((loc) => (
                  <button key={loc} type="button" onClick={() => setAddress({ destination: loc })}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 border border-slate-200 transition-colors">
                    {loc.split(',')[0]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="label mb-0">Vehicle type</span>
                {quote && <span className="text-[11px] text-slate-500">{formatDistance(quote.estimated_km)} · {quote.availableDrivers} driver{quote.availableDrivers === 1 ? '' : 's'} online</span>}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {VEHICLE_TYPES.map(({ id, label, icon: Icon, seats }) => {
                  const selected = form.vehicle_type === id;
                  const fare = quote?.fares?.[id];
                  return (
                    <button key={id} type="button" onClick={() => setField({ vehicle_type: id })}
                      className={clsx(
                        'p-3 rounded-xl border text-left transition-colors',
                        selected ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20' : 'border-slate-200 bg-white hover:border-slate-300'
                      )}>
                      <Icon size={20} className={selected ? 'text-emerald-700' : 'text-slate-500'} />
                      <div className="text-sm font-semibold text-slate-900 mt-2">{label}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1"><Users size={11} /> {seats}</div>
                      {quote && (
                        <div className="text-xs font-semibold text-slate-900 mt-1.5">{fare != null ? formatCurrency(fare) : 'N/A'}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-slate-100">
              <button type="button" onClick={estimateFare} disabled={estimating || !canQuote} className="btn-secondary btn-lg flex-1">
                {estimating ? <Spinner size={16} /> : <Calculator size={16} />}
                {estimating ? 'Calculating…' : 'Get fare quote'}
              </button>
              <button type="button" onClick={() => bookMutation.mutate()}
                disabled={bookMutation.isPending || !!activeRide || !canQuote}
                className="btn-primary btn-lg flex-1">
                {bookMutation.isPending ? <Spinner size={16} /> : <Car size={16} />}
                {bookMutation.isPending ? 'Requesting…' : 'Request ride'}
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="card overflow-hidden">
            <div className="card-header">
              <div>
                <div className="card-title">Route preview</div>
                <div className="card-subtitle">{canQuote ? 'Pickup and destination' : 'Enter addresses to preview the route'}</div>
              </div>
            </div>
            <div className="h-64">
              {canQuote ? (
                <LeafletMap pickupCoords={form.pickup_location} dropCoords={form.destination} />
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 bg-slate-50">Map preview</div>
              )}
            </div>
          </div>

          <div className="card p-5">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Estimated fare</div>
            {quote ? (
              <>
                <div className="text-3xl font-semibold text-slate-900 mt-1.5">{selectedFare != null ? formatCurrency(selectedFare) : '—'}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {VEHICLE_TYPES.find((v) => v.id === form.vehicle_type)?.label} · {formatDistance(quote.estimated_km)} estimated road distance
                </div>
                <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
                  Final fare is confirmed by the server at booking time using the active fare rules.
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-500 mt-2">Get a quote to see fares for each vehicle type.</p>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
