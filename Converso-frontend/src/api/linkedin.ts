import { apiClient } from '@/lib/api-client';

export interface LinkedInAccount {
  id: string;
  account_name: string;
  account_email: string | null;
  account_type: 'linkedin';
  is_active: boolean;
  workspace_id: string;
  user_id: string;
  unipile_account_id?: string;
}

export interface LinkedInAccountsResponse {
  accounts: LinkedInAccount[];
}

export interface InitialSyncResponse {
  conversations: number;
  messages: number;
  success: boolean;
}

/**
 * Get all LinkedIn accounts for a workspace
 */
export async function getLinkedInAccounts(workspaceId: string): Promise<LinkedInAccountsResponse> {
  return await apiClient.get<LinkedInAccountsResponse>(`/api/linkedin/accounts?workspace_id=${workspaceId}`);
}

/**
 * Trigger initial sync for a LinkedIn account
 */
export async function initialSyncLinkedIn(accountId: string): Promise<InitialSyncResponse> {
  return await apiClient.post<InitialSyncResponse>(`/api/linkedin/accounts/${accountId}/initial-sync`);
}

/**
 * Disconnect a LinkedIn account
 */
export async function disconnectLinkedInAccount(accountId: string): Promise<void> {
  return await apiClient.delete(`/api/linkedin/accounts/${accountId}`);
}

/**
 * Refresh LinkedIn accounts from Unipile
 */
export async function refreshLinkedInAccounts(
  workspaceId: string,
  userId?: string
): Promise<{ synced: number; errors: number }> {
  return await apiClient.post<{ synced: number; errors: number }>('/api/linkedin/accounts/refresh', {
    workspace_id: workspaceId,
    user_id: userId,
  });
}
