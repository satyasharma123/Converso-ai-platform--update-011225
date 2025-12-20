/**
 * LinkedIn API Client - Uses separate linkedin_conversations and linkedin_messages tables
 */

import { apiClient } from '@/lib/api-client';

export interface LinkedInConversation {
  id: string;
  unipile_chat_id: string;
  title: string | null;
  participant_ids: any[];
  latest_message_at: string;
  workspace_id: string;
  account_id: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

export interface LinkedInMessage {
  id: string;
  unipile_message_id: string;
  conversation_id: string;
  sender_id: string | null;
  sender_name: string;
  content: string;
  timestamp: string;
  direction: 'in' | 'out';
  attachments: any[];
  raw_json: any;
  workspace_id: string;
  account_id: string;
  created_at: string;
}

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

/**
 * Get all LinkedIn conversations for a workspace
 */
export async function getLinkedInConversations(
  workspaceId: string,
  accountId?: string
): Promise<{ conversations: LinkedInConversation[] }> {
  const params: Record<string, string> = { workspace_id: workspaceId };
  if (accountId) {
    params.account_id = accountId;
  }
  
  return await apiClient.get<{ conversations: LinkedInConversation[] }>(
    `/api/linkedin/conversations`,
    params
  );
}

/**
 * Get messages for a LinkedIn conversation
 */
export async function getLinkedInMessages(
  conversationId: string
): Promise<{ messages: LinkedInMessage[] }> {
  return await apiClient.get<{ messages: LinkedInMessage[] }>(
    `/api/linkedin/conversations/${conversationId}/messages`
  );
}

/**
 * Get all LinkedIn accounts for a workspace
 */
export async function getLinkedInAccounts(
  workspaceId: string
): Promise<{ accounts: LinkedInAccount[] }> {
  return await apiClient.get<{ accounts: LinkedInAccount[] }>(
    `/api/linkedin/accounts`,
    { workspace_id: workspaceId }
  );
}

/**
 * Trigger initial sync for a LinkedIn account
 */
export async function initialSyncLinkedIn(accountId: string): Promise<{ 
  success: boolean;
  conversations: number;
  messages: number;
}> {
  return await apiClient.post<{ 
    success: boolean;
    conversations: number;
    messages: number;
  }>(`/api/linkedin/accounts/${accountId}/initial-sync`);
}

/**
 * Disconnect a LinkedIn account
 */
export async function disconnectLinkedInAccount(accountId: string): Promise<void> {
  return await apiClient.delete(`/api/linkedin/accounts/${accountId}`);
}








