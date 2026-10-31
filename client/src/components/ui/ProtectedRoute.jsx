import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

/**
 * Role-based protected route guard.
 * Redirects unauthenticated users to /login.
 * Redirects users with wrong role to their own dashboard.
 */
export default function ProtectedRoute({ children, role }) {
  const { token, user } = useAuthStore();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (role && user.role !== role) {
    const dashboardPaths = {
      passenger: '/passenger/dashboard',
      driver: '/driver/dashboard',
      admin: '/admin/dashboard',
      superadmin: '/superadmin/dashboard',
    };
    return <Navigate to={dashboardPaths[user.role] || '/login'} replace />;
  }

  return children;
}
