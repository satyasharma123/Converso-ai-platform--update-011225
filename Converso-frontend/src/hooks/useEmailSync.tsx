import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useWorkspace } from './useWorkspace';
import { useConnectedAccounts } from './useConnectedAccounts';

export interface SyncStatus {
  id: string;
  workspace_id: string;
  inbox_id: string;
  status: 'in_progress' | 'completed' | 'error';
  last_synced_at: string | null;
  sync_error: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Hook to get sync status for email accounts
 */
export function useEmailSyncStatus() {
  const { data: workspace } = useWorkspace();
  const { data: accounts = [] } = useConnectedAccounts();
  
  // Get email accounts only
  const emailAccounts = accounts.filter(acc => acc.account_type === 'email');

  return useQuery({
    queryKey: ['email-sync-status', workspace?.id, emailAccounts.map(a => a.id)],
    queryFn: async () => {
      if (!workspace || emailAccounts.length === 0) {
        return [];
      }

      // Get sync status for all email accounts
      const statuses = await Promise.all(
        emailAccounts.map(async (account) => {
          try {
            const status = await apiClient.get<SyncStatus>(
              `/api/emails/sync-status?workspace_id=${workspace.id}&account_id=${account.id}`
            );
            return {
              accountId: account.id,
              accountName: account.account_name,
              status: status?.status || 'pending',
              lastSyncedAt: status?.last_synced_at || null,
            };
          } catch (error) {
            console.error(`Error fetching sync status for ${account.id}:`, error);
            // If no sync status exists, return 'pending' so sync can be triggered
            return {
              accountId: account.id,
              accountName: account.account_name,
              status: 'pending' as const,
              lastSyncedAt: null,
            };
          }
        })
      );

      return statuses;
    },
    enabled: !!workspace && emailAccounts.length > 0,
    refetchInterval: (query) => {
      // Poll every 5 seconds if any sync is in progress
      const data = query.state.data;
      const hasInProgress = data?.some((s: any) => s.status === 'in_progress');
      return hasInProgress ? 5000 : false;
    },
  });
}

/**
 * Hook to check if any email sync is in progress
 */
export function useIsEmailSyncInProgress() {
  const { data: syncStatuses = [] } = useEmailSyncStatus();
  
  return syncStatuses.some(status => status.status === 'in_progress');
}

/**
 * Hook to manually trigger email sync
 */
export function useInitEmailSync() {
  return useMutation({
    mutationFn: async (accountId: string) => {
      return apiClient.post('/api/emails/init-sync', { account_id: accountId });
    },
  });
}

