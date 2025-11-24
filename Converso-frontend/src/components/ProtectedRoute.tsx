import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'sdr';
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, userRole, loading } = useAuth();

  // Show nothing while loading to prevent flash of content
  if (loading) {
    return null;
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Redirect non-admin users away from admin pages
  if (requiredRole === 'admin' && userRole !== 'admin') {
    return <Navigate to="/" replace />;
  }

  // Redirect non-SDR users away from SDR-only pages (if needed in future)
  if (requiredRole === 'sdr' && userRole !== 'sdr' && userRole !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
