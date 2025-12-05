/**
 * LinkedIn API Routes (via Unipile)
 * Main API endpoints for LinkedIn integration
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import {
  createLinkedInAuthUrl,
  refreshWorkspaceLinkedInAccounts,
  getLinkedInAccountsForWorkspace,
  disconnectLinkedInAccount,
  getLinkedInAccountById,
} from '../services/linkedinUnipileAccounts';
import {
  initialSyncLastNDays,
  syncNewMessagesFromUnipile,
  sendLinkedInMessage,
} from '../services/linkedinUnipileMessages';
import { getUsageSummary } from '../services/linkedinUsageGuard';
import { supabaseAdmin } from '../lib/supabase';

const router = Router();

/**
 * POST /api/linkedin/accounts/auth-url
 * Generate hosted authentication URL for connecting LinkedIn account
 */
router.post(
  '/accounts/auth-url',
  asyncHandler(async (req: Request, res: Response) => {
    const { workspace_id, user_id } = req.body;

    if (!workspace_id) {
      return res.status(400).json({ error: 'workspace_id is required' });
    }

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const { url, sessionId } = await createLinkedInAuthUrl(workspace_id, user_id);

    logger.info(`[LinkedIn API] Auth URL created for workspace ${workspace_id}`);

    res.json({ url, session_id: sessionId });
  })
);

/**
 * POST /api/linkedin/accounts/refresh
 * Refresh LinkedIn accounts from Unipile
 */
router.post(
  '/accounts/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    const { workspace_id, user_id } = req.body;

    if (!workspace_id) {
      return res.status(400).json({ error: 'workspace_id is required' });
    }

    const result = await refreshWorkspaceLinkedInAccounts(workspace_id, user_id);

    logger.info(`[LinkedIn API] Accounts refreshed for workspace ${workspace_id}: ${result.synced} synced`);

    res.json({ success: true, ...result });
  })
);

/**
 * GET /api/linkedin/accounts
 * Get all LinkedIn accounts for a workspace
 */
router.get(
  '/accounts',
  asyncHandler(async (req: Request, res: Response) => {
    const { workspace_id } = req.query;

    if (!workspace_id) {
      return res.status(400).json({ error: 'workspace_id is required' });
    }

    const accounts = await getLinkedInAccountsForWorkspace(workspace_id as string);

    res.json({ accounts });
  })
);

/**
 * GET /api/linkedin/accounts/:accountId
 * Get a specific LinkedIn account
 */
router.get(
  '/accounts/:accountId',
  asyncHandler(async (req: Request, res: Response) => {
    const { accountId } = req.params;

    const account = await getLinkedInAccountById(accountId);

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.json({ account });
  })
);

/**
 * POST /api/linkedin/accounts/:accountId/initial-sync
 * Start initial sync (last 30 days of DMs)
 */
router.post(
  '/accounts/:accountId/initial-sync',
  asyncHandler(async (req: Request, res: Response) => {
    const { accountId } = req.params;

    // Get account to find workspace
    const account = await getLinkedInAccountById(accountId);

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    logger.info(`[LinkedIn API] Starting initial sync for account ${accountId}`);

    // Start sync (could be made async with a job queue in production)
    const result = await initialSyncLastNDays(account.workspace_id, accountId);

    res.json({ success: true, ...result });
  })
);

/**
 * POST /api/linkedin/accounts/:accountId/sync
 * Incremental sync (new messages only)
 */
router.post(
  '/accounts/:accountId/sync',
  asyncHandler(async (req: Request, res: Response) => {
    const { accountId } = req.params;

    const account = await getLinkedInAccountById(accountId);

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const result = await syncNewMessagesFromUnipile(account.workspace_id, accountId);

    res.json({ success: true, ...result });
  })
);

/**
 * POST /api/linkedin/accounts/:accountId/disconnect
 * Disconnect LinkedIn account
 */
router.post(
  '/accounts/:accountId/disconnect',
  asyncHandler(async (req: Request, res: Response) => {
    const { accountId } = req.params;

    await disconnectLinkedInAccount(accountId);

    logger.info(`[LinkedIn API] Account ${accountId} disconnected`);

    res.json({ success: true, message: 'Account disconnected successfully' });
  })
);

/**
 * GET /api/linkedin/accounts/:accountId/usage
 * Get daily DM usage for an account
 */
router.get(
  '/accounts/:accountId/usage',
  asyncHandler(async (req: Request, res: Response) => {
    const { accountId } = req.params;

    const usage = await getUsageSummary(accountId);

    res.json({ usage });
  })
);

/**
 * GET /api/linkedin/conversations
 * Get LinkedIn conversations for a workspace
 */
router.get(
  '/conversations',
  asyncHandler(async (req: Request, res: Response) => {
    const { workspace_id, account_id, limit = 50, before } = req.query;

    if (!workspace_id) {
      return res.status(400).json({ error: 'workspace_id is required' });
    }

    let query = supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('workspace_id', workspace_id as string)
      .eq('provider', 'linkedin')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit as string));

    if (account_id) {
      query = query.eq('received_on_account_id', account_id as string);
    }

    if (before) {
      query = query.lt('created_at', before as string);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({ conversations: data || [] });
  })
);

/**
 * GET /api/linkedin/conversations/:conversationId/messages
 * Get messages for a conversation
 */
router.get(
  '/conversations/:conversationId/messages',
  asyncHandler(async (req: Request, res: Response) => {
    const { conversationId } = req.params;
    const { limit = 50, before } = req.query;

    let query = supabaseAdmin
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit as string));

    if (before) {
      query = query.lt('created_at', before as string);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({ messages: data || [] });
  })
);

/**
 * POST /api/linkedin/conversations/:conversationId/messages
 * Send a message in a conversation
 */
router.post(
  '/conversations/:conversationId/messages',
  asyncHandler(async (req: Request, res: Response) => {
    const { conversationId } = req.params;
    const { account_id, body, attachments } = req.body;

    if (!account_id) {
      return res.status(400).json({ error: 'account_id is required' });
    }

    if (!body || !body.trim()) {
      return res.status(400).json({ error: 'message body is required' });
    }

    const result = await sendLinkedInMessage(conversationId, account_id, body.trim(), attachments);

    logger.info(`[LinkedIn API] Message sent in conversation ${conversationId}`);

    res.json({
      success: true,
      message_id: result.messageId,
      warning: result.warning,
    });
  })
);

export default router;
