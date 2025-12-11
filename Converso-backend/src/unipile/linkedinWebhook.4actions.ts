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
import { sendSseEvent } from '../utils/sse';

// ===== TYPES =====

interface WebhookEvent {
  type: 'message.created' | 'message.updated' | 'chat.updated' | 
        'message.received' | 'message_received' | 'message.new' | 'message_new' |
        'message.read' | 'message.delivered' | 'message.reaction' | 
        'message.deleted' | 'message_read' | 'message_delivered' | 
        'message_reaction' | 'message_delete' | string;
  chat_id?: string;
  account_id?: string;
  message_id?: string;
  last_message_timestamp?: string;
  timestamp?: string;
  // For reaction events
  reaction?: {
    emoji?: string;
    type?: string;
    user_id?: string;
  };
  // For message content (some events include full message)
  message?: {
    id: string;
    chat_id?: string;
    account_id?: string;
    text?: string;
    reactions?: any[];
  };
  attendees?: EventAttendee[];
  sender?: EventAttendee;
}

interface EventAttendee {
  attendee_id?: string;
  attendee_provider_id?: string;
  attendee_name?: string;
  attendee_profile_url?: string;
  attendee_specifics?: {
    member_urn?: string | null;
    [key: string]: any;
  };
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

async function provisionConnectedAccount(unipileAccountId: string) {
  try {
    const { data: templateAccount } = await supabaseAdmin
      .from('connected_accounts')
      .select('user_id, workspace_id')
      .eq('account_type', 'linkedin')
      .limit(1)
      .single();

    if (!templateAccount?.user_id) {
      logger.error('[Webhook] Cannot auto-provision connected account - no template account found');
      return null;
    }

    const { data: newAccount, error } = await supabaseAdmin
      .from('connected_accounts')
      .insert({
        account_name: `LinkedIn Account ${unipileAccountId}`,
        account_email: null,
        account_type: 'linkedin',
        is_active: true,
        user_id: templateAccount.user_id,
        workspace_id: templateAccount.workspace_id || null,
        unipile_account_id: unipileAccountId,
      })
      .select('id, workspace_id')
      .single();

    if (error || !newAccount) {
      logger.error('[Webhook] Failed to auto-provision connected account', error);
      return null;
    }

    logger.info(`[Webhook] Auto-provisioned connected account ${newAccount.id} for unipile_account_id ${unipileAccountId}`);
    return newAccount;
  } catch (err) {
    logger.error('[Webhook] Error auto-provisioning connected account', err);
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
  workspaceId: string | null,
  payloadAttendee?: EventAttendee
): Promise<{ conversationId: string; senderName: string; senderLinkedinUrl: string | null }> {
  const conversationId = deterministicId(`chat-${chatId}`);

  // Check if conversation already exists
  const { data: existingConvo } = await supabaseAdmin
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single();

  if (existingConvo) {
    if (
      payloadAttendee &&
      (!existingConvo.sender_name || existingConvo.sender_name === 'LinkedIn Contact')
    ) {
      const updates: Record<string, any> = {
        sender_name: payloadAttendee.attendee_name || existingConvo.sender_name,
      };
      if (payloadAttendee.attendee_profile_url) {
        updates.sender_linkedin_url = payloadAttendee.attendee_profile_url;
      } else if (payloadAttendee.attendee_specifics?.member_urn) {
        updates.sender_linkedin_url = `https://www.linkedin.com/in/${
          payloadAttendee.attendee_specifics.member_urn.split(':').pop() || ''
        }`;
      }
      await supabaseAdmin
        .from('conversations')
        .update(updates)
        .eq('id', conversationId);
      return {
        conversationId,
        senderName: updates.sender_name || existingConvo.sender_name || 'LinkedIn Contact',
        senderLinkedinUrl: updates.sender_linkedin_url || existingConvo.sender_linkedin_url || null,
      };
    }
    // Conversation exists - return cached sender data
    return {
      conversationId,
      senderName: existingConvo.sender_name || 'LinkedIn Contact',
      senderLinkedinUrl: existingConvo.sender_linkedin_url || null,
    };
  }

  // Conversation doesn't exist - create it with full enrichment
  logger.info(`[Webhook] Creating new conversation for chat ${chatId}`);

  let payloadAttendeeId =
    payloadAttendee?.attendee_provider_id || payloadAttendee?.attendee_id || null;
  let senderName = payloadAttendee?.attendee_name || 'LinkedIn Contact';
  let senderLinkedinUrl =
    payloadAttendee?.attendee_profile_url ||
    (payloadAttendee?.attendee_specifics?.member_urn
      ? `https://www.linkedin.com/in/${
          payloadAttendee.attendee_specifics.member_urn.split(':').pop() || ''
        }`
      : null);
  let senderProfilePictureUrl: string | null =
    (payloadAttendee as any)?.attendee_profile_picture_url || null;
  let linkedinSenderId: string | null = payloadAttendee?.attendee_provider_id || null;
  let providerMemberUrn: string | null = payloadAttendee?.attendee_specifics?.member_urn || null;

  try {
    // Fetch chat details
    const chat = await unipileGet<Chat>(
      `/chats/${encodeURIComponent(chatId)}?account_id=${encodeURIComponent(unipileAccountId)}`
    );

    const fetchedAttendeeId = chat.attendee_provider_id;
    if (fetchedAttendeeId) {
      payloadAttendeeId = fetchedAttendeeId;
    }

    // Enrich sender details if we have an attendee ID
    if (payloadAttendeeId) {
      const attendee = await getAttendeeDetails(payloadAttendeeId, unipileAccountId);

      if (attendee) {
        senderName = attendee.name || attendee.display_name || senderName;

        // Build LinkedIn URL
        if (attendee.profile_url) {
          senderLinkedinUrl = attendee.profile_url;
        } else if (attendee.public_identifier) {
          senderLinkedinUrl = `https://www.linkedin.com/in/${attendee.public_identifier}`;
        }

        linkedinSenderId = attendee.provider_id || linkedinSenderId;
        providerMemberUrn = attendee.specifics?.member_urn || providerMemberUrn;

        // Fetch profile picture
        senderProfilePictureUrl =
          (await getAttendeePicture(payloadAttendeeId, unipileAccountId)) || senderProfilePictureUrl;
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
        sender_attendee_id: payloadAttendeeId || null,
        sender_name: senderName,
        sender_linkedin_url: senderLinkedinUrl,
        sender_profile_picture_url: senderProfilePictureUrl,
        linkedin_sender_id: linkedinSenderId,
        provider_member_urn: providerMemberUrn,
        last_message_at: chat.timestamp || chat.updated_at || new Date().toISOString(),
        subject: chat.title || null,
        created_at: new Date().toISOString(),
        initial_sync_done: false,
        sender_enriched: !!payloadAttendeeId,
        picture_enriched: !!payloadAttendeeId,
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
        sender_attendee_id: payloadAttendeeId || null,
        sender_name: senderName,
        sender_linkedin_url: senderLinkedinUrl,
        last_message_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        initial_sync_done: false,
        sender_enriched: !!payloadAttendeeId,
        picture_enriched: false,
      },
      { onConflict: 'id' }
    );

    return {
      conversationId,
      senderName,
      senderLinkedinUrl,
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
    const baseQuery = new URLSearchParams({
      account_id: unipileAccountId,
      limit: '10',
    });

    const withFromQuery = new URLSearchParams(baseQuery);
    if (fromTimestamp) {
      withFromQuery.append('from', fromTimestamp);
    }

    let messagesResponse = await unipileGet<MessageList>(
      `/chats/${encodeURIComponent(chatId)}/messages?${withFromQuery.toString()}`
    );

    let messages = messagesResponse.items || [];

    // Fallback: if no messages returned (Unipile may require without "from"), fetch latest without filter
    if (messages.length === 0 && fromTimestamp) {
      const fallbackResponse = await unipileGet<MessageList>(
        `/chats/${encodeURIComponent(chatId)}/messages?${baseQuery.toString()}`
      );
      messages = fallbackResponse.items || [];
    }
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

    // Update conversation's last_message_at (and optionally unread state)
    if (messages.length > 0) {
      const latestTimestamp =
        messages.map(safeTimestamp).filter(Boolean).sort().pop() || new Date().toISOString();

      const hasLeadMessages = messages.some((msg) => !msg.is_sender);

      const updatePayload: Record<string, any> = {
        last_message_at: latestTimestamp,
      };

      if (hasLeadMessages) {
        updatePayload.is_read = false;
      }

      await supabaseAdmin
        .from('conversations')
        .update(updatePayload)
        .eq('id', conversationId);

      if (hasLeadMessages) {
        logger.info(`[Webhook] Marked conversation ${conversationId} as unread (new messages synced)`);
      }
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

  const chatId =
    event.chat_id ||
    event.message?.chat_id ||
    event.message?.provider_chat_id ||
    event.provider_chat_id;

  const accountId =
    event.account_id ||
    event.message?.account_id ||
    event.account_id; // fallback

  const eventType = event.type || (event as any)?.event || 'unknown';

  if (!chatId || !accountId) {
    logger.warn('[Webhook] Missing chat_id or account_id', { event });
    return res.status(400).json({ error: 'Missing chat_id or account_id' });
  }

  logger.info('[Webhook] Received event', {
    type: eventType,
    chat_id: chatId,
    account_id: accountId,
  });

  try {
    // Find the connected account
    let connectedAccountId: string | null = null;
    let workspaceId: string | null = null;

    const { data: account, error: accountError } = await supabaseAdmin
      .from('connected_accounts')
      .select('id, workspace_id')
      .eq('account_type', 'linkedin')
      .eq('unipile_account_id', accountId)
      .single();

    if (accountError || !account) {
      logger.warn(`[Webhook] Connected account not found for unipile_account_id: ${accountId}. Attempting fallback via chat_id=${chatId}`);

      if (chatId) {
        const { data: fallbackConversation } = await supabaseAdmin
          .from('conversations')
          .select('received_on_account_id, workspace_id')
          .eq('conversation_type', 'linkedin')
          .eq('chat_id', chatId)
          .single();

        if (fallbackConversation?.received_on_account_id) {
          connectedAccountId = fallbackConversation.received_on_account_id;
          workspaceId = fallbackConversation.workspace_id || null;
          logger.info(`[Webhook] Fallback connected account ${connectedAccountId} resolved via conversation chat_id=${chatId}`);
        } else {
          logger.warn(`[Webhook] Fallback failed: conversation with chat_id ${chatId} not found or missing received_on_account_id`);
          const provisioned = await provisionConnectedAccount(accountId);
          if (provisioned) {
            connectedAccountId = provisioned.id;
            workspaceId = provisioned.workspace_id || null;
          } else {
            return res.status(404).json({ error: 'Connected account not found' });
          }
        }
      } else {
        const provisioned = await provisionConnectedAccount(accountId);
        if (provisioned) {
          connectedAccountId = provisioned.id;
          workspaceId = provisioned.workspace_id || null;
        } else {
          return res.status(404).json({ error: 'Connected account not found' });
        }
      }
    } else {
      connectedAccountId = account.id;
      workspaceId = account.workspace_id || null;
    }

    // Handle different event types
    switch (eventType) {
      case 'message.created':
      case 'message.updated':
      case 'message.received':
      case 'message_received':
      case 'message.new':
      case 'message_new':
      case 'chat.updated': {
        const payloadLeadAttendee =
          event.attendees?.find(
            (att) => att.attendee_provider_id && att.attendee_provider_id !== event.sender?.attendee_provider_id
          ) || event.attendees?.[0];

        // Ensure conversation exists and get sender info
        const { conversationId, senderName, senderLinkedinUrl } = await ensureConversationExists(
          chatId,
          accountId,
          connectedAccountId,
          workspaceId,
          payloadLeadAttendee
        );

        // Sync messages (incremental if timestamp provided)
        const syncedCount = await syncChatMessages(
          chatId,
          accountId,
          conversationId,
          senderName,
          senderLinkedinUrl,
          event.last_message_timestamp || event.timestamp
        );

        logger.info(`[Webhook] Synced ${syncedCount} messages for chat ${chatId}`);
        if (syncedCount > 0) {
          sendSseEvent('linkedin_message', {
            chat_id: chatId,
            account_id: accountId,
            conversation_id: conversationId,
            timestamp: event.timestamp || new Date().toISOString(),
          });
        }
        break;
      }

      // Handle message delivered event
      case 'message.delivered':
      case 'message_delivered': {
        const messageId = event.message_id || event.message?.id;
        if (messageId) {
          const dbMessageId = deterministicId(`msg-${messageId}`);
          const { error } = await supabaseAdmin
            .from('messages')
            .update({ delivery_status: 'delivered' })
            .eq('id', dbMessageId);

          if (error) {
            logger.error(`[Webhook] Failed to update delivery status for message ${messageId}`, error);
          } else {
            logger.info(`[Webhook] Message ${messageId} marked as delivered`);
          }
        } else {
          logger.warn('[Webhook] message.delivered event missing message_id');
        }
        break;
      }

      // Handle message read event
      case 'message.read':
      case 'message_read': {
        const messageId = event.message_id || event.message?.id;
        if (messageId) {
          const dbMessageId = deterministicId(`msg-${messageId}`);
          const { error } = await supabaseAdmin
            .from('messages')
            .update({ delivery_status: 'read' })
            .eq('id', dbMessageId);

          if (error) {
            logger.error(`[Webhook] Failed to update read status for message ${messageId}`, error);
          } else {
            logger.info(`[Webhook] Message ${messageId} marked as read`);
          }
        } else {
          // If no specific message_id, mark the conversation as read
        const conversationId = deterministicId(`chat-${chatId}`);
          await supabaseAdmin
            .from('conversations')
            .update({ is_read: true })
            .eq('id', conversationId);
          logger.info(`[Webhook] Conversation ${chatId} marked as read`);
        }
        break;
      }

      // Handle message reaction event
      case 'message.reaction':
      case 'message_reaction': {
        const messageId = event.message_id || event.message?.id;
        if (messageId) {
          const dbMessageId = deterministicId(`msg-${messageId}`);
          
          // Get existing reactions and append new one
          const { data: existingMessage } = await supabaseAdmin
            .from('messages')
            .select('reactions')
            .eq('id', dbMessageId)
            .single();

          const existingReactions = existingMessage?.reactions || [];
          const newReaction = event.reaction || event.message?.reactions?.[0];
          
          let updatedReactions = existingReactions;
          if (newReaction) {
            updatedReactions = [...existingReactions, newReaction];
          } else if (event.message?.reactions) {
            updatedReactions = event.message.reactions;
          }

          const { error } = await supabaseAdmin
            .from('messages')
            .update({ reactions: updatedReactions })
            .eq('id', dbMessageId);

          if (error) {
            logger.error(`[Webhook] Failed to update reactions for message ${messageId}`, error);
          } else {
            logger.info(`[Webhook] Reactions updated for message ${messageId}`);
          }
        } else {
          logger.warn('[Webhook] message.reaction event missing message_id');
        }
        break;
      }

      // Handle message delete event
      case 'message.deleted':
      case 'message_delete': {
        const messageId = event.message_id || event.message?.id;
        if (messageId) {
          const dbMessageId = deterministicId(`msg-${messageId}`);
          
          // Soft delete - mark as deleted rather than removing
          const { error } = await supabaseAdmin
            .from('messages')
            .update({ 
              content: '[Message deleted]',
              is_deleted: true 
            })
            .eq('id', dbMessageId);

          if (error) {
            logger.error(`[Webhook] Failed to mark message ${messageId} as deleted`, error);
          } else {
            logger.info(`[Webhook] Message ${messageId} marked as deleted`);
          }
        } else {
          logger.warn('[Webhook] message.deleted event missing message_id');
        }
        break;
      }

      default:
        logger.info(`[Webhook] Unhandled event type: ${event.type} - acknowledging receipt`);
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
