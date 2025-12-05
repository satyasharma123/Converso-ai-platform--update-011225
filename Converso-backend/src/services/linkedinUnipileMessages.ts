/**
 * LinkedIn Messaging via Unipile
 * Handles syncing and sending LinkedIn DMs
 */

import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../utils/logger';
import {
  unipileGet,
  unipilePost,
  UnipileConversation,
  UnipileMessage,
  UnipileSendMessageRequest,
  UnipileSendMessageResponse,
} from '../integrations/unipileClient';
import { LINKEDIN_INITIAL_SYNC_DAYS } from '../config/unipile';
import { checkAndConsumeDmQuota } from './linkedinUsageGuard';

/**
 * Fetch chats from Unipile with fallback paths
 * Primary: /accounts/{id}/chats
 * Fallback: /chats?account_id={id}
 */
async function fetchChats(
  unipileAccountId: string,
  since: string,
  limit: number
): Promise<UnipileConversation[]> {
  try {
    const { items } = await unipileGet<{ items: UnipileConversation[] }>(
      `/accounts/${unipileAccountId}/chats`,
      {
        since,
        limit,
      }
    );
    return items || [];
  } catch (err: any) {
    // Fallback if path not supported
    logger.warn(`[LinkedIn Messaging] Fallback to /chats?account_id after error: ${err.message}`);
    const { items } = await unipileGet<{ items: UnipileConversation[] }>(
      `/chats`,
      {
        account_id: unipileAccountId,
        since,
        limit,
      }
    );
    return items || [];
  }
}

/**
 * Fetch chat messages with fallback paths
 * Primary: /accounts/{id}/chats/{chatId}/messages
 * Fallback: /chats/{chatId}/messages?account_id={id}
 */
async function fetchChatMessages(
  unipileAccountId: string,
  chatId: string,
  since: string,
  limit: number
): Promise<UnipileMessage[]> {
  try {
    const { items } = await unipileGet<{ items: UnipileMessage[] }>(
      `/accounts/${unipileAccountId}/chats/${chatId}/messages`,
      {
        since,
        limit,
      }
    );
    return items || [];
  } catch (err: any) {
    logger.warn(
      `[LinkedIn Messaging] Fallback to /chats/${chatId}/messages?account_id after error: ${err.message}`
    );
    const { items } = await unipileGet<{ items: UnipileMessage[] }>(
      `/chats/${chatId}/messages`,
      {
        account_id: unipileAccountId,
        since,
        limit,
      }
    );
    return items || [];
  }
}

/**
 * Initial sync: Import last N days of LinkedIn DMs
 */
export async function initialSyncLastNDays(
  workspaceId: string,
  accountId: string
): Promise<{ conversations: number; messages: number }> {
  try {
    logger.info(`[LinkedIn Messaging] Starting initial sync for account ${accountId}`);

    // Get account details
    const { data: account, error: accountError } = await supabaseAdmin
      .from('connected_accounts')
      .select('unipile_account_id, account_name')
      .eq('id', accountId)
      .single();

    if (accountError || !account || !account.unipile_account_id) {
      throw new Error('Account not found or missing Unipile account ID');
    }

    // Calculate since timestamp (N days ago)
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - LINKEDIN_INITIAL_SYNC_DAYS);
    const sinceTimestamp = sinceDate.toISOString();

    logger.info(`[LinkedIn Messaging] Syncing messages since ${sinceTimestamp}`);

    // Mark sync as in progress
    await supabaseAdmin
      .from('connected_accounts')
      .update({ sync_status: 'syncing', sync_error: null })
      .eq('id', accountId);

    // Fetch conversations (chats) from Unipile with fallback
    const conversations = await fetchChats(account.unipile_account_id, sinceTimestamp, 100);

    logger.info(`[LinkedIn Messaging] Found ${conversations.length} conversations`);

    let conversationCount = 0;
    let messageCount = 0;

    // Process each conversation
    for (const conv of conversations) {
      try {
        // Upsert conversation
        const conversationId = await upsertConversation(accountId, workspaceId, conv);

        // Fetch messages for this conversation
        const messages = await fetchChatMessages(
          account.unipile_account_id,
          conv.id,
          sinceTimestamp,
          100
        );

        // Upsert messages
        const inserted = await upsertMessages(conversationId, workspaceId, accountId, messages);
        messageCount += inserted;

        conversationCount++;
      } catch (error: any) {
        logger.error(`[LinkedIn Messaging] Failed to process conversation ${conv.id}:`, error);
      }
    }

    // Mark sync as complete
    await supabaseAdmin
      .from('connected_accounts')
      .update({
        sync_status: 'success',
        last_synced_at: new Date().toISOString(),
        sync_error: null,
      })
      .eq('id', accountId);

    logger.info(
      `[LinkedIn Messaging] Initial sync complete: ${conversationCount} conversations, ${messageCount} messages`
    );

    return { conversations: conversationCount, messages: messageCount };
  } catch (error: any) {
    logger.error('[LinkedIn Messaging] Initial sync failed:', error);

    // Mark sync as failed
    await supabaseAdmin
      .from('connected_accounts')
      .update({
        sync_status: 'error',
        sync_error: error.message,
      })
      .eq('id', accountId);

    throw new Error(`Initial sync failed: ${error.message}`);
  }
}

