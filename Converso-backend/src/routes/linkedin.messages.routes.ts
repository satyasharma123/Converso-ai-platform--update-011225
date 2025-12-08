import { Router } from 'express';
import { unipilePost } from '../unipile/unipileClient';
import { mapMessage } from '../unipile/linkedinMessageMapper';
import { mapConversation, deterministicId } from '../unipile/linkedinConversationMapper';
import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../utils/logger';

const router = Router();

// Send LinkedIn message via Unipile and store locally
router.post('/send-message', async (req, res) => {
  const { chat_id, account_id, text, attachments } = req.body;
  if (!chat_id || !account_id || !text) {
    return res.status(400).json({ error: 'chat_id, account_id, and text are required' });
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
    const unipilePath = `/api/v1/chats/${encodeURIComponent(chat_id)}/messages?account_id=${encodeURIComponent(account_id)}`;
    const sendResp: any = await unipilePost(unipilePath, { text, attachments: attachments || [] });

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

    // Update conversation last_message_at
    const convRecord = mapConversation(
      { id: chat_id, title: null, updated_at: createdAt },
      null,
      null,
      createdAt,
      { accountId: account.id, workspaceId: account.workspace_id || null }
    );
    const { error: convError } = await supabaseAdmin
      .from('conversations')
      .upsert(convRecord, { onConflict: 'id' });
    if (convError) {
      logger.error('[LinkedIn] Failed to update conversation after send', convError);
    }

    return res.json({ status: 'ok', message: msgRecord });
  } catch (err) {
    logger.error('[LinkedIn] send-message failed', err);
    return res.status(500).json({ error: 'Failed to send message' });
  }
});

export default router;
