/**
 * LinkedIn Webhook Handler - Incremental Sync
 * 
 * Handles webhook events for new LinkedIn messages
 * Uses the 4-action approach for incremental updates
 */

import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { supabaseAdmin } from '../lib/supabase';
import { unipileGet } from './unipileClient';
import crypto from 'crypto';

// ===== TYPES =====

interface WebhookEvent {
  type: 'message.created' | 'message.updated' | 'chat.updated' | string;
  chat_id?: string;
  account_id?: string;
  message_id?: string;
  last_message_timestamp?: string;
  timestamp?: string;
}

interface ChatAttendee {
  id: string;
  name?: string | null;
  display_name?: string | null;
  profile_url?: string | null;
  provider_id?: string | null;
  public_identifier?: string | null;
  specifics?: {
    member_urn?: string | null;
  };
  is_self?: boolean | number | string;
}

interface Message {
  id: string;
  chat_id: string;
  text?: string | null;
  body_text?: string | null;
  timestamp?: string | null;
  datetime?: string | null;
  date?: string | null;
  is_sender?: boolean;
  sender_attendee_id?: string | null;
  sender_id?: string | null;
  attachments?: any[];
  reactions?: any[];
}

interface MessageList {
  items: Message[];
  cursor?: string | null;
}

interface Chat {
  id: string;
  account_id: string;
  attendee_provider_id?: string | null;
  timestamp?: string | null;
  updated_at?: string | null;
  title?: string | null;
}

