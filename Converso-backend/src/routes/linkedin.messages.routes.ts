import { Router } from 'express';
import { unipilePost } from '../unipile/unipileClient';
import { mapMessage } from '../unipile/linkedinMessageMapper';
import { deterministicId } from '../unipile/linkedinConversationMapper';
import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../utils/logger';
import axios from 'axios';
const FormData = require('form-data');

const router = Router();

// Send LinkedIn message via Unipile and store locally
// Supports text, attachments (files, images, videos)
router.post('/send-message', async (req, res) => {
  const { chat_id, account_id, text, attachments } = req.body;
  
  if (!chat_id || !account_id) {
    return res.status(400).json({ error: 'chat_id and account_id are required' });
  }

  if (!text && (!attachments || attachments.length === 0)) {
    return res.status(400).json({ error: 'Either text or attachments must be provided' });
  }

  const { data: account, error: accountError } = await supabaseAdmin
    .from('connected_accounts')
    .select('id, workspace_id')
    .eq('account_type', 'linkedin')
    .eq('unipile_account_id', account_id)
    .single();

  if (accountError || !account) {
    return res.status(404).json({ error: 'LinkedIn account not found for the provided account_id' });
  }

  try {
    // Get Unipile configuration
    const UNIPILE_BASE_URL = process.env.UNIPILE_BASE_URL || 'https://api23.unipile.com:15315/api/v1';
    const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

    // Build request payload
    let sendResp: any;
    
    if (attachments && attachments.length > 0) {
      // Use multipart/form-data for attachments
      const formData = new FormData();
      if (text) {
        formData.append('text', text);
      }
      
      // Add attachments to form data
      for (const attachment of attachments) {
        if (attachment.file) {
          // If attachment has a file buffer/stream
          formData.append('attachments', attachment.file, attachment.name);
        } else if (attachment.url) {
          // If attachment has a URL, fetch it and add to form
          try {
            const fileResponse = await axios.get(attachment.url, { responseType: 'arraybuffer' });
            formData.append('attachments', Buffer.from(fileResponse.data), attachment.name);
          } catch (err) {
            logger.error('[LinkedIn] Failed to fetch attachment from URL', { url: attachment.url, error: err });
          }
        }
      }

      // Send with multipart/form-data
      // UNIPILE_BASE_URL already includes /api/v1
      const unipileUrl = `${UNIPILE_BASE_URL}/chats/${encodeURIComponent(chat_id)}/messages`;
      const response = await axios.post(unipileUrl, formData, {
        headers: {
          ...formData.getHeaders(),
          'X-API-KEY': UNIPILE_API_KEY,
        },
        params: { account_id },
      });
      sendResp = response.data;
    } else {
      // Simple text-only message (unipilePost already adds /api/v1 prefix)
      const unipilePath = `/chats/${encodeURIComponent(chat_id)}/messages?account_id=${encodeURIComponent(account_id)}`;
      sendResp = await unipilePost(unipilePath, { text });
    }

    // Derive conversation id and basic sender info (self)
    const conversationId = deterministicId(`chat-${chat_id}`);
    const senderName = 'You';
    const senderLinkedinUrl = null;

    const createdAt =
      sendResp?.timestamp ||
      sendResp?.datetime ||
      sendResp?.date ||
      new Date().toISOString();

    const msgRecord = mapMessage(
      {
        id: sendResp?.id || `local-${Date.now()}`,
        chat_id,
        text,
        body_text: null,
        timestamp: createdAt,
        is_sender: true,
        sender_attendee_id: sendResp?.sender_attendee_id || null,
        attachments: sendResp?.attachments || attachments || [],
        reactions: sendResp?.reactions || [],
      },
      conversationId,
      senderName,
      senderLinkedinUrl
    );

    // Upsert message locally
    const { error: msgError } = await supabaseAdmin
      .from('messages')
      .upsert(msgRecord, { onConflict: 'linkedin_message_id' });
    if (msgError) {
      logger.error('[LinkedIn] Failed to upsert sent message', msgError);
    }

    // NOTE: We intentionally do NOT update the conversation here.
    // The conversation data (sender_name, etc.) should only be set by the sync process
    // to avoid overwriting with incorrect data.
    // The frontend polling will pick up changes automatically.

    return res.json({ status: 'ok', message: msgRecord });
  } catch (err: any) {
    logger.error('[LinkedIn] send-message failed', {
      error: err.message,
      response: err.response?.data,
      status: err.response?.status
    });
    return res.status(500).json({ 
      error: 'Failed to send message',
      details: err.response?.data || err.message
    });
  }
});

export default router;
