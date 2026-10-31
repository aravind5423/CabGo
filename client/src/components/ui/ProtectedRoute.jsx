import { Navigate } from 'react-router-dom';
import { useAuthStore, ROLE_HOME } from '../../store/authStore';

/**
 * Role-based route guard.
 * - Unauthenticated users go to /login.
 * - Users with the wrong role are sent to their own dashboard.
 * - Superadmins may also open admin routes.
 */
export default function ProtectedRoute({ children, role }) {
  const { token, user } = useAuthStore();

  if (!token || !user) return <Navigate to="/login" replace />;

  const hasAccess = !role || user.role === role || (role === 'admin' && user.role === 'superadmin');
  if (!hasAccess) return <Navigate to={ROLE_HOME[user.role] || '/login'} replace />;

  return children;
}

/** Sends a signed-in user to their dashboard, otherwise to the login page. */
export function HomeRedirect() {
  const { token, user } = useAuthStore();
  if (token && user) return <Navigate to={ROLE_HOME[user.role] || '/login'} replace />;
  return <Navigate to="/login" replace />;
}
