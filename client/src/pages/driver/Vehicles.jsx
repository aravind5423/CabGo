import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Car, Plus, Edit2, Trash2, Loader2, AlertCircle, CheckCircle2, X, ShieldCheck } from 'lucide-react';
import AppShell from '../../components/ui/AppShell';
import { EmptyState, Skeleton, StatusBadge, Toast, Spinner } from '../../components/ui/UIKit';
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
      showToast(editingId ? 'Vehicle specifications updated.' : 'New vehicle registered to fleet.');
      queryClient.invalidateQueries({ queryKey: ['driverVehicles'] });
      setShowModal(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    },
    onError: (err) => showToast(err.response?.data?.message || 'Save operation failed.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/driver/vehicles/${id}`),
    onSuccess: () => {
      showToast('Vehicle removed from driver profile.');
      queryClient.invalidateQueries({ queryKey: ['driverVehicles'] });
    },
    onError: (err) => showToast(err.response?.data?.message || 'Delete operation failed.'),
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
      title="Fleet Management"
      subtitle="Register and configure vehicles assigned to your partner account"
      action={
        <button onClick={openAdd} className="btn-primary text-sm shadow-md shadow-emerald-500/20">
          <Plus size={16} /> Register Vehicle
        </button>
      }
    >
      <Toast message={toastMsg} />

      <div className="max-w-3xl mx-auto space-y-6">

        {/* Modal Dialog */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="card w-full max-w-md p-6 sm:p-7 shadow-2xl relative border-slate-200">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <h3 className="text-base font-bold text-slate-900">
                  {editingId ? 'Edit Vehicle Specifications' : 'Register Fleet Vehicle'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Registration Plate Number
                  </label>
                  <input
                    type="text"
                    value={form.vehicle_number}
                    onChange={(e) => setForm({ ...form, vehicle_number: e.target.value.toUpperCase() })}
                    placeholder="TN-09-AB-1234"
                    disabled={!!editingId}
                    className="input-field font-mono font-bold tracking-wider"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Model & Make
                  </label>
                  <input
                    type="text"
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    placeholder="e.g. Toyota Etios (White)"
                    className="input-field"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                      Category
                    </label>
                    <select
                      value={form.vehicle_type}
                      onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}
                      className="input-field capitalize font-semibold"
                    >
                      {VEHICLE_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                      Seating Capacity
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={8}
                      value={form.capacity}
                      onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value, 10) || 4 })}
                      className="input-field font-semibold"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="btn-secondary flex-1 py-2.5 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending || !form.vehicle_number.trim() || !form.model.trim()}
                    className="btn-primary flex-1 py-2.5 text-xs font-bold shadow-md shadow-emerald-500/20"
                  >
                    {saveMutation.isPending ? <Spinner size={14} className="text-white" /> : null}
                    {saveMutation.isPending ? 'Saving...' : editingId ? 'Update' : 'Register Vehicle'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Vehicles List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="card p-6 flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-60" />
                </div>
                <Skeleton className="h-9 w-24 rounded-xl" />
              </div>
            ))}
          </div>
        ) : vehicles.length === 0 ? (
          <div className="card p-10">
            <EmptyState
              icon={Car}
              title="No Vehicles Registered"
              description="Register your commercial cab or auto to begin accepting ride requests on the Rydio network."
              action={
                <button onClick={openAdd} className="btn-primary text-xs shadow-md">
                  + Add Your First Vehicle
                </button>
              }
            />
          </div>
        ) : (
          <div className="space-y-4">
            {vehicles.map((v) => (
              <div
                key={v.vehicle_id}
                className="card card-hover p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center justify-center text-2xl flex-shrink-0 shadow-inner">
                    🚘
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-base text-slate-900 tracking-wider">
                        {v.vehicle_number}
                      </span>
                      <StatusBadge status={v.status || 'active'} />
                    </div>
                    <div className="text-xs text-slate-600 font-medium mt-1">
                      {v.model} • <span className="capitalize">{v.vehicle_type}</span> • {v.capacity || 4} Seats
                    </div>
                    <div className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                      <ShieldCheck size={13} /> Commercial Transit Verified
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => startEdit(v)}
                    className="btn-secondary text-xs px-3.5 py-2 font-bold"
                  >
                    <Edit2 size={13} /> Edit
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(v.vehicle_id)}
                    disabled={deleteMutation.isPending}
                    className="btn-danger text-xs px-3.5 py-2"
                  >
                    <Trash2 size={13} />
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
