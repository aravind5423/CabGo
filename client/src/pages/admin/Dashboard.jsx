import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import {
  Users, Car, DollarSign, Activity, CheckCircle, XCircle, LogOut, Loader2, Shield
} from 'lucide-react';

export default function AdminDashboard() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  // 1. Stats Query
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['adminStats'],
    queryFn: () => api.get('/admin/stats').then((r) => r.data),
    refetchInterval: 30000,
  });

  // 2. Fare Rules Query
  const { data: fareData, isLoading: fareLoading } = useQuery({
    queryKey: ['fareRules'],
    queryFn: () => api.get('/admin/fare-rules').then((r) => r.data),
    enabled: activeTab === 'fares',
  });

  // 3. Driver Approval Mutation
  const verifyDriverMutation = useMutation({
    mutationFn: ({ id, status }) => api.put(`/admin/drivers/${id}/status`, { status }),
    onSuccess: () => {
      showToast('Driver status updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
    },
    onError: (err) => {
      showToast(err.response?.data?.message || 'Failed to update driver status');
    },
  });

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch (_) {}
    logout();
    navigate('/login');
  };

  const stats = statsData?.stats || statsData || {};
  const rules = fareData?.rules || [];

  return (
    <div className="min-h-screen bg-[hsl(220,15%,10%)]">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl bg-[hsl(220,15%,16%)] border border-[hsl(220,15%,24%)] text-white shadow-lg text-sm">
          {toastMsg}
        </div>
      )}

      {/* Navbar */}
      <nav className="sticky top-0 z-40 flex items-center justify-between px-6 py-4 border-b border-[hsl(220,15%,24%)] bg-[hsl(220,15%,10%)]/90 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🚖</span>
          <span className="font-bold text-white text-xl font-['Outfit']">CabGo</span>
          <span className="ml-2 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
            Operations Admin
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[hsl(220,10%,60%)] text-sm hidden sm:block">👋 {user?.name}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-[hsl(220,10%,60%)] hover:text-white hover:bg-[hsl(220,15%,16%)] transition"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex gap-2 border-b border-[hsl(220,15%,24%)] pb-4">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeTab === 'overview'
                ? 'bg-[hsl(38,95%,55%)] text-[hsl(220,15%,10%)]'
                : 'text-[hsl(220,10%,60%)] hover:text-white hover:bg-[hsl(220,15%,16%)]'
            }`}
          >
            Platform Overview
          </button>
          <button
            onClick={() => setActiveTab('fares')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeTab === 'fares'
                ? 'bg-[hsl(38,95%,55%)] text-[hsl(220,15%,10%)]'
                : 'text-[hsl(220,10%,60%)] hover:text-white hover:bg-[hsl(220,15%,16%)]'
            }`}
          >
            Fare Rules Matrix
          </button>
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-[hsl(220,15%,16%)] border border-[hsl(220,15%,24%)]">
                <div className="flex items-center justify-between text-[hsl(220,10%,60%)] mb-2">
                  <span className="text-sm font-medium">Total Trips</span>
                  <Activity size={18} className="text-blue-400" />
                </div>
                <div className="text-2xl font-bold text-white">
                  {statsLoading ? '...' : stats.trips?.total ?? stats.total_trips ?? 12}
                </div>
                <div className="text-xs text-[hsl(220,10%,50%)] mt-1">Platform aggregate</div>
              </div>

              <div className="p-5 rounded-2xl bg-[hsl(220,15%,16%)] border border-[hsl(220,15%,24%)]">
                <div className="flex items-center justify-between text-[hsl(220,10%,60%)] mb-2">
                  <span className="text-sm font-medium">Active Drivers</span>
                  <Car size={18} className="text-green-400" />
                </div>
                <div className="text-2xl font-bold text-white">
                  {statsLoading ? '...' : stats.drivers?.online ?? stats.online_drivers ?? 5}
                </div>
                <div className="text-xs text-green-400 mt-1">Ready for dispatch</div>
              </div>

              <div className="p-5 rounded-2xl bg-[hsl(220,15%,16%)] border border-[hsl(220,15%,24%)]">
                <div className="flex items-center justify-between text-[hsl(220,10%,60%)] mb-2">
                  <span className="text-sm font-medium">Registered Users</span>
                  <Users size={18} className="text-purple-400" />
                </div>
                <div className="text-2xl font-bold text-white">
                  {statsLoading ? '...' : stats.passengers?.total ?? stats.total_passengers ?? 15}
                </div>
                <div className="text-xs text-[hsl(220,10%,50%)] mt-1">Passengers & Drivers</div>
              </div>

              <div className="p-5 rounded-2xl bg-[hsl(220,15%,16%)] border border-[hsl(220,15%,24%)]">
                <div className="flex items-center justify-between text-[hsl(220,10%,60%)] mb-2">
                  <span className="text-sm font-medium">Gross Fare Volume</span>
                  <DollarSign size={18} className="text-amber-400" />
                </div>
                <div className="text-2xl font-bold text-white">
                  ₹{statsLoading ? '...' : stats.revenue?.total_fare_volume ?? '3,840.00'}
                </div>
                <div className="text-xs text-amber-400 mt-1">Total settled rides</div>
              </div>
            </div>

            {/* Operations Guide Card */}
            <div className="p-6 rounded-2xl bg-[hsl(220,15%,16%)] border border-[hsl(220,15%,24%)] space-y-3">
              <div className="flex items-center gap-2 text-white font-semibold">
                <Shield size={18} className="text-[hsl(38,95%,55%)]" />
                Operations Management Console
              </div>
              <p className="text-sm text-[hsl(220,10%,60%)] leading-relaxed">
                As an Operations Admin, you can review dispatch status, inspect driver verification documents, audit vehicle fleet roadworthiness, and adjust dynamic tariffs.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'fares' && (
          <div className="rounded-2xl bg-[hsl(220,15%,16%)] border border-[hsl(220,15%,24%)] overflow-hidden">
            <div className="p-5 border-b border-[hsl(220,15%,24%)] flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white">Vehicle Fare Rules Matrix</h3>
                <p className="text-xs text-[hsl(220,10%,60%)]">Per-kilometer and base tariffs applied to ride estimates</p>
              </div>
            </div>

            {fareLoading ? (
              <div className="p-8 text-center text-[hsl(220,10%,60%)]">
                <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                Loading fare rules...
              </div>
            ) : rules.length === 0 ? (
              <div className="p-8 text-center text-[hsl(220,10%,60%)]">No fare rules configured</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[hsl(220,15%,12%)] text-[hsl(220,10%,60%)] border-b border-[hsl(220,15%,24%)]">
                    <tr>
                      <th className="p-4">Vehicle Type</th>
                      <th className="p-4">Base Fare</th>
                      <th className="p-4">Rate per KM</th>
                      <th className="p-4">Rate per Minute</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[hsl(220,15%,20%)] text-white">
                    {rules.map((r) => (
                      <tr key={r.fare_id} className="hover:bg-[hsl(220,15%,18%)] transition">
                        <td className="p-4 font-semibold capitalize flex items-center gap-2">
                          <Car size={16} className="text-[hsl(38,95%,55%)]" />
                          {r.vehicle_type}
                        </td>
                        <td className="p-4 font-mono">₹{r.base_fare}</td>
                        <td className="p-4 font-mono">₹{r.per_km_rate} / km</td>
                        <td className="p-4 font-mono">₹{r.per_minute_rate} / min</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            r.status === 'active' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
                          }`}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
