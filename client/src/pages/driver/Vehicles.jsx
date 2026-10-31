import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import {
  Car, Plus, Trash2, Edit2, ArrowLeft, Loader2, CheckCircle, ShieldCheck, AlertCircle
} from 'lucide-react';

const EMPTY_FORM = {
  vehicle_number: '',
  model: '',
  vehicle_type: 'sedan',
  capacity: 4,
};

export default function DriverVehicles() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

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
      queryClient.invalidateQueries({ queryKey: ['driverVehicles'] });
      queryClient.invalidateQueries({ queryKey: ['driverDashboard'] });
      setShowModal(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      showToast(editingId ? '✅ Vehicle updated!' : '✅ New vehicle added to fleet!');
    },
    onError: (err) => {
      showToast(err.response?.data?.message || '❌ Failed to save vehicle details');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/driver/vehicles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driverVehicles'] });
      queryClient.invalidateQueries({ queryKey: ['driverDashboard'] });
      showToast('Vehicle removed from your account.');
    },
  });

  const startEdit = (v) => {
    setEditingId(v.vehicle_id);
    setForm({
      vehicle_number: v.vehicle_number,
      model: v.model,
      vehicle_type: v.vehicle_type,
      capacity: v.capacity || 4,
    });
    setShowModal(true);
  };

  return (
    <div className="min-h-screen bg-[hsl(220,15%,10%)] pb-12">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl bg-[hsl(220,15%,16%)] border border-amber-500/40 text-amber-300 shadow-xl text-sm font-medium animate-fade-in flex items-center gap-2">
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Navbar */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 border-b border-[hsl(220,15%,24%)] bg-[hsl(220,15%,10%)]/95 backdrop-blur">
        <div className="flex items-center gap-4">
          <Link
            to="/driver/dashboard"
            className="flex items-center gap-2 text-[hsl(220,10%,60%)] hover:text-white transition"
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-semibold">Console</span>
          </Link>
          <span className="text-gray-600">|</span>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🚖</span>
            <span className="font-bold text-white text-xl font-['Outfit']">CabGo</span>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-900/40 text-emerald-400 border border-emerald-500/30">
              Fleet Management
            </span>
          </div>
        </div>

        <button
          onClick={() => {
            setEditingId(null);
            setForm(EMPTY_FORM);
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition cursor-pointer shadow"
        >
          <Plus size={16} />
          Register Vehicle
        </button>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-white font-['Outfit']">Registered Fleet Vehicles</h1>
          <p className="text-sm text-[hsl(220,10%,60%)] mt-1">Manage vehicles linked to your commercial driver partner account</p>
        </div>

        {/* Modal / Inline Form */}
        {showModal && (
          <div className="p-6 rounded-2xl bg-[hsl(220,15%,14%)] border-2 border-amber-500/40 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">
              {editingId ? 'Edit Vehicle Details' : 'Register New Commercial Vehicle'}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[hsl(220,10%,70%)] mb-1">
                  License Plate / Registration No.
                </label>
                <input
                  type="text"
                  value={form.vehicle_number}
                  onChange={(e) => setForm({ ...form, vehicle_number: e.target.value.toUpperCase() })}
                  placeholder="e.g. TN-09-AB-1234"
                  className="w-full px-4 py-2.5 rounded-xl bg-[hsl(220,15%,10%)] border border-[hsl(220,15%,24%)] text-white text-sm focus:outline-none focus:border-amber-400 uppercase font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[hsl(220,10%,70%)] mb-1">
                  Vehicle Model
                </label>
                <input
                  type="text"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  placeholder="e.g. Honda City / Maruti Dzire"
                  className="w-full px-4 py-2.5 rounded-xl bg-[hsl(220,15%,10%)] border border-[hsl(220,15%,24%)] text-white text-sm focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[hsl(220,10%,70%)] mb-1">
                  Category Tier
                </label>
                <select
                  value={form.vehicle_type}
                  onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-[hsl(220,15%,10%)] border border-[hsl(220,15%,24%)] text-white text-sm focus:outline-none focus:border-amber-400 capitalize"
                >
                  <option value="sedan">Sedan</option>
                  <option value="suv">SUV</option>
                  <option value="hatchback">Hatchback</option>
                  <option value="auto">Auto Rickshaw</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[hsl(220,10%,70%)] mb-1">
                  Passenger Capacity (Seats)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 rounded-xl bg-[hsl(220,15%,10%)] border border-[hsl(220,15%,24%)] text-white text-sm focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !form.vehicle_number || !form.model}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-sm transition disabled:opacity-50 cursor-pointer"
              >
                {saveMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                {editingId ? 'Save Changes' : 'Confirm Registration'}
              </button>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-5 py-2.5 rounded-xl border border-[hsl(220,15%,24%)] text-[hsl(220,10%,60%)] hover:text-white text-sm font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Vehicles List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-[hsl(220,15%,16%)] animate-pulse" />
            ))}
          </div>
        ) : vehicles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-[hsl(220,15%,24%)] rounded-2xl bg-[hsl(220,15%,12%)]">
            <Car size={44} className="text-[hsl(220,10%,40%)] mb-3" />
            <h3 className="text-base font-bold text-white">No Vehicles Registered</h3>
            <p className="text-xs text-[hsl(220,10%,50%)] mt-1">
              Add your vehicle details to start accepting passenger rides.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {vehicles.map((v) => (
              <div
                key={v.vehicle_id}
                className="p-5 rounded-2xl border border-[hsl(220,15%,22%)] bg-[hsl(220,15%,14%)] hover:border-[hsl(220,15%,30%)] transition shadow-md flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center text-2xl flex-shrink-0">
                    🚗
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-white text-base tracking-wider uppercase font-mono">
                        {v.vehicle_number}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-900/40 text-emerald-400 border border-emerald-500/30">
                        {v.status || 'Active'}
                      </span>
                    </div>
                    <div className="text-xs text-[hsl(220,10%,60%)] mt-1 capitalize">
                      {v.model} • {v.vehicle_type} Tier • {v.capacity || 4} Passenger Seats
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => startEdit(v)}
                    className="p-2.5 rounded-xl border border-[hsl(220,15%,24%)] text-[hsl(220,10%,70%)] hover:text-white hover:bg-[hsl(220,15%,18%)] transition cursor-pointer"
                    title="Edit"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(v.vehicle_id)}
                    disabled={deleteMutation.isPending}
                    className="p-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-950/30 transition cursor-pointer disabled:opacity-50"
                    title="Remove"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
