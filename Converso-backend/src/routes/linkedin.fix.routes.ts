import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { unipileGet } from '../unipile/unipileClient';
import { logger } from '../utils/logger';

const router = Router();

interface ChatAttendee {
  id: string;
  name?: string | null;
  display_name?: string | null;
  profile_url?: string | null;
  provider_id?: string | null;
  public_identifier?: string | null;
}

interface Message {
  id: string;
  is_sender?: boolean;
  sender_attendee_id?: string | null;
}

interface MessageList {
  items: Message[];
}

/**
 * POST /api/linkedin/fix/names
 * 
 * Fixes all conversations that have "LinkedIn Contact" as sender_name
 * by fetching the actual name from Unipile API.
 * 
 * This is a one-time fix endpoint.
 */
router.post('/names', async (req, res) => {
  try {
    logger.info('[LinkedIn Fix] Starting name fix for all LinkedIn conversations');

    // Step 1: Get all LinkedIn conversations with "LinkedIn Contact"
    const { data: conversations, error: queryError } = await supabaseAdmin
      .from('conversations')
      .select(`
        id,
        chat_id,
        sender_name,
        sender_attendee_id,
        received_on_account_id
      `)
      .eq('conversation_type', 'linkedin')
      .eq('sender_name', 'LinkedIn Contact');

    if (queryError) {
      throw new Error(`Failed to query conversations: ${queryError.message}`);
    }

    if (!conversations || conversations.length === 0) {
      return res.json({ 
        status: 'ok', 
        message: 'No conversations with "LinkedIn Contact" found',
        fixedCount: 0 
      });
    }

    logger.info(`[LinkedIn Fix] Found ${conversations.length} conversations to fix`);

    let fixedCount = 0;
    const errors: string[] = [];

    // Step 2: Process each conversation
    for (const convo of conversations) {
      try {
        // Get the Unipile account ID
        const { data: account } = await supabaseAdmin
          .from('connected_accounts')
          .select('unipile_account_id')
          .eq('id', convo.received_on_account_id)
          .single();

        if (!account?.unipile_account_id) {
          errors.push(`No unipile_account_id for conversation ${convo.id}`);
          continue;
        }

        const unipileAccountId = account.unipile_account_id;
        let senderAttendeeId = convo.sender_attendee_id;
        let senderName: string | null = null;
        let senderLinkedinUrl: string | null = null;

        // Step 3: If no sender_attendee_id, fetch from messages
        if (!senderAttendeeId && convo.chat_id) {
          logger.info(`[LinkedIn Fix] Fetching messages to find sender_attendee_id for chat ${convo.chat_id}`);
          
          try {
            const messagesResponse = await unipileGet<MessageList>(
              `/chats/${encodeURIComponent(convo.chat_id)}/messages?account_id=${encodeURIComponent(unipileAccountId)}&limit=20`
            );

            // Find the first message from the OTHER person (not is_sender)
            for (const msg of messagesResponse.items || []) {
              if (!msg.is_sender && msg.sender_attendee_id) {
                senderAttendeeId = msg.sender_attendee_id;
                logger.info(`[LinkedIn Fix] Found sender_attendee_id: ${senderAttendeeId}`);
                break;
              }
            }
          } catch (err: any) {
            logger.error(`[LinkedIn Fix] Failed to fetch messages for chat ${convo.chat_id}`, err);
          }
        }

        // Step 4: Fetch attendee details
        if (senderAttendeeId) {
          try {
            const attendee = await unipileGet<ChatAttendee>(
              `/chat_attendees/${encodeURIComponent(senderAttendeeId)}`
            );

            senderName = attendee.name || attendee.display_name || null;
            
            if (attendee.profile_url) {
              senderLinkedinUrl = attendee.profile_url;
            } else if (attendee.public_identifier) {
              senderLinkedinUrl = `https://www.linkedin.com/in/${attendee.public_identifier}`;
            }

            logger.info(`[LinkedIn Fix] Got attendee name: ${senderName} for conversation ${convo.id}`);
          } catch (err: any) {
            logger.error(`[LinkedIn Fix] Failed to fetch attendee ${senderAttendeeId}`, err);
          }
        }

        // Step 5: Update conversation if we found a name
        if (senderName) {
          const { error: updateError } = await supabaseAdmin
            .from('conversations')
            .update({
              sender_name: senderName,
              sender_linkedin_url: senderLinkedinUrl,
              sender_attendee_id: senderAttendeeId,
              sender_enriched: true,
            })
            .eq('id', convo.id);

          if (updateError) {
            errors.push(`Failed to update conversation ${convo.id}: ${updateError.message}`);
          } else {
            fixedCount++;
            logger.info(`[LinkedIn Fix] Fixed conversation ${convo.id}: ${senderName}`);
          }
        } else {
          errors.push(`Could not find name for conversation ${convo.id} (chat_id: ${convo.chat_id})`);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (err: any) {
        errors.push(`Error processing conversation ${convo.id}: ${err.message}`);
      }
    }

    logger.info(`[LinkedIn Fix] Completed. Fixed ${fixedCount}/${conversations.length} conversations`);

    return res.json({
      status: 'ok',
      totalFound: conversations.length,
      fixedCount,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (err: any) {
    logger.error('[LinkedIn Fix] Failed', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/linkedin/fix/messages
 * 
 * Downloads all messages for conversations that have 0 messages locally.
 */
router.post('/messages', async (req, res) => {
  try {
    const { connectedAccountId } = req.body;

    if (!connectedAccountId) {
      return res.status(400).json({ error: 'connectedAccountId is required' });
    }

    logger.info(`[LinkedIn Fix] Starting message download for account ${connectedAccountId}`);

    // Get the Unipile account ID
    const { data: account } = await supabaseAdmin
      .from('connected_accounts')
      .select('unipile_account_id')
      .eq('id', connectedAccountId)
      .single();

    if (!account?.unipile_account_id) {
      return res.status(404).json({ error: 'Account not found or missing unipile_account_id' });
    }

    const unipileAccountId = account.unipile_account_id;

    // Get all conversations for this account
    const { data: conversations } = await supabaseAdmin
      .from('conversations')
      .select('id, chat_id, sender_name, sender_linkedin_url')
      .eq('conversation_type', 'linkedin')
      .eq('received_on_account_id', connectedAccountId);

    if (!conversations || conversations.length === 0) {
      return res.json({ status: 'ok', message: 'No conversations found', messagesDownloaded: 0 });
    }

    let totalMessages = 0;

    for (const convo of conversations) {
      try {
        // Fetch messages from Unipile
        const messagesResponse = await unipileGet<MessageList>(
          `/chats/${encodeURIComponent(convo.chat_id)}/messages?account_id=${encodeURIComponent(unipileAccountId)}`
        );

        const messages = messagesResponse.items || [];
        logger.info(`[LinkedIn Fix] Found ${messages.length} messages for chat ${convo.chat_id}`);

        // Insert each message
        for (const message of messages) {
          const senderName = message.is_sender ? 'You' : (convo.sender_name || 'LinkedIn Contact');
          const senderLinkedinUrl = message.is_sender ? null : convo.sender_linkedin_url;

          // Generate deterministic ID
          const crypto = require('crypto');
          const hex = crypto.createHash('sha1').update(`msg-${message.id}`).digest('hex');
          const messageId = [
            hex.substring(0, 8),
            hex.substring(8, 12),
            hex.substring(12, 16),
            hex.substring(16, 20),
            hex.substring(20, 32),
          ].join('-');

          await supabaseAdmin.from('messages').upsert({
            id: messageId,
            conversation_id: convo.id,
            message_type: 'linkedin',
            linkedin_message_id: message.id,
            sender_attendee_id: message.sender_attendee_id,
            sender_name: senderName,
            sender_linkedin_url: senderLinkedinUrl,
            content: (message as any).text || (message as any).body_text || '',
            created_at: (message as any).timestamp || (message as any).datetime || new Date().toISOString(),
            is_from_lead: !message.is_sender,
            provider: 'linkedin',
          }, { onConflict: 'linkedin_message_id' });

          totalMessages++;
        }

        // Small delay
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (err: any) {
        logger.error(`[LinkedIn Fix] Failed for chat ${convo.chat_id}`, err);
      }
    }

    logger.info(`[LinkedIn Fix] Downloaded ${totalMessages} messages`);

    return res.json({
      status: 'ok',
      conversationsProcessed: conversations.length,
      messagesDownloaded: totalMessages,
    });

  } catch (err: any) {
    logger.error('[LinkedIn Fix] Message download failed', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
