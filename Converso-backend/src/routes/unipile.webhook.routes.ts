/**
 * Unipile Webhook Handler
 * 
 * Endpoint: POST /api/unipile/webhook
 * 
 * Handles all Unipile webhook events:
 * - message_received (new message)
 * - message_read
 * - message_reaction  
 * - message_edit
 * - message_delete
 * - message_delivered
 * 
 * Reference: https://developer.unipile.com/docs/webhooks-2
 */

import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { unipileGet } from '../unipile/unipileClient';
import { logger } from '../utils/logger';
import crypto from 'crypto';

const router = Router();

// ===== TYPES =====

interface WebhookPayload {
  // Common fields
  event?: string;
  type?: string;
  
  // Message events
  message?: {
    id: string;
    chat_id: string;
    account_id: string;
    text?: string;
    body_text?: string;
    timestamp?: string;
    datetime?: string;
    date?: string;
    is_sender?: boolean;
    sender_attendee_id?: string;
    attachments?: any[];
    reactions?: any[];
  };
  
  // Direct fields (alternative format)
  chat_id?: string;
  account_id?: string;
  message_id?: string;
  timestamp?: string;
  
  // Relation events
  relation?: any;
}

interface ChatAttendee {
  id: string;
  name?: string | null;
  display_name?: string | null;
  profile_url?: string | null;
  provider_id?: string | null;
  public_identifier?: string | null;
}

interface MessageList {
  items: Array<{
    id: string;
    chat_id: string;
    text?: string;
    body_text?: string;
    timestamp?: string;
    datetime?: string;
    date?: string;
    is_sender?: boolean;
    sender_attendee_id?: string;
    attachments?: any[];
    reactions?: any[];
  }>;
}

// ===== UTILITIES =====

function deterministicId(seed: string): string {
  const hex = crypto.createHash('sha1').update(seed).digest('hex');
  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    hex.substring(12, 16),
    hex.substring(16, 20),
    hex.substring(20, 32),
  ].join('-');
}

function safeTimestamp(obj: any): string {
  return obj?.timestamp || obj?.datetime || obj?.date || new Date().toISOString();
}

// ===== MAIN WEBHOOK HANDLER =====

router.post('/', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const payload = req.body as WebhookPayload;
    const eventType = payload.event || payload.type || 'unknown';
    
    logger.info('[Unipile Webhook] Received event', {
      event: eventType,
      hasMessage: !!payload.message,
      chat_id: payload.message?.chat_id || payload.chat_id,
      account_id: payload.message?.account_id || payload.account_id,
    });

    // Extract chat_id and account_id from either format
    const chatId = payload.message?.chat_id || payload.chat_id;
    const accountId = payload.message?.account_id || payload.account_id;

    if (!chatId || !accountId) {
      logger.warn('[Unipile Webhook] Missing chat_id or account_id', payload);
      return res.status(200).json({ status: 'ok', message: 'Missing required fields' });
    }

    // Find the connected account
    const { data: account, error: accountError } = await supabaseAdmin
      .from('connected_accounts')
      .select('id, workspace_id')
      .eq('account_type', 'linkedin')
      .eq('unipile_account_id', accountId)
      .single();

    if (accountError || !account) {
      logger.warn(`[Unipile Webhook] Account not found for unipile_account_id: ${accountId}`);
      return res.status(200).json({ status: 'ok', message: 'Account not found' });
    }

    // Handle different event types
    switch (eventType) {
      case 'message_received':
      case 'message.received':
      case 'new_message':
      case 'message.created':
        await handleNewMessage(chatId, accountId, account.id, account.workspace_id, payload);
        break;

      case 'message_delivered':
      case 'message.delivered':
        await handleMessageDelivered(chatId, payload);
        break;

      case 'message_read':
      case 'message.read':
        await handleMessageRead(chatId, payload);
        break;

      case 'message_reaction':
      case 'message.reaction':
        await handleMessageReaction(chatId, payload);
        break;

      case 'message_edit':
      case 'message.edit':
      case 'message.updated':
        await handleMessageEdit(chatId, accountId, account.id, account.workspace_id, payload);
        break;

      case 'message_delete':
      case 'message.delete':
      case 'message.deleted':
        await handleMessageDelete(payload);
        break;

      default:
        logger.info(`[Unipile Webhook] Unhandled event type: ${eventType}`);
    }

    const duration = Date.now() - startTime;
    logger.info(`[Unipile Webhook] Processed in ${duration}ms`);

    // Always return 200 to acknowledge receipt (as per Unipile docs)
    return res.status(200).json({ status: 'ok' });

  } catch (err: any) {
    logger.error('[Unipile Webhook] Error processing webhook', err);
    // Still return 200 to prevent retries for processing errors
    return res.status(200).json({ status: 'error', message: err.message });
  }
});

