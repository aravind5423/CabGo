import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Login from './pages/auth/Login';
import PassengerDashboard from './pages/passenger/Dashboard';
import BookRide from './pages/passenger/BookRide';
import ActiveTrip from './pages/passenger/ActiveTrip';
import DriverDashboard from './pages/driver/Dashboard';
import AdminDashboard from './pages/admin/Dashboard';
import SuperadminDashboard from './pages/superadmin/Dashboard';
import ProtectedRoute from './components/ui/ProtectedRoute';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Passenger Routes */}
          <Route
            path="/passenger/dashboard"
            element={
              <ProtectedRoute role="passenger">
                <PassengerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/passenger/book-ride"
            element={
              <ProtectedRoute role="passenger">
                <BookRide />
              </ProtectedRoute>
            }
          />
          <Route
            path="/passenger/active-trip"
            element={
              <ProtectedRoute role="passenger">
                <ActiveTrip />
              </ProtectedRoute>
            }
          />

          {/* Driver Routes */}
          <Route
            path="/driver/dashboard"
            element={
              <ProtectedRoute role="driver">
                <DriverDashboard />
              </ProtectedRoute>
            }
          />

          {/* Admin Routes */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute role="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Superadmin Routes */}
          <Route
            path="/superadmin/dashboard"
            element={
              <ProtectedRoute role="superadmin">
                <SuperadminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
