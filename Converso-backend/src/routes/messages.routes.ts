import { Router, Request, Response } from 'express';
import { messagesService } from '../services/messages';
import { asyncHandler } from '../utils/errorHandler';
import { transformMessages, transformMessage } from '../utils/transformers';
import { fetchAndStoreEmailBody } from '../services/emailSync';
import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/messages/conversation/:conversationId
 * Get all messages for a conversation
 * Fetches full email bodies if they're missing
 */
router.get(
  '/conversation/:conversationId',
  asyncHandler(async (req: Request, res: Response) => {
    const { conversationId } = req.params;
    
    // Get conversation to access account info
    const { data: conversation } = await supabaseAdmin
      .from('conversations')
      .select(`
        *,
        received_account:connected_accounts(*)
      `)
      .eq('id', conversationId)
      .single();

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Get all messages
    // Get all messages
    let messages = await messagesService.getMessages(conversationId);

    // Fetch full email bodies for ALL messages that are missing them
    // This ensures all emails in the thread display fully when opened
    if (conversation.received_account && messages.length > 0) {
      const account = conversation.received_account as any;
      const isGmail = account.oauth_provider === 'google';
      const isOutlook = account.oauth_provider === 'microsoft';
      
      if (isGmail || isOutlook) {
        const { fetchGmailEmailBody } = await import('../services/gmailIntegration');
        const { fetchOutlookEmailBody } = await import('../services/outlookIntegration');
        
        // Fetch bodies for ALL messages that don't have them
        for (const message of messages) {
          const msg = message as any;
          const messageId = msg.gmail_message_id || msg.outlook_message_id;
          
          // Check if message needs body fetching (no html_body AND no text_body)
          const needsBody = messageId && !msg.html_body && !msg.text_body;
          
          // Debug logging to understand why some messages don't fetch
          if (!needsBody && !msg.html_body && !msg.text_body) {
            logger.warn(`[Messages] Skipping body fetch for message ${msg.id}: No provider message ID (gmail_message_id=${!!msg.gmail_message_id}, outlook_message_id=${!!msg.outlook_message_id})`);
          }
          
          if (needsBody) {
            try {
              logger.info(`[Messages] Fetching body for message ${msg.id} (messageId: ${messageId})`);
              
              const bodyResult = isGmail
                ? await fetchGmailEmailBody(account, messageId)
                : await fetchOutlookEmailBody(account, messageId);
              
              // Update message in database with html_body and text_body
              await supabaseAdmin
                .from('messages')
                .update({ 
                  html_body: bodyResult.htmlBody || null,
                  text_body: bodyResult.textBody || null,
                  email_body: bodyResult.htmlBody || bodyResult.textBody || msg.content, // Legacy field
                })
                .eq('id', msg.id);
              
              // Update message object for response
              msg.html_body = bodyResult.htmlBody || null;
              msg.text_body = bodyResult.textBody || null;
              msg.email_body = bodyResult.htmlBody || bodyResult.textBody || msg.content;
              
              logger.info(`[Messages] ✅ Body fetched for message ${msg.id}: HTML=${bodyResult.htmlBody?.length || 0}b, Text=${bodyResult.textBody?.length || 0}b`);
            } catch (error: any) {
              logger.error(`[Messages] Error fetching body for message ${msg.id}:`, error.message);
              // Continue - will show snippet/content instead
            }
          }
        }
      }
    }

    res.json({ data: transformMessages(messages) });
  })
);

/**
 * POST /api/messages
 * Send a new message
 */
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { conversationId, content } = req.body;
    const userId = req.headers['x-user-id'] as string || req.body.userId;

    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation ID is required' });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    await messagesService.sendMessage(conversationId, userId, content);
    res.status(201).json({ message: 'Message sent successfully' });
  })
);

/**
 * GET /api/messages/:id
 * Get a single message by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const message = await messagesService.getById(id);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json({ data: transformMessage(message) });
  })
);

export default router;