// ===== EVENT HANDLERS =====

async function handleNewMessage(
  chatId: string,
  unipileAccountId: string,
  connectedAccountId: string,
  workspaceId: string | null,
  payload: WebhookPayload
) {
  logger.info(`[Unipile Webhook] Processing new message for chat ${chatId}`);

  const conversationId = deterministicId(`chat-${chatId}`);

  // Check if conversation exists
  let { data: conversation } = await supabaseAdmin
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single();

  // If conversation doesn't exist, create it with enriched data
  if (!conversation) {
    logger.info(`[Unipile Webhook] Creating new conversation for chat ${chatId}`);
    
    let senderName = 'LinkedIn Contact';
    let senderLinkedinUrl: string | null = null;
    let senderAttendeeId: string | null = null;

    // Try to get sender info from the message
    if (payload.message && !payload.message.is_sender && payload.message.sender_attendee_id) {
      senderAttendeeId = payload.message.sender_attendee_id;
      
      // Fetch attendee details
      try {
        const attendee = await unipileGet<ChatAttendee>(
          `/chat_attendees/${encodeURIComponent(senderAttendeeId)}`
        );
        senderName = attendee.name || attendee.display_name || 'LinkedIn Contact';
        if (attendee.profile_url) {
          senderLinkedinUrl = attendee.profile_url;
        } else if (attendee.public_identifier) {
          senderLinkedinUrl = `https://www.linkedin.com/in/${attendee.public_identifier}`;
        }
      } catch (err) {
        logger.warn(`[Unipile Webhook] Failed to fetch attendee ${senderAttendeeId}`);
      }
    }

    // Create conversation
    const { error: createError } = await supabaseAdmin
      .from('conversations')
      .insert({
        id: conversationId,
        conversation_type: 'linkedin',
        provider: 'linkedin',
        chat_id: chatId,
        received_on_account_id: connectedAccountId,
        workspace_id: workspaceId,
        sender_attendee_id: senderAttendeeId,
        sender_name: senderName,
        sender_linkedin_url: senderLinkedinUrl,
        last_message_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        is_read: false,
        initial_sync_done: false,
        sender_enriched: !!senderAttendeeId,
      });

    if (createError) {
      logger.error('[Unipile Webhook] Failed to create conversation', createError);
    }

    // Fetch conversation again
    const { data: newConvo } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();
    
    conversation = newConvo;
  }

  // Process the message
  if (payload.message) {
    // Direct message in payload
    const message = payload.message;
    
    // Check if message has any content before inserting
    const hasText =
      Boolean(message.text && message.text.trim()) ||
      Boolean(message.body_text && message.body_text.trim());

    const hasAttachments =
      Array.isArray(message.attachments) &&
      message.attachments.length > 0;

    const hasReactions =
      Array.isArray(message.reactions) &&
      message.reactions.length > 0;

    // Skip event-only / empty messages
    if (!hasText && !hasAttachments && !hasReactions) {
      logger.info('[Unipile Webhook] Skipping empty event-only message', {
        messageId: message.id,
        chatId: message.chat_id,
      });
    } else {
      await insertMessage(message, conversationId, conversation);
    }
  } else {
    // Fetch latest messages from Unipile
    try {
      const messagesResponse = await unipileGet<MessageList>(
        `/chats/${encodeURIComponent(chatId)}/messages?account_id=${encodeURIComponent(unipileAccountId)}&limit=10`
      );

      for (const message of messagesResponse.items || []) {
        // Check if message has any content before inserting
        const hasText =
          Boolean(message.text && message.text.trim()) ||
          Boolean(message.body_text && message.body_text.trim());

        const hasAttachments =
          Array.isArray(message.attachments) &&
          message.attachments.length > 0;

        const hasReactions =
          Array.isArray(message.reactions) &&
          message.reactions.length > 0;

        // Skip event-only / empty messages
        if (!hasText && !hasAttachments && !hasReactions) {
          logger.info('[Unipile Webhook] Skipping empty event-only message', {
            messageId: message.id,
            chatId: message.chat_id,
          });
          continue;
        }

        await insertMessage(message, conversationId, conversation);
      }
    } catch (err) {
      logger.error(`[Unipile Webhook] Failed to fetch messages for chat ${chatId}`, err);
    }
  }

  // Update conversation timestamp and mark as unread (new message from lead)
  const isFromLead = payload.message ? !payload.message.is_sender : true;
  
  await supabaseAdmin
    .from('conversations')
    .update({
      last_message_at: safeTimestamp(payload.message || payload),
      is_read: !isFromLead, // Mark unread if from lead
    })
    .eq('id', conversationId);
}

