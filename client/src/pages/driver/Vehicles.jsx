import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Car, Plus, Edit2, Trash2, Loader2, AlertCircle, CheckCircle, X } from 'lucide-react';
import AppShell from '../../components/ui/AppShell';
import { EmptyState, Skeleton, StatusBadge, Toast } from '../../components/ui/UIKit';
import clsx from 'clsx';

const VEHICLE_TYPES = ['sedan', 'suv', 'hatchback', 'auto'];
const EMPTY_FORM = { vehicle_number: '', model: '', vehicle_type: 'sedan', capacity: 4 };

export default function DriverVehicles() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [toastMsg, setToastMsg] = useState('');
  const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3500); };

  const { data, isLoading } = useQuery({
    queryKey: ['driverVehicles'],
    queryFn: () => api.get('/driver/vehicles').then((r) => r.data),
  });
  const vehicles = data?.vehicles || data?.data || [];

  const saveMutation = useMutation({
    mutationFn: () =>
      editingId
        ? api.put(`/driver/vehicles/${editingId}`, form)
        : api.post('/driver/vehicles', form),
    onSuccess: () => {
      showToast(editingId ? 'Vehicle updated successfully.' : 'Vehicle registered successfully.');
      queryClient.invalidateQueries({ queryKey: ['driverVehicles'] });
      setShowModal(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    },
    onError: (err) => showToast(err.response?.data?.message || 'Save failed.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/driver/vehicles/${id}`),
    onSuccess: () => {
      showToast('Vehicle removed.');
      queryClient.invalidateQueries({ queryKey: ['driverVehicles'] });
    },
    onError: (err) => showToast(err.response?.data?.message || 'Delete failed.'),
  });

  const startEdit = (v) => {
    setEditingId(v.vehicle_id);
    setForm({
      vehicle_number: v.vehicle_number || '',
      model: v.model || '',
      vehicle_type: v.vehicle_type || 'sedan',
      capacity: v.capacity || 4,
    });
    setShowModal(true);
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  return (
    <AppShell
      title="My Vehicles"
      subtitle="Manage your registered fleet"
      action={
        <button onClick={openAdd} className="btn-primary text-sm">
          <Plus size={15} /> Add Vehicle
        </button>
      }
    >
      <Toast message={toastMsg} />

      <div className="max-w-2xl mx-auto space-y-4 animate-fade-in">

        {/* Vehicle Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
            <div className="card w-full max-w-md p-6 animate-fade-in">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-ink">
                  {editingId ? 'Edit Vehicle' : 'Register Vehicle'}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1.5 rounded-lg text-ink-muted hover:bg-canvas transition"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1.5">Vehicle Number</label>
                  <input
                    type="text"
                    value={form.vehicle_number}
                    onChange={(e) => setForm({ ...form, vehicle_number: e.target.value.toUpperCase() })}
                    placeholder="e.g. TN01AB1234"
                    className="input-field font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1.5">Model</label>
                  <input
                    type="text"
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    placeholder="e.g. Hyundai i20"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-2">Vehicle Type</label>
                  <div className="grid grid-cols-4 gap-2">
                    {VEHICLE_TYPES.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setForm({ ...form, vehicle_type: type })}
                        className={clsx(
                          'py-2.5 rounded-xl text-xs font-semibold border transition capitalize',
                          form.vehicle_type === type
                            ? 'bg-brand-light border-brand/30 text-brand'
                            : 'bg-white border-line text-ink-muted hover:border-line-2'
                        )}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1.5">Passenger Capacity</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || !form.vehicle_number || !form.model}
                  className="btn-primary flex-1"
                >
                  {saveMutation.isPending && <Loader2 size={15} className="animate-spin" />}
                  {editingId ? 'Save Changes' : 'Register Vehicle'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Vehicles List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="card-sm p-5 flex items-center gap-4">
                <Skeleton className="w-14 h-14 rounded-2xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))}
          </div>
        ) : vehicles.length === 0 ? (
          <div className="card p-10">
            <EmptyState
              icon={Car}
              title="No Vehicles Registered"
              description="Add your vehicle details to start accepting passenger rides."
              action={
                <button onClick={openAdd} className="btn-primary">
                  <Plus size={15} /> Add Vehicle
                </button>
              }
            />
          </div>
        ) : (
          <div className="space-y-3">
            {vehicles.map((v) => (
              <div
                key={v.vehicle_id}
                className="card-sm p-5 flex items-center gap-4 hover:border-brand/20 transition"
              >
                <div className="w-14 h-14 rounded-2xl bg-brand-light flex items-center justify-center text-2xl flex-shrink-0">
                  🚗
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-ink tracking-wider font-mono uppercase text-base">
                      {v.vehicle_number}
                    </span>
                    <StatusBadge status={v.status || 'active'} />
                  </div>
                  <div className="text-sm text-ink-muted capitalize">
                    {v.model} · {v.vehicle_type} · {v.capacity || 4} seats
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => startEdit(v)}
                    className="btn-secondary p-2.5"
                    title="Edit"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(v.vehicle_id)}
                    disabled={deleteMutation.isPending}
                    className="btn-danger p-2.5"
                    title="Remove"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
