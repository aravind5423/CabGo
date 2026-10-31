import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { api, errorMessage } from '../../services/api';
import { Settings, ShieldCheck, FileText, Users, Car, Activity, Wallet, Search, Plus, UserCheck, UserX, LayoutDashboard, Save } from 'lucide-react';
import AppShell from '../../components/ui/AppShell';
import { KPICard, EmptyState, SkeletonKPIs, SkeletonRows, StatusBadge, Toast, useToast, Spinner, Tabs, Modal, Alert, Skeleton } from '../../components/ui/UIKit';
import { formatCurrency, formatDate, capitalize, initials, timeAgo } from '../../utils/format';
import clsx from 'clsx';

const TABS = [
  { id: 'overview', label: 'Overview',  icon: LayoutDashboard },
  { id: 'settings', label: 'Settings',  icon: Settings },
  { id: 'admins',   label: 'Admins',    icon: ShieldCheck },
  { id: 'logs',     label: 'Audit log', icon: FileText },
];

export default function SuperadminDashboard() {
  const queryClient = useQueryClient();
  const [toast, showToast] = useToast();
  const [tab, setTab] = useState('overview');

  return (
    <AppShell title="Control panel" subtitle="Platform settings, admin accounts and audit trail">
      <Toast toast={toast} />
      <div className="space-y-6">
        <Tabs tabs={TABS} value={tab} onChange={setTab} />
        {tab === 'overview' && <OverviewPanel />}
        {tab === 'settings' && <SettingsPanel showToast={showToast} queryClient={queryClient} />}
        {tab === 'admins'   && <AdminsPanel showToast={showToast} queryClient={queryClient} />}
        {tab === 'logs'     && <LogsPanel />}
      </div>
    </AppShell>
  );
}