async function insertMessage(
  message: any,
  conversationId: string,
  conversation: any
) {
  const messageId = deterministicId(`msg-${message.id}`);
  
  // Determine sender
  let senderName: string;
  let senderLinkedinUrl: string | null = null;

  if (message.is_sender) {
    senderName = 'You';
  } else {
    senderName = conversation?.sender_name || 'LinkedIn Contact';
    senderLinkedinUrl = conversation?.sender_linkedin_url || null;
  }

  const { error } = await supabaseAdmin
    .from('messages')
    .upsert({
      id: messageId,
      conversation_id: conversationId,
      message_type: 'linkedin',
      linkedin_message_id: message.id,
      sender_attendee_id: message.sender_attendee_id || null,
      sender_name: senderName,
      sender_linkedin_url: senderLinkedinUrl,
      content: message.text || message.body_text || '',
      created_at: safeTimestamp(message),
      is_from_lead: !message.is_sender,
      attachments: message.attachments || null,
      reactions: message.reactions || null,
      provider: 'linkedin',
    }, { onConflict: 'linkedin_message_id' });

  if (error) {
    logger.error(`[Unipile Webhook] Failed to insert message ${message.id}`, error);
  } else {
    logger.info(`[Unipile Webhook] Inserted message ${message.id}`);
  }
}

async function handleMessageDelivered(chatId: string, payload: WebhookPayload) {
  logger.info(`[Unipile Webhook] Message delivered in chat ${chatId}`);
  
  // Update message status if we have message_id
  const messageId = payload.message?.id || payload.message_id;
  if (messageId) {
    const dbMessageId = deterministicId(`msg-${messageId}`);
    await supabaseAdmin
      .from('messages')
      .update({ delivery_status: 'delivered' })
      .eq('id', dbMessageId);
  }
}

async function handleMessageRead(chatId: string, payload: WebhookPayload) {
  logger.info(`[Unipile Webhook] Message read in chat ${chatId}`);
  
  // Update message status
  const messageId = payload.message?.id || payload.message_id;
  if (messageId) {
    const dbMessageId = deterministicId(`msg-${messageId}`);
    await supabaseAdmin
      .from('messages')
      .update({ delivery_status: 'read' })
      .eq('id', dbMessageId);
  }
}

async function handleMessageReaction(chatId: string, payload: WebhookPayload) {
  logger.info(`[Unipile Webhook] Message reaction in chat ${chatId}`);
  
  // Update message reactions if we have message_id
  const messageId = payload.message?.id || payload.message_id;
  if (messageId && payload.message?.reactions) {
    const dbMessageId = deterministicId(`msg-${messageId}`);
    await supabaseAdmin
      .from('messages')
      .update({ reactions: payload.message.reactions })
      .eq('id', dbMessageId);
  }
}

async function handleMessageEdit(
  chatId: string,
  unipileAccountId: string,
  connectedAccountId: string,
  workspaceId: string | null,
  payload: WebhookPayload
) {
  logger.info(`[Unipile Webhook] Message edited in chat ${chatId}`);
  
  // Treat as new message - will upsert and update content
  await handleNewMessage(chatId, unipileAccountId, connectedAccountId, workspaceId, payload);
}

async function handleMessageDelete(payload: WebhookPayload) {
  const messageId = payload.message?.id || payload.message_id;
  
  if (messageId) {
    logger.info(`[Unipile Webhook] Message deleted: ${messageId}`);
    const dbMessageId = deterministicId(`msg-${messageId}`);
    
    // Soft delete - mark as deleted rather than removing
    await supabaseAdmin
      .from('messages')
      .update({ 
        content: '[Message deleted]',
        is_deleted: true 
      })
      .eq('id', dbMessageId);
  }
}

export default router;





