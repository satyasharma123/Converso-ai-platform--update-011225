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
    let messages = await messagesService.getMessages(conversationId);

    // Fetch full email body for the latest message if it's missing
    // This ensures the main email displays fully when opened
    if (conversation.received_account && messages.length > 0) {
      const account = conversation.received_account as any;
      const isGmail = account.oauth_provider === 'google';
      const isOutlook = account.oauth_provider === 'microsoft';
      
      if (isGmail || isOutlook) {
        // Get the latest message (most recent)
        const latestMessage = messages[messages.length - 1] as any;
        const messageId = latestMessage?.gmail_message_id || latestMessage?.outlook_message_id;
        
        // Fetch body if message has ID but no email_body
        if (messageId && !latestMessage?.email_body) {
          try {
            const { fetchGmailEmailBody } = await import('../services/gmailIntegration');
            const { fetchOutlookEmailBody } = await import('../services/outlookIntegration');
            
            const body = isGmail
              ? await fetchGmailEmailBody(account, messageId)
              : await fetchOutlookEmailBody(account, messageId);
            
            // Update message in database
            await supabaseAdmin
              .from('messages')
              .update({ email_body: body })
              .eq('id', latestMessage.id);
            
            // Update message object for response
            latestMessage.email_body = body;
          } catch (error: any) {
            logger.error(`Error fetching email body for message ${latestMessage.id}:`, error);
            // Continue - will show snippet instead
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
