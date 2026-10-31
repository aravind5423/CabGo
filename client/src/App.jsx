import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Login from './pages/auth/Login';
import PassengerDashboard from './pages/passenger/Dashboard';
import BookRide from './pages/passenger/BookRide';
import ActiveTrip from './pages/passenger/ActiveTrip';
import PassengerHistory from './pages/passenger/History';
import PassengerProfile from './pages/passenger/Profile';
import DriverDashboard from './pages/driver/Dashboard';
import DriverVehicles from './pages/driver/Vehicles';
import DriverEarnings from './pages/driver/Earnings';
import AdminDashboard from './pages/admin/Dashboard';
import SuperadminDashboard from './pages/superadmin/Dashboard';
import ProtectedRoute, { HomeRedirect } from './components/ui/ProtectedRoute';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const guard = (role, element) => <ProtectedRoute role={role}>{element}</ProtectedRoute>;

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Passenger */}
          <Route path="/passenger/dashboard"   element={guard('passenger', <PassengerDashboard />)} />
          <Route path="/passenger/book-ride"   element={guard('passenger', <BookRide />)} />
          <Route path="/passenger/active-trip" element={guard('passenger', <ActiveTrip />)} />
          <Route path="/passenger/history"     element={guard('passenger', <PassengerHistory />)} />
          <Route path="/passenger/profile"     element={guard('passenger', <PassengerProfile />)} />

          {/* Driver */}
          <Route path="/driver/dashboard" element={guard('driver', <DriverDashboard />)} />
          <Route path="/driver/vehicles"  element={guard('driver', <DriverVehicles />)} />
          <Route path="/driver/earnings"  element={guard('driver', <DriverEarnings />)} />

          {/* Admin (superadmin may also access) */}
          <Route path="/admin/dashboard" element={guard('admin', <AdminDashboard />)} />

          {/* Superadmin */}
          <Route path="/superadmin/dashboard" element={guard('superadmin', <SuperadminDashboard />)} />

          {/* Default */}
          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
