import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/context/WorkspaceContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'sdr';
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const { activeWorkspace, hasNoWorkspaceMembership, loading: wsLoading, isOwner } = useWorkspace();
  const location = useLocation();

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

  // Redirect to create-workspace ONLY if memberships are confirmed empty.
  // IMPORTANT: activeWorkspace === null must NOT trigger redirect.
  if (!wsLoading && hasNoWorkspaceMembership === true && location.pathname !== '/create-workspace') {
    return <Navigate to="/create-workspace" replace />;
  }

  // Role gating must be workspace-scoped (NOT auth metadata/user_roles).
  const workspaceRole = (activeWorkspace?.role || '').toString().toLowerCase();
  const effectiveRole = isOwner ? 'owner' : workspaceRole;

  if (requiredRole) {
    // If memberships exist but activeWorkspace isn't resolved yet, block briefly (no redirect).
    if (!wsLoading && hasNoWorkspaceMembership === false && !activeWorkspace) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      );
    }

    if (requiredRole === 'admin') {
      if (effectiveRole !== 'admin' && effectiveRole !== 'owner') {
        return <Navigate to="/" replace />;
      }
    }

    if (requiredRole === 'sdr') {
      if (effectiveRole !== 'sdr' && effectiveRole !== 'admin' && effectiveRole !== 'owner') {
        return <Navigate to="/" replace />;
      }
    }
  }

  return <>{children}</>;
}
