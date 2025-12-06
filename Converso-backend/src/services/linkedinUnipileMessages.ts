/**
 * LinkedIn Messaging Service (Unipile Integration)
 * Handles syncing LinkedIn messages and conversations from Unipile
 */

import { unipileGet } from '../integrations/unipileClient';
import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../utils/logger';
import { LINKEDIN_INITIAL_SYNC_DAYS } from '../config/unipile';

interface UnipileConversation {
  id: string;
  name?: string;
  participants?: Array<{ name?: string; id?: string }>;
  last_message_at?: string;
  created_at?: string;
}

interface UnipileMessage {
  id: string;
  chat_id: string;
  sender_name?: string;
  sender_id?: string;
  content: string;
  created_at: string;
  is_from_me?: boolean;
}

/**
 * Sync LinkedIn messages for a specific account
 */
export async function syncLinkedInMessages(accountId: string): Promise<{ conversations: number; messages: number }> {
  // Get the account from Supabase
  const { data: account, error: accountError } = await supabaseAdmin
    .from('connected_accounts')
    .select('*')
    .eq('id', accountId)
    .eq('account_type', 'linkedin')
    .single();

  if (accountError || !account) {
    throw new Error(`LinkedIn account not found: ${accountId}`);
  }

  if (!account.unipile_account_id) {
    throw new Error(`LinkedIn account ${accountId} does not have a Unipile account ID`);
  }

  const unipileAccountId = account.unipile_account_id;
  const workspaceId = account.workspace_id;

  if (!workspaceId) {
    throw new Error(`LinkedIn account ${accountId} does not have a workspace_id`);
  }

  logger.info(`[LinkedIn Sync] Starting sync for account ${accountId} (Unipile: ${unipileAccountId})`);

  // Calculate date for initial sync
  const since = new Date();
  since.setDate(since.getDate() - LINKEDIN_INITIAL_SYNC_DAYS);

  let conversationsCount = 0;
  let messagesCount = 0;

  try {
    // Fetch chats from Unipile
    const chatsResponse = await unipileGet<{ items: UnipileConversation[] }>(
      `/chats`,
      { account_id: unipileAccountId, since: since.toISOString(), limit: 100 }
    );

    const chats = chatsResponse.items || [];
    logger.info(`[LinkedIn Sync] Found ${chats.length} conversations`);

    // Process each conversation
    for (const chat of chats) {
      try {
        // Upsert conversation
        const conversationId = await upsertConversation(accountId, workspaceId, chat);
        conversationsCount++;

        // Fetch messages for this chat
        const messagesResponse = await unipileGet<{ items: UnipileMessage[] }>(
          `/chats/${chat.id}/messages`,
          { account_id: unipileAccountId, limit: 100 }
        );

        const messages = messagesResponse.items || [];
        logger.info(`[LinkedIn Sync] Found ${messages.length} messages in conversation ${chat.id}`);

        // Upsert messages
        for (const msg of messages) {
          await upsertMessage(conversationId, workspaceId, msg);
          messagesCount++;
        }
      } catch (error: any) {
        logger.error(`[LinkedIn Sync] Error processing conversation ${chat.id}:`, error);
        // Continue with next conversation
      }
    }

    // Update account sync status
    await supabaseAdmin
      .from('connected_accounts')
      .update({
        last_synced_at: new Date().toISOString(),
        sync_status: 'success',
        sync_error: null,
      })
      .eq('id', accountId);

    logger.info(`[LinkedIn Sync] Completed: ${conversationsCount} conversations, ${messagesCount} messages`);
    return { conversations: conversationsCount, messages: messagesCount };
  } catch (error: any) {
    logger.error(`[LinkedIn Sync] Error syncing account ${accountId}:`, error);
    
    // Update account sync status with error
    await supabaseAdmin
      .from('connected_accounts')
      .update({
        sync_status: 'error',
        sync_error: error.message || 'Unknown error',
      })
      .eq('id', accountId);

    throw error;
  }
}

/**
 * Upsert a conversation in Supabase
 */
async function upsertConversation(
  accountId: string,
  workspaceId: string,
  chat: UnipileConversation
): Promise<string> {
  const participantNames = (chat.participants || [])
    .map((p) => p.name || '')
    .filter(Boolean)
    .join(', ') || 'Unknown';

  // Check if conversation already exists
  const { data: existing } = await supabaseAdmin
    .from('conversations')
    .select('id')
    .eq('external_conversation_id', chat.id)
    .eq('conversation_type', 'linkedin')
    .single();

  const conversationData = {
    workspace_id: workspaceId,
    received_on_account_id: accountId,
    sender_name: participantNames,
    subject: chat.name || null,
    preview: '', // Will be updated with last message
    last_message_at: chat.last_message_at || chat.created_at || new Date().toISOString(),
    conversation_type: 'linkedin' as const,
    status: 'new' as const,
    is_read: false,
    external_conversation_id: chat.id,
    provider: 'linkedin' as const,
  };

  if (existing) {
    // Update existing
    const { data, error } = await supabaseAdmin
      .from('conversations')
      .update(conversationData)
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return data.id;
  } else {
    // Create new
    const { data, error } = await supabaseAdmin
      .from('conversations')
      .insert(conversationData)
      .select()
      .single();

    if (error) throw error;
    return data.id;
  }
}

/**
 * Upsert a message in Supabase
 */
async function upsertMessage(
  conversationId: string,
  workspaceId: string,
  msg: UnipileMessage
): Promise<void> {
  // Check if message already exists
  const { data: existing } = await supabaseAdmin
    .from('messages')
    .select('id')
    .eq('external_message_id', msg.id)
    .eq('provider', 'linkedin')
    .single();

  const messageData = {
    conversation_id: conversationId,
    workspace_id: workspaceId,
    sender_name: msg.sender_name || 'Unknown',
    content: msg.content,
    created_at: msg.created_at,
    is_from_lead: !msg.is_from_me, // If not from me, it's from the lead
    external_message_id: msg.id,
    provider: 'linkedin' as const,
  };

  if (existing) {
    // Update existing
    const { error } = await supabaseAdmin
      .from('messages')
      .update(messageData)
      .eq('id', existing.id);

    if (error) throw error;
  } else {
    // Create new
    const { error } = await supabaseAdmin
      .from('messages')
      .insert(messageData);

    if (error) throw error;
  }
}