interface AttendeeProfilePicture {
  url?: string | null;
  picture?: string | null;
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

function safeTimestamp(msg: Message): string | null {
  return msg.timestamp || msg.datetime || msg.date || null;
}

// In-memory cache for attendee details (to avoid repeated API calls)
const attendeeCache = new Map<string, ChatAttendee>();

/**
 * Get or fetch attendee details
 */
async function getAttendeeDetails(
  attendeeId: string,
  unipileAccountId?: string
): Promise<ChatAttendee | null> {
  // Check cache first
  if (attendeeCache.has(attendeeId)) {
    return attendeeCache.get(attendeeId)!;
  }

  try {
    const attendee = await unipileGet<ChatAttendee>(
      `/chat_attendees/${encodeURIComponent(attendeeId)}${
        unipileAccountId ? `?account_id=${encodeURIComponent(unipileAccountId)}` : ''
      }`
    );

    // Cache the result
    attendeeCache.set(attendeeId, attendee);
    return attendee;
  } catch (err) {
    logger.error(`[Webhook] Failed to fetch attendee ${attendeeId}`, err);
    return null;
  }
}

/**
 * Get or fetch profile picture
 */
async function getAttendeePicture(
  attendeeId: string,
  unipileAccountId?: string
): Promise<string | null> {
  try {
    const pictureResponse = await unipileGet<AttendeeProfilePicture>(
      `/chat_attendees/${encodeURIComponent(attendeeId)}/picture${
        unipileAccountId ? `?account_id=${encodeURIComponent(unipileAccountId)}` : ''
      }`
    );

    return pictureResponse?.url || pictureResponse?.picture || null;
  } catch (err) {
    logger.warn(`[Webhook] Failed to fetch picture for attendee ${attendeeId}`);
    return null;
  }
}

/**
 * Ensure conversation exists and is enriched
 */
async function ensureConversationExists(
  chatId: string,
  unipileAccountId: string,
  connectedAccountId: string,
  workspaceId: string | null
): Promise<{ conversationId: string; senderName: string; senderLinkedinUrl: string | null }> {
  const conversationId = deterministicId(`chat-${chatId}`);

  // Check if conversation already exists
  const { data: existingConvo } = await supabaseAdmin
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single();

  if (existingConvo) {
    // Conversation exists - return cached sender data
    return {
      conversationId,
      senderName: existingConvo.sender_name || 'LinkedIn Contact',
      senderLinkedinUrl: existingConvo.sender_linkedin_url || null,
    };
  }

  // Conversation doesn't exist - create it with full enrichment
  logger.info(`[Webhook] Creating new conversation for chat ${chatId}`);

  try {
    // Fetch chat details
    const chat = await unipileGet<Chat>(
      `/chats/${encodeURIComponent(chatId)}?account_id=${encodeURIComponent(unipileAccountId)}`
    );

    const senderAttendeeId = chat.attendee_provider_id;
    let senderName = 'LinkedIn Contact';
    let senderLinkedinUrl: string | null = null;
    let senderProfilePictureUrl: string | null = null;
    let linkedinSenderId: string | null = null;
    let providerMemberUrn: string | null = null;

    // Enrich sender details if we have an attendee ID
    if (senderAttendeeId) {
      const attendee = await getAttendeeDetails(senderAttendeeId, unipileAccountId);

      if (attendee) {
        senderName = attendee.name || attendee.display_name || 'LinkedIn Contact';
        
        // Build LinkedIn URL
        if (attendee.profile_url) {
          senderLinkedinUrl = attendee.profile_url;
        } else if (attendee.public_identifier) {
          senderLinkedinUrl = `https://www.linkedin.com/in/${attendee.public_identifier}`;
        }

        linkedinSenderId = attendee.provider_id || null;
        providerMemberUrn = attendee.specifics?.member_urn || null;

        // Fetch profile picture
        senderProfilePictureUrl = await getAttendeePicture(senderAttendeeId, unipileAccountId);
      }
    }

    // Create conversation with all enriched data
    await supabaseAdmin.from('conversations').upsert(
      {
        id: conversationId,
        conversation_type: 'linkedin',
        provider: 'linkedin',
        chat_id: chatId,
        received_on_account_id: connectedAccountId,
        workspace_id: workspaceId,
        sender_attendee_id: senderAttendeeId || null,
        sender_name: senderName,
        sender_linkedin_url: senderLinkedinUrl,
        sender_profile_picture_url: senderProfilePictureUrl,
        linkedin_sender_id: linkedinSenderId,
        provider_member_urn: providerMemberUrn,
        last_message_at: chat.timestamp || chat.updated_at || new Date().toISOString(),
        subject: chat.title || null,
        created_at: new Date().toISOString(),
        initial_sync_done: false,
        sender_enriched: !!senderAttendeeId,
        picture_enriched: !!senderAttendeeId,
      },
      { onConflict: 'id' }
    );

    return {
      conversationId,
      senderName,
      senderLinkedinUrl,
    };
  } catch (err) {
    logger.error(`[Webhook] Failed to create/enrich conversation for chat ${chatId}`, err);
    
    // Create minimal conversation record
    await supabaseAdmin.from('conversations').upsert(
      {
        id: conversationId,
        conversation_type: 'linkedin',
        provider: 'linkedin',
        chat_id: chatId,
        received_on_account_id: connectedAccountId,
        workspace_id: workspaceId,
        sender_name: 'LinkedIn Contact',
        last_message_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        initial_sync_done: false,
        sender_enriched: false,
        picture_enriched: false,
      },
      { onConflict: 'id' }
    );

    return {
      conversationId,
      senderName: 'LinkedIn Contact',
      senderLinkedinUrl: null,
    };
  }
}

/**
 * Sync messages incrementally for a chat
 */
async function syncChatMessages(
  chatId: string,
  unipileAccountId: string,
  conversationId: string,
  conversationSenderName: string,
  conversationSenderLinkedinUrl: string | null,
  fromTimestamp?: string
): Promise<number> {
  try {
    // Fetch messages
    const messagesResponse = await unipileGet<MessageList>(
      `/chats/${encodeURIComponent(chatId)}/messages${
        fromTimestamp ? `?from=${encodeURIComponent(fromTimestamp)}` : ''
      }&account_id=${encodeURIComponent(unipileAccountId)}`
    );

    const messages = messagesResponse.items || [];
    logger.info(`[Webhook] Found ${messages.length} new messages for chat ${chatId}`);

    let syncedCount = 0;

    // Process each message
    for (const message of messages) {
      try {
        // Determine sender info
        let senderName: string;
        let senderLinkedinUrl: string | null = null;
        let senderAttendeeId: string | null = message.sender_attendee_id || message.sender_id || null;

        if (message.is_sender) {
          // Message from self (account owner)
          senderName = 'You';
        } else {
          // Message from lead - use conversation's sender data
          senderName = conversationSenderName;
          senderLinkedinUrl = conversationSenderLinkedinUrl;
        }

        // Ensure sender_name is never null
        if (!senderName) {
          senderName = 'LinkedIn Contact';
        }

        const messageId = deterministicId(`msg-${message.id}`);
        const createdAt = safeTimestamp(message) || new Date().toISOString();

        // Insert message
        const { error } = await supabaseAdmin.from('messages').upsert(
          {
            id: messageId,
            conversation_id: conversationId,
            message_type: 'linkedin',
            linkedin_message_id: message.id,
            sender_attendee_id: senderAttendeeId,
            sender_name: senderName,
            sender_linkedin_url: senderLinkedinUrl,
            content: message.text || message.body_text || '',
            created_at: createdAt,
            is_from_lead: !message.is_sender,
            attachments: message.attachments || null,
            reactions: message.reactions || null,
            provider: 'linkedin',
          },
          { onConflict: 'linkedin_message_id' }
        );

        if (error) {
          logger.error(`[Webhook] Failed to insert message ${message.id}`, error);
        } else {
          syncedCount++;
        }
      } catch (err) {
        logger.error(`[Webhook] Error processing message ${message.id}`, err);
      }
    }

    // Update conversation's last_message_at
    if (messages.length > 0) {
      const latestTimestamp =
        messages.map(safeTimestamp).filter(Boolean).sort().pop() || new Date().toISOString();

      await supabaseAdmin
        .from('conversations')
        .update({ last_message_at: latestTimestamp })
        .eq('id', conversationId);
    }

    return syncedCount;
  } catch (err) {
    logger.error(`[Webhook] Failed to sync messages for chat ${chatId}`, err);
    return 0;
  }
}

/**
 * Main webhook handler
 */
export async function handleLinkedInWebhook(req: Request, res: Response) {
  const event = req.body as WebhookEvent;

  if (!event.chat_id || !event.account_id) {
    logger.warn('[Webhook] Missing chat_id or account_id');
    return res.status(400).json({ error: 'Missing chat_id or account_id' });
  }

  logger.info('[Webhook] Received event', {
    type: event.type,
    chat_id: event.chat_id,
    account_id: event.account_id,
  });

  try {
    // Find the connected account
    const { data: account, error: accountError } = await supabaseAdmin
      .from('connected_accounts')
      .select('id, workspace_id')
      .eq('account_type', 'linkedin')
      .eq('unipile_account_id', event.account_id)
      .single();

    if (accountError || !account) {
      logger.warn(`[Webhook] Connected account not found for unipile_account_id: ${event.account_id}`);
      return res.status(404).json({ error: 'Connected account not found' });
    }

    const connectedAccountId = account.id;
    const workspaceId = account.workspace_id || null;

    // Handle different event types
    switch (event.type) {
      case 'message.created':
      case 'message.updated':
      case 'chat.updated': {
        // Ensure conversation exists and get sender info
        const { conversationId, senderName, senderLinkedinUrl } = await ensureConversationExists(
          event.chat_id,
          event.account_id,
          connectedAccountId,
          workspaceId
        );

        // Sync messages (incremental if timestamp provided)
        const syncedCount = await syncChatMessages(
          event.chat_id,
          event.account_id,
          conversationId,
          senderName,
          senderLinkedinUrl,
          event.last_message_timestamp || event.timestamp
        );

        logger.info(`[Webhook] Synced ${syncedCount} messages for chat ${event.chat_id}`);
        break;
      }

      default:
        logger.warn(`[Webhook] Unknown event type: ${event.type}`);
    }

    return res.json({ status: 'ok' });
  } catch (err: any) {
    logger.error('[Webhook] Failed processing event', err);
    return res.status(500).json({ error: err.message || 'Failed processing webhook' });
  }
}

/**
 * Verify webhook signature (if using webhook secret)
 */
export function verifyWebhookSignature(req: Request): boolean {
  const signature = req.headers['x-unipile-signature'] as string;
  const webhookSecret = process.env.UNIPILE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    // If no secret configured, skip verification
    logger.warn('[Webhook] No UNIPILE_WEBHOOK_SECRET configured - skipping signature verification');
    return true;
  }

  if (!signature) {
    logger.warn('[Webhook] No signature header found');
    return false;
  }

  try {
    const payload = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    return signature === expectedSignature;
  } catch (err) {
    logger.error('[Webhook] Signature verification failed', err);
    return false;
  }
}
