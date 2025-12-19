import { Router } from 'express';
import { logger } from '../utils/logger';
import {
  syncLinkedInChatsForAccount,
  enrichLinkedInSendersFromAttendees,
  enrichLinkedInSenderPictures,
  syncLinkedInMessagesForAccount,
  runFullLinkedInSync4Actions,
} from '../unipile/linkedinSync.4actions';
import { supabaseAdmin } from '../lib/supabase';

const router = Router();

/**
 * POST /api/linkedin/sync/full
 * Trigger a full 4-action sync for a connected account
 * Body: { connectedAccountId, days?, fullSync? }
 * - days: Number of days to sync (default 30)
 * - fullSync: true to sync all chats (ignores days parameter)
 */
router.post('/full', async (req, res) => {
  const { connectedAccountId, days, fullSync } = req.body;

  if (!connectedAccountId) {
    return res.status(400).json({ error: 'connectedAccountId is required' });
  }

  try {
    const options = { days, fullSync };
    const syncType = fullSync ? 'full sync (all chats)' : `last ${days || 30} days`;
    logger.info(`[LinkedIn Sync] Starting ${syncType} for account ${connectedAccountId}`);
    
    const result = await runFullLinkedInSync4Actions(connectedAccountId, options);
    return res.json(result);
  } catch (err: any) {
    logger.error('[LinkedIn Sync] Full sync failed', err);
    return res.status(500).json({ error: err.message || 'Full sync failed' });
  }
});

/**
 * POST /api/linkedin/sync/action1
 * Action 1: Download chats for an account
 * Body: { connectedAccountId, days?, fullSync? }
 */
router.post('/action1', async (req, res) => {
  const { connectedAccountId, days, fullSync } = req.body;

  if (!connectedAccountId) {
    return res.status(400).json({ error: 'connectedAccountId is required' });
  }

  try {
    // Get unipile account ID
    const { data: account, error } = await supabaseAdmin
      .from('connected_accounts')
      .select('unipile_account_id')
      .eq('id', connectedAccountId)
      .single();

    if (error || !account?.unipile_account_id) {
      return res.status(404).json({ error: 'Account not found or missing unipile_account_id' });
    }

    const options = { days, fullSync };
    const result = await syncLinkedInChatsForAccount(connectedAccountId, account.unipile_account_id, options);
    return res.json(result);
  } catch (err: any) {
    logger.error('[LinkedIn Sync] Action 1 failed', err);
    return res.status(500).json({ error: err.message || 'Action 1 failed' });
  }
});

/**
 * POST /api/linkedin/sync/action2
 * Action 2: Enrich sender details (name, LinkedIn URL)
 */
router.post('/action2', async (req, res) => {
  try {
    const result = await enrichLinkedInSendersFromAttendees();
    return res.json(result);
  } catch (err: any) {
    logger.error('[LinkedIn Sync] Action 2 failed', err);
    return res.status(500).json({ error: err.message || 'Action 2 failed' });
  }
});

/**
 * POST /api/linkedin/sync/action3
 * Action 3: Enrich profile pictures
 */
router.post('/action3', async (req, res) => {
  try {
    const result = await enrichLinkedInSenderPictures();
    return res.json(result);
  } catch (err: any) {
    logger.error('[LinkedIn Sync] Action 3 failed', err);
    return res.status(500).json({ error: err.message || 'Action 3 failed' });
  }
});

/**
 * POST /api/linkedin/sync/action4
 * Action 4: Download all messages for conversations
 */
router.post('/action4', async (req, res) => {
  const { connectedAccountId } = req.body;

  if (!connectedAccountId) {
    return res.status(400).json({ error: 'connectedAccountId is required' });
  }

  try {
    const result = await syncLinkedInMessagesForAccount(connectedAccountId);
    return res.json(result);
  } catch (err: any) {
    logger.error('[LinkedIn Sync] Action 4 failed', err);
    return res.status(500).json({ error: err.message || 'Action 4 failed' });
  }
});

/**
 * POST /api/linkedin/sync/resume
 * Resume sync - run actions 2, 3, 4 for any incomplete items
 */
router.post('/resume', async (req, res) => {
  const { connectedAccountId } = req.body;

  if (!connectedAccountId) {
    return res.status(400).json({ error: 'connectedAccountId is required' });
  }

  try {
    logger.info(`[LinkedIn Sync] Resuming sync for account ${connectedAccountId}`);

    const results: any = {};

    // Action 2: Enrich any senders that haven't been enriched
    const action2Result = await enrichLinkedInSendersFromAttendees();
    results.action2_senders = action2Result;

    // Action 3: Enrich any pictures that haven't been enriched
    const action3Result = await enrichLinkedInSenderPictures();
    results.action3_pictures = action3Result;

    // Action 4: Sync any messages that haven't been synced
    const action4Result = await syncLinkedInMessagesForAccount(connectedAccountId);
    results.action4_messages = action4Result;

    return res.json({ status: 'ok', ...results });
  } catch (err: any) {
    logger.error('[LinkedIn Sync] Resume sync failed', err);
    return res.status(500).json({ error: err.message || 'Resume sync failed' });
  }
});

/**
 * GET /api/linkedin/sync/status
 * Get sync status for an account
 */
router.get('/status', async (req, res) => {
  const { connectedAccountId } = req.query;

  if (!connectedAccountId) {
    return res.status(400).json({ error: 'connectedAccountId is required' });
  }

  try {
    // Get overall counts
    const { data: conversations } = await supabaseAdmin
      .from('conversations')
      .select('initial_sync_done, sender_enriched, picture_enriched', { count: 'exact' })
      .eq('conversation_type', 'linkedin')
      .eq('received_on_account_id', connectedAccountId);

    const total = conversations?.length || 0;
    const messageSynced = conversations?.filter((c) => c.initial_sync_done).length || 0;
    const senderEnriched = conversations?.filter((c) => c.sender_enriched).length || 0;
    const pictureEnriched = conversations?.filter((c) => c.picture_enriched).length || 0;

    // Get account sync status
    const { data: account } = await supabaseAdmin
      .from('connected_accounts')
      .select('last_synced_at, sync_status, sync_error')
      .eq('id', connectedAccountId)
      .single();

    return res.json({
      total_conversations: total,
      messages_synced: messageSynced,
      senders_enriched: senderEnriched,
      pictures_enriched: pictureEnriched,
      pending_messages: total - messageSynced,
      pending_senders: total - senderEnriched,
      pending_pictures: total - pictureEnriched,
      last_synced_at: account?.last_synced_at,
      sync_status: account?.sync_status,
      sync_error: account?.sync_error,
    });
  } catch (err: any) {
    logger.error('[LinkedIn Sync] Failed to get status', err);
    return res.status(500).json({ error: err.message || 'Failed to get status' });
  }
});

export default router;



