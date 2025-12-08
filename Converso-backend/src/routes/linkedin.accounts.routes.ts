import { Router, Response } from 'express';
import axios from 'axios';
import { asyncHandler } from '../utils/errorHandler';
import { optionalAuth, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { deleteConnectedAccount } from '../api/connectedAccounts';
import { supabaseAdmin } from '../lib/supabase';
import { unipileDelete } from '../integrations/unipileClient';
import { runFullLinkedInSync4Actions } from '../unipile/linkedinSync.4actions';

const router = Router();

/**
 * POST /api/linkedin/accounts/start-auth
 * Begin Hosted Auth flow with Unipile for LinkedIn
 * Body: { account_name, user_id, workspace_id }
 */
router.post(
  '/accounts/start-auth',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    logger.info('[LinkedIn] start-auth called', req.body);
    const { account_name, user_id, workspace_id } = req.body || {};

    if (!account_name || !user_id || !workspace_id) {
      logger.warn('[LinkedIn] Missing required fields', { account_name, user_id, workspace_id });
      return res.status(400).json({ error: 'account_name, user_id, and workspace_id are required' });
    }

    const UNIPILE_BASE_URL = process.env.UNIPILE_BASE_URL || 'https://api23.unipile.com:15315/api/v1';
    const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
    if (!UNIPILE_API_KEY) {
      logger.error('[LinkedIn] UNIPILE_API_KEY not configured');
      return res.status(500).json({ error: 'UNIPILE_API_KEY is not configured' });
    }

    const callbackBaseUrl = `${req.protocol}://${req.get('host')}/api/linkedin/accounts/auth-callback`;
    logger.info('[LinkedIn] callback base URL:', callbackBaseUrl);

    // Encode state so we can restore context on callback
    const statePayload = JSON.stringify({ account_name, user_id, workspace_id });
    const encodedState = encodeURIComponent(statePayload);
    const successRedirectUrl = `${callbackBaseUrl}?state=${encodedState}`;
    const failureRedirectUrl = `${callbackBaseUrl}?state=${encodedState}&status=failed`;

    try {
      const apiBaseUrl = UNIPILE_BASE_URL.replace('/api/v1', '');
      const expiresOn = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const requestBody = {
        type: 'create',
        name: account_name,
        providers: ['LINKEDIN'],
        expiresOn,
        api_url: apiBaseUrl,
        success_redirect_url: successRedirectUrl,
        failure_redirect_url: failureRedirectUrl,
        notify_url: successRedirectUrl,
        bypass_success_screen: true,
        disabled_options: ['proxy'],
        custom_data: statePayload,
      };
      
      logger.info('[LinkedIn] Calling Unipile hosted-auth API', { 
        endpoint: `${UNIPILE_BASE_URL}/hosted/accounts/link`,
        body: requestBody 
      });
      
      const hostedAuthRes = await axios.post(
        `${UNIPILE_BASE_URL}/hosted/accounts/link`,
        requestBody,
        {
          headers: { 'x-api-key': UNIPILE_API_KEY },
        }
      );

      logger.info('[LinkedIn] Unipile hosted-auth response:', hostedAuthRes.data);

      const authUrl = hostedAuthRes.data?.url || hostedAuthRes.data?.connect_url || hostedAuthRes.data?.link;
      if (!authUrl) {
        logger.error('[LinkedIn] Hosted auth URL not returned from Unipile', hostedAuthRes.data);
        return res.status(500).json({ error: 'Failed to start LinkedIn authentication' });
      }

      logger.info('[LinkedIn] Returning hostedAuthUrl:', authUrl);
      res.json({ hostedAuthUrl: authUrl });
    } catch (error: any) {
      logger.error('[LinkedIn] Error calling Unipile hosted-auth', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      return res.status(500).json({
        error: 'Failed to connect with Unipile',
        details: error.response?.data || error.message,
      });
    }
  })
);

/**
 * GET /api/linkedin/accounts/auth-callback
 * Handle Unipile Hosted Auth callback
 */
