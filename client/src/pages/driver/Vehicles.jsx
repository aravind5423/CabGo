import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../services/api';
import { Car, Plus, Pencil, Trash2, Power } from 'lucide-react';
import AppShell from '../../components/ui/AppShell';
import { EmptyState, SkeletonRows, StatusBadge, Toast, useToast, Spinner, Modal, IconChip, Alert } from '../../components/ui/UIKit';
import { capitalize } from '../../utils/format';

const VEHICLE_TYPES = ['sedan', 'suv', 'hatchback', 'auto', 'bike'];
const DEFAULT_CAPACITY = { sedan: 4, suv: 6, hatchback: 4, auto: 3, bike: 1 };
const EMPTY_FORM = { vehicle_number: '', model: '', vehicle_type: 'sedan', capacity: 4 };

export default function DriverVehicles() {
  const queryClient = useQueryClient();
  const [toast, showToast] = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['driverVehicles'],
    queryFn: () => api.get('/driver/vehicles').then((r) => r.data),
  });
  const vehicles = data?.vehicles || [];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['driverVehicles'] });
    queryClient.invalidateQueries({ queryKey: ['driverDashboard'] });
  };

  const saveMutation = useMutation({
    mutationFn: () => (editingId ? api.put(`/driver/vehicles/${editingId}`, form) : api.post('/driver/vehicles', form)),
    onSuccess: () => {
      showToast(editingId ? 'Vehicle updated.' : 'Vehicle added.');
      refresh();
      closeModal();
    },
    onError: (err) => setFormError(errorMessage(err, 'Could not save vehicle.')),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => api.put(`/driver/vehicles/${id}`, { status }),
    onSuccess: (_, { status }) => { showToast(status === 'active' ? 'Vehicle activated.' : 'Vehicle deactivated.'); refresh(); },
    onError: (err) => showToast(errorMessage(err), 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/driver/vehicles/${id}`),
    onSuccess: (res) => { showToast(res.data?.message || 'Vehicle removed.'); refresh(); },
    onError: (err) => showToast(errorMessage(err), 'error'),
  });

  const openAdd = () => { setEditingId(null); setForm(EMPTY_FORM); setFormError(''); setModalOpen(true); };
  const openEdit = (v) => {
    setEditingId(v.vehicle_id);
    setForm({ vehicle_number: v.vehicle_number || '', model: v.model || '', vehicle_type: v.vehicle_type || 'sedan', capacity: v.capacity || 4 });
    setFormError('');
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditingId(null); setForm(EMPTY_FORM); setFormError(''); };

  const onTypeChange = (type) => setForm((f) => ({ ...f, vehicle_type: type, capacity: DEFAULT_CAPACITY[type] || f.capacity }));

  const canSave = form.vehicle_number.trim() && form.model.trim() && Number(form.capacity) > 0;

  return (
    <AppShell
      title="Vehicles"
      subtitle="Vehicles registered to your driver account"
      action={<button onClick={openAdd} className="btn-primary"><Plus size={16} /> Add vehicle</button>}
    >
      <Toast toast={toast} />
      <div className="max-w-3xl mx-auto space-y-4">
        <Alert type="info">Ride requests are matched to the type of your <strong>active</strong> vehicle. Keep exactly one vehicle active at a time.</Alert>

        {isLoading ? (
          <div className="card"><SkeletonRows rows={2} /></div>
        ) : vehicles.length === 0 ? (
          <div className="card">
            <EmptyState icon={Car} title="No vehicles yet" description="Add the vehicle you drive to start receiving matching ride requests."
              action={<button onClick={openAdd} className="btn-primary btn-sm"><Plus size={14} /> Add vehicle</button>} />
          </div>
        ) : (
          <div className="space-y-3">
            {vehicles.map((v) => (
              <div key={v.vehicle_id} className="card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <IconChip icon={Car} tone={v.status === 'active' ? 'brand' : 'slate'} size="lg" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-semibold text-slate-900">{v.vehicle_number}</span>
                      <StatusBadge status={v.status || 'active'} />
                    </div>
                    <div className="text-xs text-slate-500 mt-1">{v.model} · {capitalize(v.vehicle_type)} · {v.capacity} seat{v.capacity === 1 ? '' : 's'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button onClick={() => statusMutation.mutate({ id: v.vehicle_id, status: v.status === 'active' ? 'inactive' : 'active' })}
                    disabled={statusMutation.isPending} className="btn-secondary btn-sm" title={v.status === 'active' ? 'Deactivate' : 'Activate'}>
                    <Power size={13} /> {v.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => openEdit(v)} className="btn-secondary btn-sm"><Pencil size={13} /> Edit</button>
                  <button
                    onClick={() => window.confirm(`Remove vehicle ${v.vehicle_number}?`) && deleteMutation.mutate(v.vehicle_id)}
                    disabled={deleteMutation.isPending} className="btn-danger-soft btn-sm" aria-label="Remove vehicle">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? 'Edit vehicle' : 'Add vehicle'}
        description={editingId ? 'Registration number cannot be changed.' : 'Register a vehicle to your account.'}
        footer={
          <>
            <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
            <button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !canSave} className="btn-primary">
              {saveMutation.isPending ? <Spinner size={14} /> : null}
              {editingId ? 'Save changes' : 'Add vehicle'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && <Alert type="error">{formError}</Alert>}
          <div>
            <label className="label" htmlFor="veh-number">Registration number</label>
            <input id="veh-number" type="text" value={form.vehicle_number} disabled={!!editingId}
              onChange={(e) => setForm({ ...form, vehicle_number: e.target.value.toUpperCase() })}
              placeholder="TN-09-AB-1234" className="input-field font-mono" />
          </div>
          <div>
            <label className="label" htmlFor="veh-model">Make and model</label>
            <input id="veh-model" type="text" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })}
              placeholder="e.g. Toyota Etios (White)" className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="veh-type">Type</label>
              <select id="veh-type" value={form.vehicle_type} onChange={(e) => onTypeChange(e.target.value)} className="input-field">
                {VEHICLE_TYPES.map((t) => <option key={t} value={t}>{capitalize(t)}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="veh-capacity">Seats</label>
              <input id="veh-capacity" type="number" min={1} max={8} value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: Math.max(1, parseInt(e.target.value, 10) || 1) })} className="input-field" />
            </div>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
