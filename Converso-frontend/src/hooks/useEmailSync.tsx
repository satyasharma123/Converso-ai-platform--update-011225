import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  progress?: {
    synced: number;
    total?: number;
  } | null;
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
            
            // Check if sync has been stuck in 'in_progress' for too long (over 10 minutes)
            let finalStatus = status?.status || 'pending';
            if (finalStatus === 'in_progress' && status?.updated_at) {
              const updatedAt = new Date(status.updated_at).getTime();
              const now = Date.now();
              const tenMinutes = 10 * 60 * 1000;
              
              if (now - updatedAt > tenMinutes) {
                console.warn(`⚠️ Sync for ${account.account_name} stuck in progress - treating as error`);
                finalStatus = 'error';
              }
            }
            
            return {
              accountId: account.id,
              accountName: account.account_name,
              status: finalStatus,
              lastSyncedAt: status?.last_synced_at || null,
              progress: status?.progress || null,
            };
          } catch (error) {
            console.error(`Error fetching sync status for ${account.id}:`, error);
            // If no sync status exists, return 'pending' so sync can be triggered
            return {
              accountId: account.id,
              accountName: account.account_name,
              status: 'pending' as const,
              lastSyncedAt: null,
              progress: null,
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
  const queryClient = useQueryClient();
  const { data: workspace } = useWorkspace();
  
  return useMutation({
    mutationFn: async ({ 
      accountId, 
      syncMode = 'incremental' 
    }: { 
      accountId: string; 
      syncMode?: 'initial' | 'incremental' | 'manual-recent';
    }) => {
      return apiClient.post('/api/emails/init-sync', { 
        account_id: accountId,
        sync_mode: syncMode,
      });
    },
    onSuccess: () => {
      // Invalidate sync status to refetch
      queryClient.invalidateQueries({ queryKey: ['email-sync-status'] });
    },
    onSettled: () => {
      // Refetch conversations after sync completes (success or error)
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['email-sync-status'] });
      queryClient.invalidateQueries({ queryKey: ['email-folder-counts'] });
    },
  });
}

/**
 * Interface for folder email counts
 */
export interface EmailFolderCounts {
  inbox: number;
  unread: number;
  sent: number;
  important: number;
  snoozed: number;
  drafts: number;
  archive: number;
  deleted: number;
}

/**
 * Hook to get email folder counts
 */
export function useEmailFolderCounts() {
  const { data: workspace } = useWorkspace();

  return useQuery({
    queryKey: ['email-folder-counts', workspace?.id],
    queryFn: async () => {
      if (!workspace) {
        return null;
      }

      try {
        const counts = await apiClient.get<EmailFolderCounts>(
          `/api/emails/folder-counts?workspace_id=${workspace.id}`
        );
        return counts;
      } catch (error) {
        console.error('Error fetching folder counts:', error);
        return null;
      }
    },
    enabled: !!workspace,
    staleTime: 30 * 1000, // Cache for 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