/* ─── Overview ─────────────────────────────────────────────────── */
function OverviewPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['superadminOverview'],
    queryFn: () => api.get('/superadmin/overview').then((r) => r.data),
    refetchInterval: 20000,
  });
  const s = data?.stats || {};
  const admins = data?.admins || [];
  const logs = data?.recent_logs || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? <SkeletonKPIs /> : (
          <>
            <KPICard label="Users" value={s.users?.total ?? 0} icon={Users} tone="blue" hint={`${s.users?.passengers ?? 0} passengers · ${s.users?.drivers ?? 0} drivers`} />
            <KPICard label="Fleet" value={s.fleet?.total ?? 0} icon={Car} tone="brand" hint={`${s.fleet?.active ?? 0} active vehicles · ${s.drivers?.online ?? 0} drivers online`} />
            <KPICard label="Trips" value={s.trips?.total ?? 0} icon={Activity} tone="amber" hint={`${s.trips?.completed ?? 0} completed · ${s.trips?.cancelled ?? 0} cancelled`} />
            <KPICard label="Revenue" value={formatCurrency(s.trips?.revenue ?? 0, { decimals: 0 })} icon={Wallet} tone="violet" hint={`${s.audit?.logs_today ?? 0} audit events today`} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card overflow-hidden">
          <div className="card-header"><div className="card-title">Administrators</div><span className="text-xs text-slate-500">{admins.length} accounts</span></div>
          {isLoading ? <SkeletonRows rows={3} /> : (
            <ul className="divide-y divide-slate-100">
              {admins.map((a) => (
                <li key={a.user_id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-900 text-white text-xs font-semibold flex items-center justify-center flex-shrink-0">{initials(a.name)}</div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-slate-900 truncate">{a.name}</div>
                      <div className="text-[11px] text-slate-400 truncate">{a.email} · {a.permissions_count} permission{a.permissions_count === 1 ? '' : 's'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2"><span className="badge badge-neutral">{capitalize(a.role)}</span><StatusBadge status={a.status} /></div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="card-header"><div className="card-title">Recent audit events</div></div>
          {isLoading ? <SkeletonRows rows={5} /> : logs.length === 0 ? <EmptyState icon={FileText} title="No events" compact /> : (
            <ul className="divide-y divide-slate-100">
              {logs.map((l) => (
                <li key={l.log_id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold text-emerald-700">{l.action}</span>
                    <span className="text-[11px] text-slate-400 whitespace-nowrap">{timeAgo(l.created_at)}</span>
                  </div>
                  <div className="text-xs text-slate-700 mt-0.5 line-clamp-2">{l.description}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{l.user_name} ({l.user_role})</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Settings ─────────────────────────────────────────────────── */
const SETTINGS_FIELDS = [
  { key: 'platform_name',        label: 'Platform name',             type: 'text' },
  { key: 'operating_city',       label: 'Operating city',            type: 'text' },
  { key: 'support_email',        label: 'Support email',             type: 'email' },
  { key: 'support_phone',        label: 'Support phone',             type: 'text' },
  { key: 'driver_commission_pct',label: 'Platform commission (%)',   type: 'number', min: 0, max: 60, step: 0.5, hint: 'Deducted from gross fares' },
  { key: 'tax_pct',              label: 'Tax (%)',                   type: 'number', min: 0, max: 30, step: 0.5 },
  { key: 'max_cancellations',    label: 'Max cancellations per day', type: 'number', min: 1, max: 20, step: 1 },
  { key: 'booking_timeout_sec',  label: 'Booking timeout (seconds)', type: 'number', min: 15, max: 300, step: 5 },
];

function SettingsPanel({ showToast, queryClient }) {
  const { data, isLoading } = useQuery({
    queryKey: ['superadminSettings'],
    queryFn: () => api.get('/superadmin/settings').then((r) => r.data),
  });
  const settings = data?.settings;
  const [form, setForm] = useState(null);

  useEffect(() => { if (settings) setForm({ ...settings }); }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () => api.put('/superadmin/settings', {
      platform_name: form.platform_name,
      operating_city: form.operating_city,
      support_email: form.support_email,
      support_phone: form.support_phone,
      driver_commission_pct: Number(form.driver_commission_pct),
      tax_pct: Number(form.tax_pct),
      max_cancellations: Number(form.max_cancellations),
      booking_timeout_sec: Number(form.booking_timeout_sec),
      maintenance_mode: Boolean(form.maintenance_mode),
    }),
    onSuccess: () => { showToast('Settings saved.'); queryClient.invalidateQueries({ queryKey: ['superadminSettings'] }); },
    onError: (err) => showToast(errorMessage(err, 'Failed to save settings.'), 'error'),
  });

  if (isLoading || !form) {
    return <div className="card p-6 max-w-2xl space-y-4">{[1, 2, 3, 4].map((i) => <div key={i} className="space-y-2"><Skeleton className="h-3 w-32" /><Skeleton className="h-10 w-full" /></div>)}</div>;
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="card p-6 sm:p-8 max-w-2xl space-y-6">
      <div>
        <h3 className="text-base font-semibold text-slate-900">Platform settings</h3>
        <p className="text-xs text-slate-500 mt-0.5">Applied immediately across the platform.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {SETTINGS_FIELDS.map(({ key, label, type, min, max, step, hint }) => (
          <div key={key}>
            <label className="label" htmlFor={`set-${key}`}>{label}</label>
            <input id={`set-${key}`} type={type} min={min} max={max} step={step} value={form[key] ?? ''} required
              onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="input-field" />
            {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50">
        <div>
          <div className="text-sm font-semibold text-slate-900">Maintenance mode</div>
          <div className="text-xs text-slate-500 mt-0.5">Flag the platform as under maintenance.</div>
        </div>
        <button type="button" role="switch" aria-checked={!!form.maintenance_mode}
          onClick={() => setForm({ ...form, maintenance_mode: !form.maintenance_mode })}
          className={clsx('relative w-11 h-6 rounded-full transition-colors flex-shrink-0', form.maintenance_mode ? 'bg-rose-600' : 'bg-slate-300')}>
          <span className={clsx('absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform', form.maintenance_mode && 'translate-x-5')} />
        </button>
      </div>

      <div className="flex justify-end pt-2 border-t border-slate-100">
        <button type="submit" disabled={saveMutation.isPending} className="btn-primary">
          {saveMutation.isPending ? <Spinner size={15} /> : <Save size={15} />} Save settings
        </button>
      </div>
    </form>
  );
}

/* ─── Admins ───────────────────────────────────────────────────── */
const EMPTY_ADMIN = { name: '', email: '', mobile: '', password: '', permissions: [] };

function AdminsPanel({ showToast, queryClient }) {
  const me = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_ADMIN);
  const [formError, setFormError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['superadminAdmins'],
    queryFn: () => api.get('/superadmin/admins').then((r) => r.data),
  });
  const admins = data?.admins || [];
  const availablePermissions = data?.available_permissions || [];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['superadminAdmins'] });
    queryClient.invalidateQueries({ queryKey: ['superadminOverview'] });
  };

  const createMutation = useMutation({
    mutationFn: () => api.post('/superadmin/admins', form),
    onSuccess: () => { showToast('Admin account created.'); setOpen(false); setForm(EMPTY_ADMIN); refresh(); },
    onError: (err) => setFormError(errorMessage(err, 'Could not create admin.')),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, action }) => api.put(`/superadmin/admins/${id}/${action}`),
    onSuccess: (res) => { showToast(res.data?.message || 'Updated.'); refresh(); },
    onError: (err) => showToast(errorMessage(err), 'error'),
  });

  const togglePerm = (p) => setForm((f) => ({ ...f, permissions: f.permissions.includes(p) ? f.permissions.filter((x) => x !== p) : [...f.permissions, p] }));

  return (
    <div className="card overflow-hidden">
      <div className="card-header">
        <div><div className="card-title">Administrator accounts</div><div className="card-subtitle">Operations admins and their permissions</div></div>
        <button onClick={() => { setForm(EMPTY_ADMIN); setFormError(''); setOpen(true); }} className="btn-primary btn-sm"><Plus size={14} /> New admin</button>
      </div>
      {isLoading ? <SkeletonRows rows={3} /> : admins.length === 0 ? <EmptyState icon={ShieldCheck} title="No admin accounts" /> : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Administrator</th><th>Role</th><th>Permissions</th><th>Created</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {admins.map((a) => {
                const isSelf = a.user_id === me?.user_id;
                return (
                  <tr key={a.user_id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-900 text-white text-xs font-semibold flex items-center justify-center flex-shrink-0">{initials(a.name)}</div>
                        <div className="min-w-0"><div className="font-medium text-slate-900 truncate">{a.name}{isSelf && <span className="text-slate-400 font-normal"> (you)</span>}</div><div className="text-[11px] text-slate-400 truncate">{a.email}</div></div>
                      </div>
                    </td>
                    <td><span className="badge badge-neutral">{capitalize(a.role)}</span></td>
                    <td>
                      {a.role === 'superadmin' ? <span className="text-xs text-slate-500">All permissions</span> : a.permissions.length === 0 ? <span className="text-xs text-slate-400">None</span> : (
                        <div className="flex flex-wrap gap-1 max-w-xs">{a.permissions.map((p) => <span key={p} className="badge badge-neutral text-[10px]">{p.replace(/_/g, ' ')}</span>)}</div>
                      )}
                    </td>
                    <td className="text-slate-600 whitespace-nowrap">{formatDate(a.created_at, { withTime: false })}</td>
                    <td><StatusBadge status={a.status} /></td>
                    <td>
                      <div className="flex justify-end">
                        {!isSelf && a.role !== 'superadmin' && (
                          a.status === 'active' ? (
                            <button onClick={() => statusMutation.mutate({ id: a.user_id, action: 'deactivate' })} disabled={statusMutation.isPending} className="btn-danger-soft btn-sm"><UserX size={13} /> Deactivate</button>
                          ) : (
                            <button onClick={() => statusMutation.mutate({ id: a.user_id, action: 'activate' })} disabled={statusMutation.isPending} className="btn-secondary btn-sm"><UserCheck size={13} /> Activate</button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Create admin account"
        description="The new admin can sign in immediately with this password."
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
            <button type="button" onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !form.name || !form.email || !form.mobile || form.password.length < 6} className="btn-primary">
              {createMutation.isPending ? <Spinner size={14} /> : <Plus size={14} />} Create
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && <Alert type="error">{formError}</Alert>}
          <div><label className="label" htmlFor="adm-name">Full name</label><input id="adm-name" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor="adm-email">Email</label><input id="adm-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" /></div>
            <div><label className="label" htmlFor="adm-mobile">Mobile</label><input id="adm-mobile" type="tel" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="9876543210" className="input-field" /></div>
          </div>
          <div><label className="label" htmlFor="adm-password">Temporary password</label><input id="adm-password" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 6 characters" className="input-field" /></div>
          <div>
            <span className="label">Permissions</span>
            <div className="flex flex-wrap gap-2">
              {availablePermissions.map((p) => (
                <button key={p} type="button" onClick={() => togglePerm(p)}
                  className={clsx('badge cursor-pointer', form.permissions.includes(p) ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'badge-neutral')}>
                  {p.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ─── Audit log ────────────────────────────────────────────────── */
function LogsPanel() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['superadminLogs', search, page],
    queryFn: () => api.get('/superadmin/logs', { params: { action: search || undefined, page, limit: 50 } }).then((r) => r.data),
    placeholderData: (prev) => prev,
  });
  const logs = data?.logs || [];
  const pagination = data?.pagination || { page: 1, total_pages: 1, total: 0 };

  return (
    <div className="card overflow-hidden">
      <div className="card-header flex-col sm:flex-row items-stretch sm:items-center">
        <div><div className="card-title">Audit log</div><div className="card-subtitle">{pagination.total} events recorded</div></div>
        <div className="relative w-full sm:w-72">
          <Search size={15} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Filter by action or description" className="input-field pl-9 py-2 text-[13px]" />
        </div>
      </div>

      {isLoading ? <SkeletonRows rows={6} /> : logs.length === 0 ? <EmptyState icon={FileText} title="No matching events" /> : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Action</th><th>Description</th><th>User</th><th>IP</th><th>Time</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.log_id}>
                  <td><span className="font-mono text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 whitespace-nowrap">{l.action}</span></td>
                  <td className="text-slate-800 max-w-md">{l.description}</td>
                  <td className="whitespace-nowrap"><div className="text-slate-800">{l.user_name}</div><div className="text-[11px] text-slate-400">{capitalize(l.user_role)}</div></td>
                  <td className="font-mono text-xs text-slate-500 whitespace-nowrap">{l.ip_address || '—'}</td>
                  <td className="text-slate-500 whitespace-nowrap">{formatDate(l.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination.total_pages > 1 && (
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Page {pagination.page} of {pagination.total_pages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn-secondary btn-sm">Previous</button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.total_pages} className="btn-secondary btn-sm">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
