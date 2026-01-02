import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/context/WorkspaceContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'sdr';
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, userRole, loading } = useAuth();
  const { hasNoWorkspaceMembership, loading: wsLoading, isOwner } = useWorkspace();
  const location = useLocation();

  // DIAGNOSTIC: Log loading states every render
  console.log('[PROTECTED-ROUTE] render', { 
    authLoading: loading, 
    wsLoading, 
    hasUser: !!user,
    pathname: location.pathname 
  });

  // Block ONLY while auth is loading
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Block workspace loading ONLY AFTER user is authenticated
  if (user && wsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to create-workspace if user has no workspace memberships
  // (unless they're already on the create-workspace page)
  if (hasNoWorkspaceMembership && location.pathname !== '/create-workspace') {
    console.log('[PROTECTED-ROUTE] Redirecting to /create-workspace - no workspace memberships');
    return <Navigate to="/create-workspace" replace />;
  }

  // Redirect non-admin/non-owner users away from admin pages
  // OWNER gets admin UI access
  if (requiredRole === 'admin' && userRole !== 'admin' && !isOwner) {
    return <Navigate to="/" replace />;
  }

  // Redirect non-SDR users away from SDR-only pages (if needed in future)
  if (requiredRole === 'sdr' && userRole !== 'sdr' && userRole !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
