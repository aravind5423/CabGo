import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../services/api';
import { Car, Wallet, CheckCircle2, XCircle, Search, Star, Plus } from 'lucide-react';
import AppShell from '../../components/ui/AppShell';
import { KPICard, StatusBadge, EmptyState, SkeletonKPIs, SkeletonRows, Modal, Toast, useToast, Spinner, Alert } from '../../components/ui/UIKit';
import { formatCurrency, formatDate, capitalize } from '../../utils/format';
import clsx from 'clsx';

const EMPTY_HISTORY = [];

const STATUS_FILTERS = [
  { id: '',          label: 'All' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'pending',   label: 'Pending' },
  { id: 'accepted',  label: 'Accepted' },
];

export default function PassengerHistory() {
  const queryClient = useQueryClient();
  const [toast, showToast] = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [rateTarget, setRateTarget] = useState(null); // trip row being rated
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [rateError, setRateError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['rideHistory'],
    queryFn: () => api.get('/rides/history').then((r) => r.data),
  });
  const history = data?.history ?? EMPTY_HISTORY;

  const summary = useMemo(() => {
    const completed = history.filter((h) => h.request_status === 'completed');
    return {
      total: history.length,
      completed: completed.length,
      cancelled: history.filter((h) => h.request_status === 'cancelled').length,
      spent: completed.reduce((acc, h) => acc + Number(h.final_fare ?? h.estimated_fare ?? 0), 0),
    };
  }, [history]);

  const rows = history.filter((h) => {
    if (statusFilter && h.request_status !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [h.pickup_location, h.destination, h.driver_name, h.vehicle_number, String(h.request_id)]
      .some((v) => (v || '').toString().toLowerCase().includes(q));
  });

  const rateMutation = useMutation({
    mutationFn: () => api.post('/ratings', { trip_id: rateTarget.trip_id, rating: Number(rating), comment: comment.trim() || undefined }),
    onSuccess: () => {
      showToast('Rating submitted. Thank you!');
      setRateTarget(null); setComment(''); setRating(5);
      queryClient.invalidateQueries({ queryKey: ['rideHistory'] });
    },
    onError: (err) => setRateError(errorMessage(err, 'Could not submit rating.')),
  });

  const openRate = (row) => { setRateTarget(row); setRating(5); setComment(''); setRateError(''); };

  return (
    <AppShell
      title="Trip history"
      subtitle="All your bookings, receipts and ratings"
      action={<Link to="/passenger/book-ride" className="btn-primary"><Plus size={16} /> Book a ride</Link>}
    >
      <Toast toast={toast} />
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading ? <SkeletonKPIs /> : (
            <>
              <KPICard label="Total bookings" value={summary.total} icon={Car} tone="blue" />
              <KPICard label="Completed" value={summary.completed} icon={CheckCircle2} tone="brand" />
              <KPICard label="Cancelled" value={summary.cancelled} icon={XCircle} tone="rose" />
              <KPICard label="Total spent" value={formatCurrency(summary.spent)} icon={Wallet} tone="amber" />
            </>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="card-header flex-col sm:flex-row items-stretch sm:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search size={15} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search route, driver or booking #" className="input-field pl-9 py-2 text-[13px]" />
            </div>
            <div className="tabs">
              {STATUS_FILTERS.map((f) => (
                <button key={f.id} type="button" onClick={() => setStatusFilter(f.id)} className={clsx('tab', statusFilter === f.id && 'active')}>{f.label}</button>
              ))}
            </div>
          </div>

          {isLoading ? <SkeletonRows rows={5} /> : rows.length === 0 ? (
            <EmptyState icon={Car} title="No trips found" description={history.length ? 'Try a different search or filter.' : 'Book your first ride to see it here.'} />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Booking</th><th>Route</th><th>Driver</th><th>Vehicle</th><th>Fare</th><th>Payment</th><th>Status</th><th>Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((h) => {
                    const fare = h.final_fare ?? h.estimated_fare;
                    const canRate = h.trip_status === 'completed' && h.trip_id && h.rating == null;
                    return (
                      <tr key={h.request_id}>
                        <td className="whitespace-nowrap">
                          <div className="font-mono text-xs font-semibold text-slate-700">#{h.request_id}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{formatDate(h.requested_at)}</div>
                        </td>
                        <td><div className="font-medium text-slate-900 max-w-[240px] truncate">{h.pickup_location} → {h.destination}</div></td>
                        <td className="text-slate-700 whitespace-nowrap">{h.driver_name || <span className="text-slate-400">—</span>}</td>
                        <td>
                          <span className="badge badge-neutral">{capitalize(h.vehicle_type)}</span>
                          {h.vehicle_number && <div className="font-mono text-[11px] text-slate-400 mt-1">{h.vehicle_number}</div>}
                        </td>
                        <td className="font-semibold text-slate-900 whitespace-nowrap">{formatCurrency(fare)}</td>
                        <td className="whitespace-nowrap">
                          {h.payment_status ? (
                            <div className="text-xs"><StatusBadge status={h.payment_status} /><div className="text-slate-400 mt-1 capitalize">{h.payment_method}</div></div>
                          ) : <span className="text-slate-400">—</span>}
                        </td>
                        <td><StatusBadge status={h.request_status} /></td>
                        <td className="whitespace-nowrap">
                          {h.rating != null ? (
                            <span className="flex items-center gap-1 text-xs font-semibold text-amber-600"><Star size={13} className="fill-amber-400 text-amber-400" /> {h.rating}/5</span>
                          ) : canRate ? (
                            <button onClick={() => openRate(h)} className="btn-secondary btn-sm"><Star size={13} /> Rate</button>
                          ) : <span className="text-slate-400">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={!!rateTarget}
        onClose={() => setRateTarget(null)}
        title="Rate your trip"
        description={rateTarget ? `${rateTarget.pickup_location} → ${rateTarget.destination} · ${rateTarget.driver_name || 'Driver'}` : ''}
        footer={
          <>
            <button type="button" onClick={() => setRateTarget(null)} className="btn-secondary">Cancel</button>
            <button type="button" onClick={() => rateMutation.mutate()} disabled={rateMutation.isPending} className="btn-primary">
              {rateMutation.isPending ? <Spinner size={14} /> : <Star size={14} />} Submit
            </button>
          </>
        }
      >
        {rateError && <Alert type="error" className="mb-4">{rateError}</Alert>}
        <div className="flex items-center justify-center gap-2 mb-4">
          {[1, 2, 3, 4, 5].map((star) => (
            <button key={star} type="button" onClick={() => setRating(star)} aria-label={`${star} stars`} className="p-1 hover:scale-110 transition-transform">
              <Star size={28} className={clsx(star <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300')} />
            </button>
          ))}
        </div>
        <input type="text" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} placeholder="Add a comment (optional)" className="input-field" />
      </Modal>
    </AppShell>
  );
}