/**
 * Incremental sync: Fetch only new messages since last sync
 */
export async function syncNewMessagesFromUnipile(
  workspaceId: string,
  accountId: string
): Promise<{ conversations: number; messages: number }> {
  try {
    logger.info(`[LinkedIn Messaging] Starting incremental sync for account ${accountId}`);

    // Get account details
    const { data: account, error: accountError } = await supabaseAdmin
      .from('connected_accounts')
      .select('unipile_account_id, last_synced_at')
      .eq('id', accountId)
      .single();

    if (accountError || !account || !account.unipile_account_id) {
      throw new Error('Account not found or missing Unipile account ID');
    }

    // Get last sync timestamp or fallback to 24 hours ago
    let sinceTimestamp: string;
    if (account.last_synced_at) {
      sinceTimestamp = new Date(account.last_synced_at).toISOString();
    } else {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      sinceTimestamp = yesterday.toISOString();
    }

    logger.info(`[LinkedIn Messaging] Syncing messages since ${sinceTimestamp}`);

    // Fetch new conversations with fallback
    const conversations = await fetchChats(account.unipile_account_id, sinceTimestamp, 50);

    let conversationCount = 0;
    let messageCount = 0;

    for (const conv of conversations) {
      try {
        const conversationId = await upsertConversation(accountId, workspaceId, conv);

        // Fetch new messages with fallback
        const messages = await fetchChatMessages(
          account.unipile_account_id,
          conv.id,
          sinceTimestamp,
          50
        );

        const inserted = await upsertMessages(conversationId, workspaceId, accountId, messages);
        messageCount += inserted;
        conversationCount++;
      } catch (error: any) {
        logger.error(`[LinkedIn Messaging] Failed to sync conversation ${conv.id}:`, error);
      }
    }

    // Update last sync timestamp
    await supabaseAdmin
      .from('connected_accounts')
      .update({
        last_synced_at: new Date().toISOString(),
        sync_status: 'success',
      })
      .eq('id', accountId);

    logger.info(
      `[LinkedIn Messaging] Incremental sync complete: ${conversationCount} conversations, ${messageCount} messages`
    );

    return { conversations: conversationCount, messages: messageCount };
  } catch (error: any) {
    logger.error('[LinkedIn Messaging] Incremental sync failed:', error);
    throw new Error(`Incremental sync failed: ${error.message}`);
  }
}

/**
 * Send a LinkedIn message
 */
