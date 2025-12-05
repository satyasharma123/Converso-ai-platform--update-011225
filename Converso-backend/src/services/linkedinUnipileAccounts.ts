/**
 * LinkedIn Account Management via Unipile
 * Handles connecting, syncing, and disconnecting LinkedIn accounts
 */

import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../utils/logger';
import { unipileGet, unipilePost, unipileDelete, UnipileAccount } from '../integrations/unipileClient';

/**
 * Create a hosted authentication URL for LinkedIn
 * Users will open this URL to connect their LinkedIn account via Unipile's hosted flow
 */
export async function createLinkedInAuthUrl(
  workspaceId: string,
  userId: string
): Promise<{ url: string; sessionId: string }> {
  try {
    logger.info(`[LinkedIn Accounts] Creating auth URL for user ${userId} in workspace ${workspaceId}`);

    // Call Unipile's hosted auth endpoint
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8082';
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    
    // Extract DSN base URL (remove /api/v1 if present)
    const unipileBaseUrl = process.env.UNIPILE_BASE_URL || 'https://api23.unipile.com:15315/api/v1';
    const unipileDsn = unipileBaseUrl.replace(/\/api\/v1$/, ''); // Remove /api/v1 from end
    
    // Calculate expiration (24 hours from now)
    const expiresOn = new Date();
    expiresOn.setHours(expiresOn.getHours() + 24);
    
    logger.info(`[LinkedIn Accounts] Creating auth URL with api_url: ${unipileDsn}`);
    
    const response = await unipilePost<{ object: string; url: string }>(
      '/hosted/accounts/link',
      {
        type: 'create',
        providers: ['LINKEDIN'],
        api_url: unipileDsn, // DSN without /api/v1 (e.g., https://api23.unipile.com:15315)
        expiresOn: expiresOn.toISOString(), // Note: camelCase, not snake_case
        success_redirect_url: `${frontendUrl}/settings?linkedin=success`,
        failure_redirect_url: `${frontendUrl}/settings?linkedin=error`,
        notify_url: `${backendUrl}/api/unipile/webhook`,
        name: `${workspaceId}:${userId}`, // Pass workspace and user ID for webhook callback
      }
    );

    logger.info(`[LinkedIn Accounts] Auth URL created: ${response.url}`);

    return {
      url: response.url,
      sessionId: `${workspaceId}:${userId}`, // Use workspace:user as session identifier
    };
  } catch (error: any) {
    logger.error('[LinkedIn Accounts] Failed to create auth URL:', error);
    // Remove "Unipile" from user-facing error messages
    const errorMessage = error.message?.replace(/Unipile\s+/gi, '') || 'Unknown error';
    throw new Error(`Failed to create LinkedIn auth URL: ${errorMessage}`);
  }
}

/**
 * Refresh/sync LinkedIn accounts from Unipile to Supabase
 * Fetches all LinkedIn accounts from Unipile and upserts them into our database
 */
