import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

/**
 * Role-based protected route guard.
 * Redirects unauthenticated users to /login.
 * Redirects users with wrong role to their own dashboard.
 * Note: Superadmins inherit access to admin routes.
 */
export default function ProtectedRoute({ children, role }) {
  const { token, user } = useAuthStore();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  // Allow superadmin to access admin routes as well
  const hasAccess = !role || user.role === role || (role === 'admin' && user.role === 'superadmin');

  if (!hasAccess) {
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
