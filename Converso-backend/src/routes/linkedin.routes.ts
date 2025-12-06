import { Router, Request, Response } from 'express';
import { asyncHandler } from '../utils/errorHandler';
import { optionalAuth, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { getConnectedAccounts } from '../api/connectedAccounts';
import { deleteConnectedAccount } from '../api/connectedAccounts';
import { supabaseAdmin } from '../lib/supabase';
import { unipileDelete } from '../integrations/unipileClient';
import { syncLinkedInMessages } from '../services/linkedinUnipileMessages';

const router = Router();

/**
 * GET /api/linkedin/accounts
 * Get all LinkedIn accounts for a workspace
 */
router.get(
  '/accounts',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const workspaceId = req.query.workspace_id as string;
    
    if (!workspaceId) {
      return res.status(400).json({ error: 'workspace_id is required' });
    }

    // Query Supabase directly for LinkedIn accounts by workspace_id
    const { data: linkedInAccounts, error } = await supabaseAdmin
      .from('connected_accounts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('account_type', 'linkedin')
      .eq('is_active', true)
      .order('account_name');

    if (error) {
      logger.error('[LinkedIn] Error fetching accounts:', error);
      throw error;
    }

    res.json({ accounts: linkedInAccounts || [] });
  })
);

/**
 * POST /api/linkedin/accounts/:id/initial-sync
 * Trigger initial sync for a LinkedIn account
 */
router.post(
  '/accounts/:id/initial-sync',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const accountId = req.params.id;
    
    logger.info(`[LinkedIn] Initial sync requested for account ${accountId}`);
    
    try {
      // Update sync status to syncing
      await supabaseAdmin
        .from('connected_accounts')
        .update({ sync_status: 'syncing' })
        .eq('id', accountId);

      // Perform the sync
      const result = await syncLinkedInMessages(accountId);
      
      res.json({
        success: true,
        conversations: result.conversations,
        messages: result.messages,
      });
    } catch (error: any) {
      logger.error(`[LinkedIn] Sync error for account ${accountId}:`, error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to sync LinkedIn messages',
      });
    }
  })
);

/**
 * DELETE /api/linkedin/accounts/:id
 * Disconnect a LinkedIn account
 */
router.delete(
  '/accounts/:id',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const accountId = req.params.id;
    
    // Get the account from Supabase
    const { data: account, error: fetchError } = await supabaseAdmin
      .from('connected_accounts')
      .select('*')
      .eq('id', accountId)
      .single();
    
    if (fetchError || !account) {
      logger.error('[LinkedIn] Account not found:', fetchError);
      return res.status(404).json({ error: 'Account not found' });
    }
    
    if (account.account_type !== 'linkedin') {
      return res.status(400).json({ error: 'Account is not a LinkedIn account' });
    }

    // If account has unipile_account_id, disconnect from Unipile first
    if (account.unipile_account_id) {
      try {
        logger.info(`[LinkedIn] Disconnecting from Unipile: ${account.unipile_account_id}`);
        await unipileDelete(`/accounts/${account.unipile_account_id}`);
        logger.info(`[LinkedIn] Successfully disconnected from Unipile`);
      } catch (unipileError: any) {
        logger.error(`[LinkedIn] Error disconnecting from Unipile:`, unipileError);
        // Continue with deletion even if Unipile disconnect fails
      }
    }

    // Delete the account from Supabase
    await deleteConnectedAccount(accountId);
    
    logger.info(`[LinkedIn] Account ${accountId} disconnected`);
    res.json({ success: true });
  })
);

/**
 * POST /api/linkedin/accounts/refresh
 * Refresh LinkedIn accounts from Unipile
 */
router.post(
  '/accounts/refresh',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { workspace_id, user_id } = req.body;
    
    if (!workspace_id) {
      return res.status(400).json({ error: 'workspace_id is required' });
    }

    // TODO: Implement actual Unipile refresh logic here
    logger.info(`[LinkedIn] Refresh requested for workspace ${workspace_id}`);
    
    res.json({
      synced: 0,
      errors: 0,
      message: 'Refresh functionality will be implemented with Unipile integration'
    });
  })
);

export default router;
