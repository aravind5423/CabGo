import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../services/api';
import { Users, Car, Wallet, Activity, CheckCircle2, XCircle, ShieldOff, ShieldCheck, Pencil, Search, LayoutDashboard, Sliders } from 'lucide-react';
import AppShell from '../../components/ui/AppShell';
import { KPICard, StatusBadge, EmptyState, SkeletonKPIs, SkeletonRows, Toast, useToast, Spinner, Tabs, Modal, Alert, IconChip } from '../../components/ui/UIKit';
import { formatCurrency, formatDate, capitalize, timeAgo, initials } from '../../utils/format';
import clsx from 'clsx';

const TABS = [
  { id: 'overview', label: 'Overview',   icon: LayoutDashboard },
  { id: 'drivers',  label: 'Drivers',    icon: Car },
  { id: 'fares',    label: 'Fare rules', icon: Sliders },
];

const DRIVER_FILTERS = [
  { id: '',         label: 'All' },
  { id: 'pending',  label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'blocked',  label: 'Blocked' },
];

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const [toast, showToast] = useToast();
  const [tab, setTab] = useState('overview');

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['adminStats'],
    queryFn: () => api.get('/admin/stats').then((r) => r.data),
    refetchInterval: 15000,
  });
  const stats = statsData?.stats || {};
  const recentTrips = statsData?.recent_trips || [];
  const recentLogs  = statsData?.recent_logs || [];

  return (
    <AppShell title="Operations" subtitle="Platform health, driver verification and fare configuration">
      <Toast toast={toast} />
      <div className="space-y-6">
        <Tabs tabs={TABS.map((t) => (t.id === 'drivers' && stats.drivers?.pending ? { ...t, count: stats.drivers.pending } : t))} value={tab} onChange={setTab} />

        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {statsLoading ? <SkeletonKPIs /> : (
                <>
                  <KPICard label="Total trips" value={stats.trips?.total ?? 0} icon={Activity} tone="blue" hint={`${stats.trips?.completed ?? 0} completed · ${stats.trips?.active ?? 0} in progress`} />
                  <KPICard label="Drivers online" value={`${stats.drivers?.online ?? 0} / ${stats.drivers?.total ?? 0}`} icon={Car} tone="brand" hint={`${stats.drivers?.pending ?? 0} pending verification`} />
                  <KPICard label="Passengers" value={stats.passengers?.total ?? 0} icon={Users} tone="amber" hint={`${stats.passengers?.new_7d ?? 0} new this week`} />
                  <KPICard label="Revenue" value={formatCurrency(stats.trips?.revenue ?? 0, { decimals: 0 })} icon={Wallet} tone="violet" hint="Completed trip fares" />
                </>
              )}
            </div>

            {stats.drivers?.pending > 0 && (
              <Alert type="warning">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span><strong>{stats.drivers.pending}</strong> driver application{stats.drivers.pending === 1 ? '' : 's'} awaiting verification.</span>
                  <button onClick={() => setTab('drivers')} className="btn-secondary btn-sm">Review drivers</button>
                </div>
              </Alert>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 card overflow-hidden">
                <div className="card-header"><div className="card-title">Recent trips</div></div>
                {statsLoading ? <SkeletonRows rows={4} /> : recentTrips.length === 0 ? (
                  <EmptyState icon={Activity} title="No trips yet" compact />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead><tr><th>Trip</th><th>Route</th><th>Passenger</th><th>Driver</th><th>Fare</th><th>Status</th></tr></thead>
                      <tbody>
                        {recentTrips.map((t) => (
                          <tr key={t.trip_id}>
                            <td><span className="font-mono text-xs font-semibold text-slate-700">#{t.trip_id}</span><div className="text-[11px] text-slate-400 mt-0.5">{formatDate(t.requested_at)}</div></td>
                            <td><div className="font-medium text-slate-900 max-w-[220px] truncate">{t.pickup} → {t.destination}</div><div className="text-[11px] text-slate-400 mt-0.5">{capitalize(t.vehicle_type)} · {t.vehicle_number}</div></td>
                            <td className="whitespace-nowrap">{t.passenger_name}</td>
                            <td className="whitespace-nowrap">{t.driver_name}</td>
                            <td className="font-semibold whitespace-nowrap">{formatCurrency(t.fare)}</td>
                            <td><StatusBadge status={t.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="card overflow-hidden">
                <div className="card-header"><div className="card-title">Recent activity</div></div>
                {statsLoading ? <SkeletonRows rows={5} /> : recentLogs.length === 0 ? (
                  <EmptyState icon={Activity} title="No activity" compact />
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {recentLogs.map((l) => (
                      <li key={l.log_id} className="px-5 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[11px] font-semibold text-emerald-700">{l.action}</span>
                          <span className="text-[11px] text-slate-400 whitespace-nowrap">{timeAgo(l.created_at)}</span>
                        </div>
                        <div className="text-xs text-slate-700 mt-0.5 line-clamp-2">{l.description}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{l.user}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'drivers' && <DriversPanel showToast={showToast} queryClient={queryClient} />}
        {tab === 'fares'   && <FaresPanel showToast={showToast} queryClient={queryClient} />}
      </div>
    </AppShell>
  );
}

/* ─── Drivers ───────────────────────────────────────────────────── */
function DriversPanel({ showToast, queryClient }) {
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['adminDrivers', filter, search],
    queryFn: () => api.get('/admin/drivers', { params: { verification: filter || undefined, search: search || undefined } }).then((r) => r.data),
  });
  const drivers = data?.drivers || [];
  const summary = data?.summary || {};

  const actionMutation = useMutation({
    mutationFn: ({ id, action }) => api.put(`/admin/drivers/${id}/${action}`),
    onSuccess: (res) => {
      showToast(res.data?.message || 'Driver updated.');
      queryClient.invalidateQueries({ queryKey: ['adminDrivers'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
    },
    onError: (err) => showToast(errorMessage(err), 'error'),
  });

  const busy = (id) => actionMutation.isPending && actionMutation.variables?.id === id;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total drivers" value={summary.total ?? 0} icon={Car} tone="blue" />
        <KPICard label="Pending" value={summary.pending ?? 0} icon={ShieldCheck} tone="amber" />
        <KPICard label="Online now" value={summary.online ?? 0} icon={Activity} tone="brand" />
        <KPICard label="Blocked" value={summary.blocked ?? 0} icon={ShieldOff} tone="rose" />
      </div>

      <div className="card overflow-hidden">
        <div className="card-header flex-col sm:flex-row items-stretch sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, licence" className="input-field pl-9 py-2 text-[13px]" />
          </div>
          <Tabs tabs={DRIVER_FILTERS} value={filter} onChange={setFilter} />
        </div>

        {isLoading ? <SkeletonRows rows={5} /> : drivers.length === 0 ? (
          <EmptyState icon={Car} title="No drivers match" description="Try another filter or search term." />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Driver</th><th>Licence</th><th>Vehicle</th><th>Trips</th><th>Rating</th><th>Verification</th><th>Account</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {drivers.map((d) => (
                  <tr key={d.driver_id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-900 text-white text-xs font-semibold flex items-center justify-center flex-shrink-0">{initials(d.name)}</div>
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 truncate">{d.name}</div>
                          <div className="text-[11px] text-slate-400 truncate">{d.email} · {d.mobile}</div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap"><div className="font-mono text-xs text-slate-700">{d.license_no}</div><div className="text-[11px] text-slate-400">exp. {formatDate(d.license_expiry, { withTime: false })}</div></td>
                    <td className="whitespace-nowrap">{d.vehicle ? <><div className="font-mono text-xs text-slate-700">{d.vehicle.vehicle_number}</div><div className="text-[11px] text-slate-400">{capitalize(d.vehicle.vehicle_type)}</div></> : <span className="text-slate-400">—</span>}</td>
                    <td className="whitespace-nowrap"><div className="font-semibold">{d.completed_trips}</div><div className="text-[11px] text-slate-400">{formatCurrency(d.total_earnings, { decimals: 0 })}</div></td>
                    <td>{Number(d.rating || 0).toFixed(2)}</td>
                    <td><StatusBadge status={d.verification_status} /></td>
                    <td><StatusBadge status={d.account_status} /></td>
                    <td>
                      <div className="flex items-center justify-end gap-1.5">
                        {d.verification_status !== 'approved' && (
                          <button onClick={() => actionMutation.mutate({ id: d.driver_id, action: 'approve' })} disabled={busy(d.driver_id)} className="btn-primary btn-sm">
                            {busy(d.driver_id) ? <Spinner size={12} /> : <CheckCircle2 size={13} />} Approve
                          </button>
                        )}
                        {d.verification_status === 'pending' && (
                          <button onClick={() => actionMutation.mutate({ id: d.driver_id, action: 'reject' })} disabled={busy(d.driver_id)} className="btn-secondary btn-sm">
                            <XCircle size={13} /> Reject
                          </button>
                        )}
                        {d.account_status === 'blocked' ? (
                          <button onClick={() => actionMutation.mutate({ id: d.driver_id, action: 'unblock' })} disabled={busy(d.driver_id)} className="btn-secondary btn-sm"><ShieldCheck size={13} /> Unblock</button>
                        ) : (
                          <button onClick={() => window.confirm(`Block ${d.name}? They will not be able to sign in.`) && actionMutation.mutate({ id: d.driver_id, action: 'block' })}
                            disabled={busy(d.driver_id)} className="btn-danger-soft btn-sm"><ShieldOff size={13} /> Block</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Fare rules ────────────────────────────────────────────────── */
function FaresPanel({ showToast, queryClient }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [formError, setFormError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['fareRules'],
    queryFn: () => api.get('/admin/fare-rules').then((r) => r.data),
  });
  const rules = data?.rules || [];

  const saveMutation = useMutation({
    mutationFn: () => api.put(`/admin/fare-rules/${editing.fare_id}`, {
      base_fare: Number(form.base_fare),
      per_km_rate: Number(form.per_km_rate),
      per_minute_rate: Number(form.per_minute_rate),
      cancellation_fee: Number(form.cancellation_fee),
      status: form.status,
    }),
    onSuccess: () => { showToast('Fare rule updated.'); setEditing(null); queryClient.invalidateQueries({ queryKey: ['fareRules'] }); },
    onError: (err) => setFormError(errorMessage(err, 'Could not save fare rule.')),
  });

  const openEdit = (r) => {
    setEditing(r);
    setForm({ base_fare: r.base_fare, per_km_rate: r.per_km_rate, per_minute_rate: r.per_minute_rate, cancellation_fee: r.cancellation_fee, status: r.status || 'active' });
    setFormError('');
  };

  const NUMBER_FIELDS = [
    { key: 'base_fare',        label: 'Base fare (₹)' },
    { key: 'per_km_rate',      label: 'Per km (₹)' },
    { key: 'per_minute_rate',  label: 'Per minute (₹)' },
    { key: 'cancellation_fee', label: 'Cancellation fee (₹)' },
  ];

  return (
    <div className="card overflow-hidden">
      <div className="card-header">
        <div>
          <div className="card-title">Fare rules by vehicle type</div>
          <div className="card-subtitle">Used to quote fares: base fare + distance × per-km rate</div>
        </div>
      </div>
      {isLoading ? <SkeletonRows rows={5} /> : rules.length === 0 ? (
        <EmptyState icon={Sliders} title="No fare rules" description="Fare rules are seeded with the database." />
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Vehicle type</th><th>Base fare</th><th>Per km</th><th>Per minute</th><th>Cancellation fee</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.fare_id}>
                  <td><div className="flex items-center gap-2.5"><IconChip icon={Car} tone="slate" size="sm" /><span className="font-semibold text-slate-900">{capitalize(r.vehicle_type)}</span></div></td>
                  <td className="font-mono">{formatCurrency(r.base_fare)}</td>
                  <td className="font-mono">{formatCurrency(r.per_km_rate)}</td>
                  <td className="font-mono">{formatCurrency(r.per_minute_rate)}</td>
                  <td className="font-mono">{formatCurrency(r.cancellation_fee)}</td>
                  <td><StatusBadge status={r.status || 'active'} /></td>
                  <td><div className="flex justify-end"><button onClick={() => openEdit(r)} className="btn-secondary btn-sm"><Pencil size={13} /> Edit</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`Edit ${capitalize(editing?.vehicle_type)} fare rule`}
        description="Changes apply to new fare quotes immediately."
        footer={
          <>
            <button type="button" onClick={() => setEditing(null)} className="btn-secondary">Cancel</button>
            <button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="btn-primary">
              {saveMutation.isPending ? <Spinner size={14} /> : null} Save
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && <Alert type="error">{formError}</Alert>}
          <div className="grid grid-cols-2 gap-3">
            {NUMBER_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <label className="label" htmlFor={`fare-${key}`}>{label}</label>
                <input id={`fare-${key}`} type="number" min={0} step="0.5" value={form[key] ?? ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="input-field" />
              </div>
            ))}
          </div>
          <div>
            <span className="label">Status</span>
            <div className="tabs">
              {['active', 'inactive'].map((s) => (
                <button key={s} type="button" onClick={() => setForm({ ...form, status: s })} className={clsx('tab', form.status === s && 'active')}>{capitalize(s)}</button>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
