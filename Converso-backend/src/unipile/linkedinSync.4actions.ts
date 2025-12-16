/**
 * LinkedIn Sync Pipeline - 4 Actions Implementation
 * 
 * Action 1: Initial chat download
 * Action 2: Sender attendee details enrichment
 * Action 3: Sender profile picture enrichment
 * Action 4: Messages per chat download
 */

import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../utils/logger';
import { unipileGet } from './unipileClient';
import { UNIPILE_BASE_URL } from '../config/unipile';
import crypto from 'crypto';

// ===== TYPES =====

interface Chat {
  id: string;
  account_id: string;
  attendee_provider_id?: string | null;
  timestamp?: string | null;
  updated_at?: string | null;
  title?: string | null;
}

interface ChatList {
  items: Chat[];
  cursor?: string | null;
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

interface AttendeeProfilePicture {
  url?: string | null;
  picture?: string | null;
  data?: any;
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

// ===== ACTION 1: INITIAL CHAT DOWNLOAD =====

/**
 * Action 1 - Get all chats in account → Supabase conversations
 * 
 * For a given Unipile account_id, call List all chats and store them in 
 * Supabase conversations (including chat_id, sender_attendee_id, timestamps, etc.).
 */
export async function syncLinkedInChatsForAccount(
  connectedAccountId: string,
  unipileAccountId: string,
  options: { days?: number; fullSync?: boolean } = {}
): Promise<{ chatsCount: number; error?: string }> {
  try {
    const days = options.days || 30; // Default to last 30 days
    const fullSync = options.fullSync || false;
    
    logger.info(`[Action 1] Starting chat download for account ${connectedAccountId} (${fullSync ? 'full sync' : `last ${days} days`})`);

    // Get workspace info from connected account
    const { data: account } = await supabaseAdmin
      .from('connected_accounts')
      .select('workspace_id')
      .eq('id', connectedAccountId)
      .single();

    const workspaceId = account?.workspace_id || null;

    // Build API URL with date filter
    let apiUrl = `/chats?account_id=${encodeURIComponent(unipileAccountId)}`;
    
    if (!fullSync) {
      // Filter to last N days
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);
      apiUrl += `&from=${encodeURIComponent(fromDate.toISOString())}`;
      logger.info(`[Action 1] Filtering chats from ${fromDate.toISOString()}`);
    }

    // Call Unipile API to get chats
    const chatListResponse = await unipileGet<ChatList>(apiUrl);

    const chats = chatListResponse.items || [];
    logger.info(`[Action 1] Found ${chats.length} chats for account ${unipileAccountId}`);

    let chatsCount = 0;

    // Process each chat
    for (const chat of chats) {
      try {
        const conversationId = deterministicId(`chat-${chat.id}`);
        
        // Upsert conversation record with basic info
        // sender_attendee_id will be populated in Action 4 when we fetch messages
        const { error } = await supabaseAdmin
          .from('conversations')
          .upsert(
            {
              id: conversationId,
              conversation_type: 'linkedin',
              provider: 'linkedin',
              chat_id: chat.id,
              received_on_account_id: connectedAccountId,
              workspace_id: workspaceId,
              sender_attendee_id: null, // Will be set in Action 4 from first message
              sender_name: 'LinkedIn Contact', // Default value, will be enriched in Action 2
              last_message_at: chat.timestamp || chat.updated_at || new Date().toISOString(),
              created_at: new Date().toISOString(),
              subject: chat.title || null,
              initial_sync_done: false,
              sender_enriched: false,
              picture_enriched: false,
            },
            { onConflict: 'id' }
          );

        if (error) {
          logger.error(`[Action 1] Failed to upsert chat ${chat.id}`, error);
        } else {
          chatsCount++;
        }
      } catch (err) {
        logger.error(`[Action 1] Error processing chat ${chat.id}`, err);
      }
    }

    logger.info(`[Action 1] Successfully synced ${chatsCount} chats`);
    return { chatsCount };
  } catch (err: any) {
    logger.error('[Action 1] Failed to sync chats', err);
    return { chatsCount: 0, error: err.message };
  }
}

// ===== ACTION 2: SENDER ATTENDEE DETAILS =====

/**
 * Action 2 - Enrich sender name + LinkedIn URL
 * 
 * Read sender_attendee_id values from Supabase, call Get attendee by id, 
 * and update that row in conversations with sender name + LinkedIn URL.
 */
export async function enrichLinkedInSendersFromAttendees(): Promise<{ enrichedCount: number; error?: string }> {
  try {
    logger.info('[Action 2] Starting sender enrichment');

    // Query all LinkedIn conversations where sender details are not filled
    const { data: convos, error: queryError } = await supabaseAdmin
      .from('conversations')
      .select('id, sender_attendee_id')
      .eq('conversation_type', 'linkedin')
      .eq('sender_enriched', false)
      .not('sender_attendee_id', 'is', null);

    if (queryError) {
      throw new Error(`Failed to query conversations: ${queryError.message}`);
    }

    if (!convos || convos.length === 0) {
      logger.info('[Action 2] No conversations to enrich');
      return { enrichedCount: 0 };
    }

    logger.info(`[Action 2] Found ${convos.length} conversations to enrich`);

    let enrichedCount = 0;

    // Process each conversation
    for (const convo of convos) {
      try {
        // Call Unipile API to get attendee details
        const attendee = await unipileGet<ChatAttendee>(
          `/chat_attendees/${encodeURIComponent(convo.sender_attendee_id!)}`
        );

        // Build LinkedIn URL from public_identifier or profile_url
        let senderLinkedinUrl = attendee.profile_url || null;
        if (!senderLinkedinUrl && attendee.public_identifier) {
          senderLinkedinUrl = `https://www.linkedin.com/in/${attendee.public_identifier}`;
        }

        // Update conversation with sender details
        const { error } = await supabaseAdmin
          .from('conversations')
          .update({
            sender_name: attendee.name || attendee.display_name || 'LinkedIn Contact',
            sender_linkedin_url: senderLinkedinUrl,
            linkedin_sender_id: attendee.provider_id || null,
            provider_member_urn: attendee.specifics?.member_urn || null,
            sender_enriched: true,
          })
          .eq('id', convo.id);

        if (error) {
          logger.error(`[Action 2] Failed to update conversation ${convo.id}`, error);
        } else {
          enrichedCount++;
        }
      } catch (err: any) {
        logger.error(`[Action 2] Failed to enrich conversation ${convo.id}`, err);
        // Mark as enriched anyway to avoid repeated failures
        await supabaseAdmin
          .from('conversations')
          .update({ 
            sender_enriched: true,
            sender_name: 'LinkedIn Contact' 
          })
          .eq('id', convo.id);
      }
    }

    logger.info(`[Action 2] Successfully enriched ${enrichedCount} conversations`);
    return { enrichedCount };
  } catch (err: any) {
    logger.error('[Action 2] Failed to enrich senders', err);
    return { enrichedCount: 0, error: err.message };
  }
}

// ===== ACTION 3: SENDER PROFILE PICTURE =====

/**
 * Action 3 - Fetch profile picture
 * 
 * For sender_attendee_ids, call Get attendee profile picture and save 
 * URL/path to sender_profile_picture_url in conversations.
 */
export async function enrichLinkedInSenderPictures(): Promise<{ enrichedCount: number; error?: string }> {
  try {
    logger.info('[Action 3] Starting profile picture enrichment');

    // Select conversations where picture_enriched = false and sender_attendee_id is not null
    const { data: convos, error: queryError } = await supabaseAdmin
      .from('conversations')
      .select('id, sender_attendee_id')
      .eq('conversation_type', 'linkedin')
      .eq('picture_enriched', false)
      .not('sender_attendee_id', 'is', null);

    if (queryError) {
      throw new Error(`Failed to query conversations: ${queryError.message}`);
    }

    if (!convos || convos.length === 0) {
      logger.info('[Action 3] No conversations to enrich pictures');
      return { enrichedCount: 0 };
    }

    logger.info(`[Action 3] Found ${convos.length} conversations to enrich pictures`);

    let enrichedCount = 0;

    // Process each conversation
    for (const convo of convos) {
      try {
        // Call Unipile API to get attendee profile picture
        const pictureResponse = await unipileGet<AttendeeProfilePicture>(
          `/chat_attendees/${encodeURIComponent(convo.sender_attendee_id!)}/picture`
        );

        const pictureUrl = pictureResponse?.url || pictureResponse?.picture || null;

        // Update conversation with picture URL
        const { error } = await supabaseAdmin
          .from('conversations')
          .update({
            sender_profile_picture_url: pictureUrl,
            picture_enriched: true,
          })
          .eq('id', convo.id);

        if (error) {
          logger.error(`[Action 3] Failed to update picture for conversation ${convo.id}`, error);
        } else {
          enrichedCount++;
          if (pictureUrl) {
            logger.debug(`[Action 3] Added picture URL for conversation ${convo.id}`);
          } else {
            logger.debug(`[Action 3] No picture available for conversation ${convo.id} (UI will use initials)`);
          }
        }
      } catch (err: any) {
        logger.warn(`[Action 3] Failed to fetch picture for conversation ${convo.id}`, err);
        // Mark as enriched anyway - UI will handle fallback to initials
        await supabaseAdmin
          .from('conversations')
          .update({ picture_enriched: true })
          .eq('id', convo.id);
        enrichedCount++;
      }
    }

    logger.info(`[Action 3] Successfully enriched ${enrichedCount} conversation pictures`);
    return { enrichedCount };
  } catch (err: any) {
    logger.error('[Action 3] Failed to enrich pictures', err);
    return { enrichedCount: 0, error: err.message };
  }
}

// ===== ACTION 4: FETCH ALL MESSAGES PER CHAT =====

/**
 * Action 4 - Fetch all messages per chat → Supabase messages
 * 
 * For each chat (chat_id), call List all messages from chat and insert them 
 * into Supabase messages, using the previously stored sender data so that 
 * sender_name is never null.
 */
export async function syncLinkedInMessagesForAccount(
  connectedAccountId: string
): Promise<{ messagesCount: number; conversationsCount: number; error?: string }> {
  try {
    logger.info('[Action 4] Starting messages sync');

    // Get conversations that haven't been fully synced yet
    const { data: convos, error: queryError } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('conversation_type', 'linkedin')
      .eq('received_on_account_id', connectedAccountId)
      .eq('initial_sync_done', false);

    if (queryError) {
      throw new Error(`Failed to query conversations: ${queryError.message}`);
    }

    if (!convos || convos.length === 0) {
      logger.info('[Action 4] No conversations to sync messages');
      return { messagesCount: 0, conversationsCount: 0 };
    }

    logger.info(`[Action 4] Found ${convos.length} conversations to sync messages`);

    let messagesCount = 0;
    let conversationsCount = 0;

    // Get the Unipile account ID
    const { data: account } = await supabaseAdmin
      .from('connected_accounts')
      .select('unipile_account_id')
      .eq('id', connectedAccountId)
      .single();

    const unipileAccountId = account?.unipile_account_id;
    if (!unipileAccountId) {
      throw new Error(`No unipile_account_id found for connected account ${connectedAccountId}`);
    }

    // Cache for self attendee (the account owner)
    let selfAttendee: ChatAttendee | null = null;

    // Process each conversation
    for (const convo of convos) {
      try {
        // Call Unipile API to get all messages for this chat
        const messagesResponse = await unipileGet<MessageList>(
          `/chats/${encodeURIComponent(convo.chat_id)}/messages?account_id=${encodeURIComponent(unipileAccountId)}`
        );

        const messages = messagesResponse.items || [];
        logger.info(`[Action 4] Found ${messages.length} messages for chat ${convo.chat_id}`);

        // Extract sender_attendee_id from the first non-self message
        // This is the correct ID to use for fetching attendee details in Action 2
        let leadSenderAttendeeId: string | null = null;
        for (const msg of messages) {
          if (!msg.is_sender && msg.sender_attendee_id) {
            leadSenderAttendeeId = msg.sender_attendee_id;
            logger.debug(`[Action 4] Found lead sender_attendee_id: ${leadSenderAttendeeId} for chat ${convo.chat_id}`);
            break; // Use first non-self message
          }
        }

        // Update conversation with the correct sender_attendee_id
        if (leadSenderAttendeeId) {
          await supabaseAdmin
            .from('conversations')
            .update({ sender_attendee_id: leadSenderAttendeeId })
            .eq('id', convo.id);
        }

        // Process each message
        for (const message of messages) {
          try {
            // Resolve sender data
            let senderName: string;
            let senderLinkedinUrl: string | null = null;
            let senderAttendeeId: string | null = message.sender_attendee_id || message.sender_id || null;

            // Check if this message is from the lead (other person) or from self
            if (message.is_sender) {
              // Message from self (account owner)
              senderName = 'You';
              senderLinkedinUrl = null;
            } else {
              // Message from lead - use conversation's stored sender data
              senderName = convo.sender_name || 'LinkedIn Contact';
              senderLinkedinUrl = convo.sender_linkedin_url || null;
              senderAttendeeId = leadSenderAttendeeId || senderAttendeeId;
            }

            // Ensure sender_name is never null
            if (!senderName) {
              senderName = 'LinkedIn Contact';
            }

            const messageId = deterministicId(`msg-${message.id}`);
            const createdAt = safeTimestamp(message) || new Date().toISOString();

            // Insert message into Supabase
            const { error } = await supabaseAdmin
              .from('messages')
              .upsert(
                {
                  id: messageId,
                  conversation_id: convo.id,
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
              logger.error(`[Action 4] Failed to insert message ${message.id}`, error);
            } else {
              messagesCount++;
            }
          } catch (err) {
            logger.error(`[Action 4] Error processing message ${message.id}`, err);
          }
        }

        // Extract preview from the latest message
        const latestMessage = messages
          .map((msg) => ({ msg, ts: safeTimestamp(msg) }))
          .filter((entry) => entry.ts)
          .sort((a, b) => (a.ts! < b.ts! ? 1 : -1)) // Sort descending (latest first)
          .shift(); // Get the first (latest) message

        const previewText = (() => {
          if (!latestMessage?.msg) return null;
          const m = latestMessage.msg;
          return (
            m.text ||
            m.body_text ||
            null
          );
        })();

        // Mark conversation as fully synced and update preview
        await supabaseAdmin
          .from('conversations')
          .update({ 
            initial_sync_done: true,
            preview: previewText ? String(previewText).trim().substring(0, 500) : null
          })
          .eq('id', convo.id);

        conversationsCount++;
        logger.info(`[Action 4] Successfully synced ${messages.length} messages for chat ${convo.chat_id}`, {
          hasPreview: !!previewText,
          previewLength: previewText ? String(previewText).length : 0
        });
      } catch (err: any) {
        logger.error(`[Action 4] Failed to sync messages for chat ${convo.chat_id}`, err);
        
        // Check if it's a rate limit error
        if (err.response?.status === 429 || err.message?.includes('Rate cap')) {
          logger.warn('[Action 4] Rate limit reached, stopping sync. Resume later.');
          break;
        }
      }
    }

    logger.info(`[Action 4] Successfully synced ${messagesCount} messages across ${conversationsCount} conversations`);
    return { messagesCount, conversationsCount };
  } catch (err: any) {
    logger.error('[Action 4] Failed to sync messages', err);
    return { messagesCount: 0, conversationsCount: 0, error: err.message };
  }
}

// ===== FULL SYNC ORCHESTRATOR =====

/**
 * Run all 4 actions in sequence for a complete LinkedIn sync
 */
export async function runFullLinkedInSync4Actions(
  connectedAccountId: string, 
  options: { days?: number; fullSync?: boolean } = {}
) {
  const syncType = options.fullSync ? 'full' : `last ${options.days || 30} days`;
  logger.info(`[LinkedIn Sync] Starting 4-action sync for account ${connectedAccountId} (${syncType})`);

  // Get the Unipile account ID
  const { data: account, error: accountError } = await supabaseAdmin
    .from('connected_accounts')
    .select('unipile_account_id')
    .eq('id', connectedAccountId)
    .eq('account_type', 'linkedin')
    .single();

  if (accountError || !account) {
    throw new Error(`LinkedIn account not found: ${connectedAccountId}`);
  }

  const unipileAccountId = account.unipile_account_id;
  if (!unipileAccountId) {
    throw new Error(`LinkedIn account ${connectedAccountId} missing unipile_account_id`);
  }

  const results: any = {};

  try {
    // Action 1: Download chats (with date filter)
    const action1Result = await syncLinkedInChatsForAccount(connectedAccountId, unipileAccountId, options);
    results.action1_chats = action1Result;

    // Action 4: Download all messages (this populates sender_attendee_id from messages)
    // IMPORTANT: Must run before Action 2 to get correct sender_attendee_id
    const action4Result = await syncLinkedInMessagesForAccount(connectedAccountId);
    results.action4_messages = action4Result;

    // Action 2: Enrich sender details (now we have correct sender_attendee_id from messages)
    const action2Result = await enrichLinkedInSendersFromAttendees();
    results.action2_senders = action2Result;

    // Action 3: Enrich profile pictures
    const action3Result = await enrichLinkedInSenderPictures();
    results.action3_pictures = action3Result;

    // Update connected account status
    await supabaseAdmin
      .from('connected_accounts')
      .update({
        last_synced_at: new Date().toISOString(),
        sync_status: 'success',
        sync_error: null,
      })
      .eq('id', connectedAccountId);

    logger.info('[LinkedIn Sync] Full 4-action sync completed successfully', results);
    return { status: 'success', ...results };
  } catch (err: any) {
    logger.error('[LinkedIn Sync] Full sync failed', err);

    // Update connected account with error
    await supabaseAdmin
      .from('connected_accounts')
      .update({
        sync_status: 'error',
        sync_error: err.message,
      })
      .eq('id', connectedAccountId);

    return { status: 'error', error: err.message, ...results };
  }
}

// ===== WEBHOOK INCREMENTAL SYNC =====

/**
 * Used by webhook handler to incrementally sync new messages for a chat
 * without doing a full re-sync of the entire account
 */
export async function syncChatIncremental(
  unipileAccountId: string,
  chatId: string,
  fromTimestamp?: string
) {
  try {
    logger.info(`[LinkedIn Webhook Sync] Starting incremental sync for chat ${chatId}`);

    // Find the connected account and conversation
    const { data: account, error: accountError } = await supabaseAdmin
      .from('connected_accounts')
      .select('id, workspace_id')
      .eq('account_type', 'linkedin')
      .eq('unipile_account_id', unipileAccountId)
      .single();

    if (accountError || !account) {
      throw new Error(`LinkedIn account with unipile_account_id ${unipileAccountId} not found`);
    }

    // Find or create conversation for this chat
    const conversationId = deterministicId(`chat-${chatId}`);
    const { data: existingConvo } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('chat_id', chatId)
      .single();

    if (!existingConvo) {
      logger.info(`[LinkedIn Webhook Sync] Conversation not found for chat ${chatId}, triggering full sync`);
      // If conversation doesn't exist, trigger a full sync instead
      await runFullLinkedInSync4Actions(account.id);
      return;
    }

    // Fetch new messages
    const messagesPath = fromTimestamp
      ? `/chats/${encodeURIComponent(chatId)}/messages?account_id=${encodeURIComponent(unipileAccountId)}&from=${encodeURIComponent(fromTimestamp)}`
      : `/chats/${encodeURIComponent(chatId)}/messages?account_id=${encodeURIComponent(unipileAccountId)}`;

    const messagesResponse = await unipileGet<MessageList>(messagesPath);
    const messages = messagesResponse.items || [];

    logger.info(`[LinkedIn Webhook Sync] Found ${messages.length} new messages for chat ${chatId}`);

    // Process each message
    for (const message of messages) {
      try {
        let senderName: string;
        let senderLinkedinUrl: string | null = null;
        let senderAttendeeId: string | null = message.sender_attendee_id || message.sender_id || null;

        if (message.is_sender) {
          // Message from account owner
          senderName = 'You';
        } else {
          // Message from lead - use conversation's stored sender data
          senderName = existingConvo.sender_name || 'LinkedIn Contact';
          senderLinkedinUrl = existingConvo.sender_linkedin_url || null;
          senderAttendeeId = existingConvo.sender_attendee_id || senderAttendeeId;
        }

        const messageId = deterministicId(`msg-${message.id}`);
        const createdAt = safeTimestamp(message) || new Date().toISOString();

        await supabaseAdmin
          .from('messages')
          .upsert(
            {
              id: messageId,
              conversation_id: existingConvo.id,
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

        logger.debug(`[LinkedIn Webhook Sync] Upserted message ${message.id}`);
      } catch (err) {
        logger.error(`[LinkedIn Webhook Sync] Failed to process message ${message.id}`, err);
      }
    }

    // Update conversation's last_message_at, preview, and mark as unread if new lead messages
    if (messages.length > 0) {
      const latestTimestamp = messages
        .map(safeTimestamp)
        .filter(Boolean)
        .sort()
        .pop();

      const hasNewLeadMessages = messages.some(msg => !msg.is_sender);
      
      // Get the latest message for preview
      const latestMessage = messages.reduce((latest, msg) => {
        const msgTime = safeTimestamp(msg);
        const latestTime = safeTimestamp(latest);
        return msgTime > latestTime ? msg : latest;
      }, messages[0]);
      
      const updatePayload: any = {};
      if (latestTimestamp) {
        updatePayload.last_message_at = latestTimestamp;
      }
      if (hasNewLeadMessages) {
        updatePayload.is_read = false;
      }
      // Update preview with latest message content
      if (latestMessage?.text || latestMessage?.body_text) {
        updatePayload.preview = latestMessage.text || latestMessage.body_text;
      }

      if (Object.keys(updatePayload).length > 0) {
        await supabaseAdmin
          .from('conversations')
          .update(updatePayload)
          .eq('id', existingConvo.id);
      }
    }

    logger.info(`[LinkedIn Webhook Sync] Incremental sync completed for chat ${chatId}: ${messages.length} messages`);
  } catch (err) {
    logger.error(`[LinkedIn Webhook Sync] Failed incremental sync for chat ${chatId}`, err);
    throw err;
  }
}
