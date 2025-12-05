/**
 * Unipile Webhook Routes
 * Receives real-time updates from Unipile for LinkedIn events
 */

import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { asyncHandler } from '../utils/errorHandler';
import { supabaseAdmin } from '../lib/supabase';
import { UNIPILE_WEBHOOK_SECRET } from '../config/unipile';
import crypto from 'crypto';

const router = Router();

/**
 * Verify Unipile webhook signature (if webhook secret is configured)
 */
function verifyWebhookSignature(req: Request): boolean {
  if (!UNIPILE_WEBHOOK_SECRET) {
    // No secret configured, skip verification
    return true;
  }

  const signature = req.headers['x-unipile-signature'] as string;
  if (!signature) {
    return false;
  }

  const payload = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', UNIPILE_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

/**
 * POST /api/unipile/webhook
 * Receives webhook events from Unipile
 */
router.post(
  '/webhook',
  asyncHandler(async (req: Request, res: Response) => {
    // Verify signature
    if (!verifyWebhookSignature(req)) {
      logger.warn('[Unipile Webhook] Invalid signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { event, data } = req.body;

    logger.info(`[Unipile Webhook] Received event: ${event}`);

    try {
      switch (event) {
        case 'message.created':
          await handleNewMessage(data);
          break;

        case 'account.disconnected':
        case 'account.revoked':
          await handleAccountDisconnected(data);
          break;

        case 'account.connected':
          await handleAccountConnected(data);
          break;

        case 'message.read':
          await handleMessageRead(data);
          break;

        default:
          logger.info(`[Unipile Webhook] Unhandled event type: ${event}`);
      }

      res.json({ success: true, message: 'Webhook processed' });
    } catch (error: any) {
      logger.error(`[Unipile Webhook] Error processing event ${event}:`, error);
      res.status(500).json({ error: 'Failed to process webhook' });
    }
  })
);

/**
 * Handle new message webhook
 */
async function handleNewMessage(data: any): Promise<void> {
  logger.info('[Unipile Webhook] Processing new message');

  const { account_id, conversation_id, message } = data;

  // Find account in our database
  const { data: account } = await supabaseAdmin
    .from('connected_accounts')
    .select('id, workspace_id')
    .eq('unipile_account_id', account_id)
    .eq('account_type', 'linkedin')
    .single();

  if (!account) {
    logger.warn(`[Unipile Webhook] Account not found: ${account_id}`);
    return;
  }

  // Find or create conversation
  let conversationDbId: string;

  const { data: existingConv } = await supabaseAdmin
    .from('conversations')
    .select('id')
    .eq('external_conversation_id', conversation_id)
    .eq('workspace_id', account.workspace_id)
    .single();

  if (existingConv) {
    conversationDbId = existingConv.id;

    // Update conversation preview
    await supabaseAdmin
      .from('conversations')
      .update({
        preview: message.text || '',
        is_read: false,
      })
      .eq('id', conversationDbId);
  } else {
    // Create new conversation
    const { data: newConv } = await supabaseAdmin
      .from('conversations')
      .insert({
        workspace_id: account.workspace_id,
        received_on_account_id: account.id,
        provider: 'linkedin',
        external_conversation_id: conversation_id,
        preview: message.text || '',
        is_read: false,
        participant_name: message.sender?.name || 'LinkedIn User',
      })
      .select('id')
      .single();

    if (!newConv) {
      logger.error('[Unipile Webhook] Failed to create conversation');
      return;
    }

    conversationDbId = newConv.id;
  }

  // Check if message already exists
  const { data: existingMsg } = await supabaseAdmin
    .from('messages')
    .select('id')
    .eq('external_message_id', message.id)
    .single();

  if (existingMsg) {
    logger.info('[Unipile Webhook] Message already exists, skipping');
    return;
  }

  // Insert new message
  await supabaseAdmin.from('messages').insert({
    conversation_id: conversationDbId,
    workspace_id: account.workspace_id,
    provider: 'linkedin',
    external_message_id: message.id,
    direction: message.is_from_me ? 'outgoing' : 'incoming',
    sender_id: message.sender?.id || account.id,
    sender_name: message.sender?.name || 'Me',
    content: message.text || '',
    attachments: message.attachments ? JSON.stringify(message.attachments) : null,
    created_at: message.created_at || new Date().toISOString(),
  });

  logger.info('[Unipile Webhook] New message stored successfully');
}

/**
 * Handle account disconnected webhook
 */
async function handleAccountDisconnected(data: any): Promise<void> {
  logger.info('[Unipile Webhook] Processing account disconnection');

  const { account_id } = data;

  // Mark account as inactive
  const { error } = await supabaseAdmin
    .from('connected_accounts')
    .update({
      is_active: false,
      sync_status: 'disconnected',
      sync_error: 'Account was disconnected or revoked in LinkedIn',
    })
    .eq('unipile_account_id', account_id);

  if (error) {
    logger.error('[Unipile Webhook] Failed to mark account as disconnected:', error);
  } else {
    logger.info(`[Unipile Webhook] Account ${account_id} marked as disconnected`);
  }
}

/**
 * Handle account connected webhook
 */
async function handleAccountConnected(data: any): Promise<void> {
  logger.info('[Unipile Webhook] Processing account connection');

  const { account_id, account } = data;

  // Check if account exists
  const { data: existingAccount } = await supabaseAdmin
    .from('connected_accounts')
    .select('id, workspace_id')
    .eq('unipile_account_id', account_id)
    .single();

  if (existingAccount) {
    // Update existing account
    await supabaseAdmin
      .from('connected_accounts')
      .update({
        is_active: true,
        sync_status: 'pending',
        account_name: account.name || account.username || 'LinkedIn User',
        account_email: account.email,
      })
      .eq('id', existingAccount.id);

    logger.info(`[Unipile Webhook] Account ${account_id} updated`);
  } else {
    // This shouldn't happen normally, but log it
    logger.warn(`[Unipile Webhook] Account connected but not found in database: ${account_id}`);
  }
}

/**
 * Handle message read webhook
 */
async function handleMessageRead(data: any): Promise<void> {
  logger.info('[Unipile Webhook] Processing message read event');

  const { conversation_id } = data;

  // Mark conversation as read
  await supabaseAdmin
    .from('conversations')
    .update({ is_read: true })
    .eq('external_conversation_id', conversation_id);

  logger.info(`[Unipile Webhook] Conversation ${conversation_id} marked as read`);
}

export default router;
