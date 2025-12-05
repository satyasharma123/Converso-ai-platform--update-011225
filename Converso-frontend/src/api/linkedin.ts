/**
 * LinkedIn API Client (Unipile-based)
 * Handles LinkedIn account management and messaging via Unipile
 */

import { apiClient } from '@/lib/api-client';

// ============================================
// Account Management
// ============================================

export interface LinkedInAccount {
  id: string;
  workspace_id: string;
  account_type: 'linkedin';
  account_name: string;
  account_email?: string;
  unipile_account_id?: string;
  is_active: boolean;
  sync_status?: 'pending' | 'syncing' | 'success' | 'error' | 'disconnected';
  sync_error?: string;
  last_synced_at?: string;
  created_at: string;
}

export interface AuthUrlResponse {
  url: string;
  session_id: string;
}

export interface RefreshAccountsResponse {
  success: boolean;
  synced: number;
  errors: number;
}

export interface UsageSummary {
  today: number;
  limit: number;
  remaining: number;
  percentage: number;
  status: 'safe' | 'warning' | 'critical' | 'blocked';
}

/**
 * Get authentication URL for connecting LinkedIn account via Unipile
 */
export async function getLinkedInAuthUrl(
  workspaceId: string,
  userId: string
): Promise<AuthUrlResponse> {
  return await apiClient.post<AuthUrlResponse>('/api/linkedin/accounts/auth-url', {
    workspace_id: workspaceId,
    user_id: userId,
  });
}

/**
 * Refresh LinkedIn accounts from Unipile
 */
export async function refreshLinkedInAccounts(
  workspaceId: string,
  userId?: string
): Promise<RefreshAccountsResponse> {
  return await apiClient.post<RefreshAccountsResponse>('/api/linkedin/accounts/refresh', {
    workspace_id: workspaceId,
    user_id: userId,
  });
}

/**
 * Get all LinkedIn accounts for a workspace
 */
export async function getLinkedInAccounts(
  workspaceId: string
): Promise<{ accounts: LinkedInAccount[] }> {
  return await apiClient.get<{ accounts: LinkedInAccount[] }>(
    `/api/linkedin/accounts?workspace_id=${workspaceId}`
  );
}

/**
 * Get a specific LinkedIn account
 */
export async function getLinkedInAccount(
  accountId: string
): Promise<{ account: LinkedInAccount }> {
  return await apiClient.get<{ account: LinkedInAccount }>(`/api/linkedin/accounts/${accountId}`);
}

/**
 * Disconnect a LinkedIn account
 */
export async function disconnectLinkedInAccount(
  accountId: string
): Promise<{ success: boolean; message: string }> {
  return await apiClient.post<{ success: boolean; message: string }>(
    `/api/linkedin/accounts/${accountId}/disconnect`
  );
}

/**
 * Get daily DM usage for an account
 */
export async function getLinkedInUsage(
  accountId: string
): Promise<{ usage: UsageSummary }> {
  return await apiClient.get<{ usage: UsageSummary }>(`/api/linkedin/accounts/${accountId}/usage`);
}

// ============================================
// Sync Operations
// ============================================

export interface SyncResponse {
  success: boolean;
  conversations: number;
  messages: number;
}

/**
 * Initial sync: Import last 30 days of LinkedIn DMs
 */
export async function initialSyncLinkedIn(accountId: string): Promise<SyncResponse> {
  return await apiClient.post<SyncResponse>(`/api/linkedin/accounts/${accountId}/initial-sync`);
}

/**
 * Incremental sync: Fetch only new messages
 */
export async function syncLinkedInMessages(accountId: string): Promise<SyncResponse> {
  return await apiClient.post<SyncResponse>(`/api/linkedin/accounts/${accountId}/sync`);
}

// ============================================
// Conversations & Messages
// ============================================

export interface LinkedInConversation {
  id: string;
  workspace_id: string;
  received_on_account_id: string;
  provider: 'linkedin';
  external_conversation_id: string;
  preview?: string;
  participant_name?: string;
  participant_email?: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

export interface LinkedInMessage {
  id: string;
  conversation_id: string;
  workspace_id: string;
  provider: 'linkedin';
  external_message_id: string;
  direction: 'incoming' | 'outgoing';
  sender_id: string;
  sender_name: string;
  content: string;
  attachments?: any;
  created_at: string;
}

/**
 * Get LinkedIn conversations for a workspace
 */
export async function getLinkedInConversations(
  workspaceId: string,
  accountId?: string,
  limit: number = 50,
  before?: string
): Promise<{ conversations: LinkedInConversation[] }> {
  const params = new URLSearchParams({
    workspace_id: workspaceId,
    limit: limit.toString(),
  });
  if (accountId) params.append('account_id', accountId);
  if (before) params.append('before', before);

  return await apiClient.get<{ conversations: LinkedInConversation[] }>(
    `/api/linkedin/conversations?${params.toString()}`
  );
}

/**
 * Get messages for a LinkedIn conversation
 */
export async function getLinkedInMessages(
  conversationId: string,
  limit: number = 50,
  before?: string
): Promise<{ messages: LinkedInMessage[] }> {
  const params = new URLSearchParams({
    limit: limit.toString(),
  });
  if (before) params.append('before', before);

  return await apiClient.get<{ messages: LinkedInMessage[] }>(
    `/api/linkedin/conversations/${conversationId}/messages?${params.toString()}`
  );
}

/**
 * Send a LinkedIn message
 */
export interface SendMessageRequest {
  account_id: string;
  body: string;
  attachments?: { url: string; name: string }[];
}

export interface SendMessageResponse {
  success: boolean;
  message_id: string;
  warning?: string;
}

export async function sendLinkedInMessage(
  conversationId: string,
  request: SendMessageRequest
): Promise<SendMessageResponse> {
  return await apiClient.post<SendMessageResponse>(
    `/api/linkedin/conversations/${conversationId}/messages`,
    request
  );
}
