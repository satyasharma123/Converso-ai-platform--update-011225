import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { connectedAccountsApi } from '@/lib/backend-api';
import type { ConnectedAccount } from '@backend/src/types';

// Re-export types for convenience
export type { ConnectedAccount } from '@backend/src/types';

export function useConnectedAccounts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['connected_accounts', user?.id],
    queryFn: () => connectedAccountsApi.list(user?.id),
  });
}