export async function refreshWorkspaceLinkedInAccounts(
  workspaceId: string,
  currentUserId?: string
): Promise<{ synced: number; errors: number }> {
  try {
    logger.info(`[LinkedIn Accounts] Refreshing accounts for workspace ${workspaceId}`);

    // Determine which user_id to assign to connected_accounts (NOT NULL)
    let accountUserId: string | null = currentUserId || null;

    if (!accountUserId) {
      // Find any user in this workspace (profiles primary key is id)
      const { data: workspaceUser, error: workspaceUserError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('workspace_id', workspaceId)
        .limit(1)
        .single();

      if (workspaceUserError || !workspaceUser?.id) {
        logger.error(
          `[LinkedIn Accounts] ❌ Could not find a user for workspace ${workspaceId}:`,
          workspaceUserError?.message || 'No profile found'
        );
        // Without a user_id we cannot insert into connected_accounts (NOT NULL)
        return { synced: 0, errors: 1 };
      }

      accountUserId = workspaceUser.id;
    }

    // Fetch all accounts from Unipile
    const accounts = await unipileGet<{ items: UnipileAccount[] }>('/accounts', {
      provider: 'LINKEDIN',
    });

    logger.info(`[LinkedIn Accounts] Found ${accounts.items.length} LinkedIn accounts in Unipile`);
    
    if (accounts.items.length === 0) {
      logger.warn(`[LinkedIn Accounts] No LinkedIn accounts found in Unipile. User may need to complete authentication or wait for Unipile to process the account.`);
      return { synced: 0, errors: 0 };
    }
    
    logger.info(`[LinkedIn Accounts] Account details:`, JSON.stringify(accounts.items, null, 2));

    let synced = 0;
    let errors = 0;

    for (const unipileAccount of accounts.items) {
      try {
        logger.info(`[LinkedIn Accounts] Processing account: ${unipileAccount.id} (${unipileAccount.name || unipileAccount.email})`);
        
        // Check if account already exists in our database
        const { data: existingAccount, error: selectError } = await supabaseAdmin
          .from('connected_accounts')
          .select('id')
          .eq('unipile_account_id', unipileAccount.id)
          .eq('workspace_id', workspaceId)
          .single();

        if (selectError && selectError.code !== 'PGRST116') {
          // PGRST116 = no rows returned, which is fine (means new account)
          logger.error(`[LinkedIn Accounts] Error checking existing account:`, selectError);
          throw selectError;
        }

        if (existingAccount) {
          // Update existing account
          logger.info(`[LinkedIn Accounts] Updating existing account ${existingAccount.id}`);
          const { error } = await supabaseAdmin
            .from('connected_accounts')
            .update({
              account_name: unipileAccount.name || unipileAccount.username || 'LinkedIn User',
              account_email: unipileAccount.email,
              is_active: unipileAccount.is_active ?? true,
              sync_status: 'pending',
              oauth_provider: 'linkedin',
            })
            .eq('id', existingAccount.id);

          if (error) {
            logger.error(`[LinkedIn Accounts] Error updating account:`, error);
            throw error;
          }
          logger.info(`[LinkedIn Accounts] ✅ Updated account ${existingAccount.id}`);
        } else {
          // Create new account
          logger.info(`[LinkedIn Accounts] Creating new account in Supabase`);
          logger.info(`[LinkedIn Accounts] Account data:`, {
            workspace_id: workspaceId,
            user_id: accountUserId!,
            account_type: 'linkedin',
            unipile_account_id: unipileAccount.id,
            account_name: unipileAccount.name || unipileAccount.username || 'LinkedIn User',
            account_email: unipileAccount.email || null,
            is_active: unipileAccount.is_active ?? true,
            sync_status: 'pending',
            oauth_provider: 'linkedin',
          });
          
          const { data: newAccount, error } = await supabaseAdmin
            .from('connected_accounts')
            .insert({
            workspace_id: workspaceId,
            user_id: accountUserId!,
              account_type: 'linkedin',
              unipile_account_id: unipileAccount.id,
              account_name: unipileAccount.name || unipileAccount.username || 'LinkedIn User',
              account_email: unipileAccount.email || null,
              is_active: unipileAccount.is_active ?? true,
              sync_status: 'pending',
              oauth_provider: 'linkedin',
            })
            .select()
            .single();

          if (error) {
            logger.error(`[LinkedIn Accounts] ❌ Error creating account in Supabase:`, JSON.stringify(error, null, 2));
            throw error;
          }
          
          logger.info(`[LinkedIn Accounts] ✅ Created new account: ${newAccount.id} for ${unipileAccount.name}`);
        }

        synced++;
      } catch (error: any) {
        logger.error(`[LinkedIn Accounts] ❌ Failed to sync account ${unipileAccount.id}:`, error.message || error);
        logger.error(`[LinkedIn Accounts] Full error:`, JSON.stringify(error, null, 2));
        errors++;
      }
    }

    // Mark accounts that no longer exist in Unipile as inactive
    const unipileAccountIds = accounts.items.map((a) => a.id);
    await supabaseAdmin
      .from('connected_accounts')
      .update({ is_active: false, sync_status: 'disconnected' })
      .eq('workspace_id', workspaceId)
      .eq('account_type', 'linkedin')
      .not('unipile_account_id', 'in', `(${unipileAccountIds.join(',')})`);

    logger.info(`[LinkedIn Accounts] Refresh complete: ${synced} synced, ${errors} errors`);

    return { synced, errors };
  } catch (error: any) {
    logger.error('[LinkedIn Accounts] Failed to refresh accounts:', error);
    throw new Error(`Failed to refresh LinkedIn accounts: ${error.message}`);
  }
}

/**
 * Get all LinkedIn accounts for a workspace from Supabase
 */
export async function getLinkedInAccountsForWorkspace(workspaceId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('connected_accounts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('account_type', 'linkedin')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data || [];
  } catch (error: any) {
    logger.error('[LinkedIn Accounts] Failed to get accounts:', error);
    throw new Error(`Failed to get LinkedIn accounts: ${error.message}`);
  }
}

/**
 * Disconnect a LinkedIn account
 * Removes from Unipile and marks as inactive in Supabase
 */
export async function disconnectLinkedInAccount(accountId: string): Promise<void> {
  try {
    logger.info(`[LinkedIn Accounts] Disconnecting account ${accountId}`);

    // Get account details
    const { data: account, error: fetchError } = await supabaseAdmin
      .from('connected_accounts')
      .select('unipile_account_id, account_name')
      .eq('id', accountId)
      .single();

    if (fetchError || !account) {
      throw new Error('Account not found');
    }

    if (!account.unipile_account_id) {
      throw new Error('No Unipile account ID found');
    }

    // Delete from Unipile
    try {
      await unipileDelete(`/accounts/${account.unipile_account_id}`);
      logger.info(`[LinkedIn Accounts] Deleted from Unipile: ${account.unipile_account_id}`);
    } catch (error: any) {
      logger.warn(`[LinkedIn Accounts] Failed to delete from Unipile (may already be gone): ${error.message}`);
    }

    // Mark as inactive in Supabase
    const { error: updateError } = await supabaseAdmin
      .from('connected_accounts')
      .update({
        is_active: false,
        sync_status: 'disconnected',
        sync_error: 'Account disconnected by user',
      })
      .eq('id', accountId);

    if (updateError) throw updateError;

    logger.info(`[LinkedIn Accounts] Account ${accountId} (${account.account_name}) disconnected successfully`);
  } catch (error: any) {
    logger.error('[LinkedIn Accounts] Failed to disconnect account:', error);
    throw new Error(`Failed to disconnect LinkedIn account: ${error.message}`);
  }
}

/**
 * Get account by ID
 */
export async function getLinkedInAccountById(accountId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('connected_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('account_type', 'linkedin')
      .single();

    if (error) throw error;

    return data;
  } catch (error: any) {
    logger.error('[LinkedIn Accounts] Failed to get account:', error);
    throw new Error(`Failed to get LinkedIn account: ${error.message}`);
  }
}