router.get(
  '/accounts/auth-callback',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { code, state, account_id, status } = req.query as { code?: string; state?: string; account_id?: string; status?: string };

    if (status === 'failed') {
      return res.status(400).send('LinkedIn authentication failed. Please try again.');
    }

    if (!code && !account_id) {
      return res.status(400).send('Missing code or account_id from Unipile');
    }

    const UNIPILE_BASE_URL = process.env.UNIPILE_BASE_URL || 'https://api23.unipile.com:15315/api/v1';
    const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
    if (!UNIPILE_API_KEY) {
      return res.status(500).send('UNIPILE_API_KEY not configured');
    }

    let parsedState: any = {};
    try {
      parsedState = state ? JSON.parse(decodeURIComponent(state)) : {};
    } catch (err) {
      logger.warn('[LinkedIn] Failed to parse state', { state, err });
    }

    const { account_name, user_id, workspace_id } = parsedState;

    let unipileAccount: any = null;
    if (account_id) {
      const accountRes = await axios.get(
        `${UNIPILE_BASE_URL}/accounts/${account_id}`,
        { headers: { 'x-api-key': UNIPILE_API_KEY } }
      );
      unipileAccount = accountRes.data;
    } else if (code) {
      const tokenRes = await axios.post(
        `${UNIPILE_BASE_URL}/accounts/token`,
        { code },
        { headers: { 'x-api-key': UNIPILE_API_KEY } }
      );
      unipileAccount = tokenRes.data;
    }

    if (!unipileAccount?.id) {
      logger.error('[LinkedIn] No account id returned from Unipile callback', {
        account_id,
        codePresent: !!code,
      });
      return res.status(500).send('Failed to finalize LinkedIn account connection');
    }

    const record = {
      account_name: account_name || unipileAccount.display_name || 'LinkedIn Account',
      account_email: null,
      account_type: 'linkedin',
      is_active: true,
      unipile_account_id: unipileAccount.id,
      user_id: user_id || null,
      workspace_id: workspace_id || null,
      sync_status: 'syncing' as const,
    };

    let dbAccountId: string | null = null;

    const { data: existingAccounts, error: existingError } = await supabaseAdmin
      .from('connected_accounts')
      .select('id')
      .eq('account_type', 'linkedin')
      .eq('unipile_account_id', unipileAccount.id);

    if (existingError) {
      logger.error('[LinkedIn] Failed checking existing account', existingError);
      return res.status(500).send('Failed to store LinkedIn account');
    }

    const existingAccount = existingAccounts?.[0];

    if (existingAccount?.id) {
      const { error: updateError } = await supabaseAdmin
        .from('connected_accounts')
        .update(record)
        .eq('id', existingAccount.id);
      if (updateError) {
        logger.error('[LinkedIn] Failed to update connected account', updateError);
        return res.status(500).send('Failed to store LinkedIn account');
      }
      dbAccountId = existingAccount.id;
    } else {
      const { data: insertedAccount, error: insertError } = await supabaseAdmin
        .from('connected_accounts')
        .insert(record)
        .select()
        .single();
      if (insertError || !insertedAccount) {
        logger.error('[LinkedIn] Failed to insert connected account', insertError);
        return res.status(500).send('Failed to store LinkedIn account');
      }
      dbAccountId = insertedAccount.id;
    }

    if (dbAccountId) {
      setImmediate(async () => {
        try {
          logger.info(`[LinkedIn] Starting 4-action sync after account connect for ${dbAccountId}`);
          await runFullLinkedInSync4Actions(dbAccountId);
          logger.info(`[LinkedIn] 4-action sync completed successfully for ${dbAccountId}`);
        } catch (err: any) {
          logger.error('[LinkedIn] Auto sync after connect failed', err);
          await supabaseAdmin
            .from('connected_accounts')
            .update({ sync_status: 'error', sync_error: err?.message || 'Initial sync failed' })
            .eq('id', dbAccountId);
        }
      });
    }

    res.send(`
      <html>
        <head><title>LinkedIn Connected</title></head>
        <body style="font-family: sans-serif; text-align:center; padding:40px;">
          <h2>LinkedIn account connected!</h2>
          <p>You can close this window.</p>
          <script>
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage({ type: 'linkedin_connected' }, '*');
            }
            setTimeout(() => window.close(), 1000);
          </script>
        </body>
      </html>
    `);
  })
);

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
 * Trigger sync for a LinkedIn account
 */
router.post(
  '/accounts/:id/initial-sync',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const accountId = req.params.id;
    
    logger.info(`[LinkedIn] Initial sync requested for account ${accountId}`);
    
    try {
      await supabaseAdmin
        .from('connected_accounts')
        .update({ sync_status: 'syncing', sync_error: null })
        .eq('id', accountId);

      const result = await runFullLinkedInSync4Actions(accountId);
      return res.json({ success: true, ...result });
    } catch (error: any) {
      logger.error(`[LinkedIn] Sync error for account ${accountId}:`, error);
      
      await supabaseAdmin
        .from('connected_accounts')
        .update({ sync_status: 'error', sync_error: error.message })
        .eq('id', accountId);
      
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to sync LinkedIn messages',
      });
    }
  })
);

/**
 * POST /api/linkedin/sync
 * Trigger sync for all LinkedIn accounts (manual)
 */
router.post(
  '/sync',
  optionalAuth,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const { data: accounts, error } = await supabaseAdmin
      .from('connected_accounts')
      .select('id, workspace_id')
      .eq('account_type', 'linkedin')
      .eq('is_active', true);

    if (error) {
      logger.error('[LinkedIn] Error fetching accounts for sync:', error);
      throw error;
    }

    let totalResults: any = {
      successCount: 0,
      errorCount: 0,
      results: []
    };

    for (const account of accounts || []) {
      try {
        const result = await runFullLinkedInSync4Actions(account.id);
        totalResults.results.push({ accountId: account.id, ...result });
        totalResults.successCount++;
      } catch (err: any) {
        logger.error(`[LinkedIn] Sync error for account ${account.id}:`, err);
        totalResults.results.push({ accountId: account.id, status: 'error', error: err.message });
        totalResults.errorCount++;
      }
    }

    res.json({
      success: true,
      ...totalResults
    });
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
    logger.info(`[LinkedIn] DELETE request for account ${accountId}`);
    
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
    
    logger.info(`[LinkedIn] Found account: ${account.account_name}, unipile_account_id: ${account.unipile_account_id || 'NONE'}`);
    
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
    } else {
      logger.info(`[LinkedIn] No unipile_account_id, skipping Unipile disconnect`);
    }

    // Delete the account from Supabase
    logger.info(`[LinkedIn] Deleting account from Supabase: ${accountId}`);
    await deleteConnectedAccount(accountId);
    
    logger.info(`[LinkedIn] Account ${accountId} disconnected successfully`);
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