export async function sendLinkedInMessage(
  conversationId: string,
  accountId: string,
  body: string,
  attachments?: { url: string; name: string }[]
): Promise<{ messageId: string; warning?: string }> {
  try {
    logger.info(`[LinkedIn Messaging] Sending message in conversation ${conversationId}`);

    // Check DM quota before sending
    const quotaCheck = await checkAndConsumeDmQuota(accountId, 1);
    if (!quotaCheck.allowed) {
      throw new Error(quotaCheck.error || 'Daily DM limit reached');
    }

    // Get conversation and account details
    const { data: conversation, error: convError } = await supabaseAdmin
      .from('conversations')
      .select('external_conversation_id, workspace_id')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      throw new Error('Conversation not found');
    }

    const { data: account, error: accountError } = await supabaseAdmin
      .from('connected_accounts')
      .select('unipile_account_id')
      .eq('id', accountId)
      .single();

    if (accountError || !account || !account.unipile_account_id) {
      throw new Error('Account not found or missing Unipile account ID');
    }

    // Send message via Unipile
    const sendRequest: UnipileSendMessageRequest = {
      account_id: account.unipile_account_id,
      conversation_id: conversation.external_conversation_id,
      text: body,
      attachments,
    };

    const response = await unipilePost<UnipileSendMessageResponse>(
      `/accounts/${account.unipile_account_id}/chats/${conversation.external_conversation_id}/messages`,
      sendRequest
    );

    // Store message in our database
    await supabaseAdmin.from('messages').insert({
      conversation_id: conversationId,
      workspace_id: conversation.workspace_id,
      provider: 'linkedin',
      external_message_id: response.message_id,
      direction: 'outgoing',
      sender_id: accountId,
      sender_name: 'Me',
      content: body,
      attachments: attachments ? JSON.stringify(attachments) : null,
      created_at: response.created_at,
    });

    logger.info(`[LinkedIn Messaging] Message sent successfully: ${response.message_id}`);

    return {
      messageId: response.message_id,
      warning: quotaCheck.warn ? 'You are approaching your daily DM limit' : undefined,
    };
  } catch (error: any) {
    logger.error('[LinkedIn Messaging] Failed to send message:', error);
    throw new Error(`Failed to send LinkedIn message: ${error.message}`);
  }
}

/**
 * Helper: Upsert conversation
 */
async function upsertConversation(
  accountId: string,
  workspaceId: string,
  conv: UnipileConversation
): Promise<string> {
  // Check if conversation exists
  const { data: existing } = await supabaseAdmin
    .from('conversations')
    .select('id')
    .eq('external_conversation_id', conv.id)
    .eq('workspace_id', workspaceId)
    .single();

  if (existing) {
    // Update existing
    await supabaseAdmin
      .from('conversations')
      .update({
        preview: conv.last_message?.text || '',
        is_read: false,
      })
      .eq('id', existing.id);

    return existing.id;
  } else {
    // Create new
    const participantNames = (conv.participants || [])
      .map((p) => p.name || '')
      .filter(Boolean)
      .join(', ') || 'Unknown';

    const { data, error } = await supabaseAdmin
      .from('conversations')
      .insert({
        workspace_id: workspaceId,
        received_on_account_id: accountId,
        provider: 'linkedin',
        external_conversation_id: conv.id,
        preview: conv.last_message?.text || '',
        is_read: false,
        participant_name: participantNames,
        participant_email: null, // LinkedIn doesn't expose emails in DMs
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }
}

/**
 * Helper: Upsert messages
 */
async function upsertMessages(
  conversationId: string,
  workspaceId: string,
  accountId: string,
  messages: UnipileMessage[]
): Promise<number> {
  let insertedCount = 0;

  for (const msg of messages) {
    // Check if message already exists
    const { data: existing } = await supabaseAdmin
      .from('messages')
      .select('id')
      .eq('external_message_id', msg.id)
      .single();

    if (existing) {
      continue; // Skip if already exists
    }

    // Insert new message
    const { error } = await supabaseAdmin.from('messages').insert({
      conversation_id: conversationId,
      workspace_id: workspaceId,
      provider: 'linkedin',
      external_message_id: msg.id,
      direction: msg.is_from_me ? 'outgoing' : 'incoming',
      sender_id: msg.is_from_me ? accountId : msg.sender.id,
      sender_name: msg.sender.name,
      content: msg.text,
      attachments: msg.attachments ? JSON.stringify(msg.attachments) : null,
      created_at: msg.created_at,
    });

    if (!error) {
      insertedCount++;
    }
  }

  return insertedCount;
}
