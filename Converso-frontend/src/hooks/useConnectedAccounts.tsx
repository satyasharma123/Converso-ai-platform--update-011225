import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { connectedAccountsApi } from '@/lib/backend-api';
import type { ConnectedAccount } from '@backend/src/types';
import { useWorkspace } from '@/context/WorkspaceContext';

// Re-export types for convenience
export type { ConnectedAccount } from '@backend/src/types';

export function useConnectedAccounts() {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();

  return useQuery({
    // IMPORTANT: Workspace switching must refetch connected accounts
    queryKey: ['connected_accounts', user?.id, activeWorkspace?.id],
    queryFn: () => connectedAccountsApi.list(user?.id),
  });
}
