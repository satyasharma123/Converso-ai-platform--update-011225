/**
 * Background Email Sync Job
 * Runs incremental sync for all email accounts every 5 minutes
 */

import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../utils/logger';
import { initEmailSync } from '../services/emailSync';

/**
 * Run incremental email sync for all active email accounts
 */
async function runBackgroundEmailSync() {
  try {
    logger.info('[Background Sync] Starting incremental email sync for all accounts');
    
    // Get all active email accounts
    const { data: emailAccounts, error } = await supabaseAdmin
      .from('connected_accounts')
      .select('id, user_id, account_email, oauth_provider')
      .eq('account_type', 'email')
      .eq('is_active', true);
    
    if (error) {
      logger.error('[Background Sync] Error fetching email accounts:', error);
      return;
    }
    
    if (!emailAccounts || emailAccounts.length === 0) {
      logger.info('[Background Sync] No active email accounts found');
      return;
    }
    
    logger.info(`[Background Sync] Found ${emailAccounts.length} email account(s) to sync`);
    
    // Run incremental sync for each account (non-blocking)
    for (const account of emailAccounts) {
      if (!account.user_id) {
        logger.warn(`[Background Sync] Skipping account ${account.id} - no user_id`);
        continue;
      }
      
      // Run sync in background (don't await - let them run in parallel)
      initEmailSync(account.id, account.user_id, 'incremental').catch((error) => {
        logger.error(`[Background Sync] Error syncing account ${account.account_email}:`, error);
      });
    }
    
    logger.info('[Background Sync] Incremental sync initiated for all accounts');
  } catch (error) {
    logger.error('[Background Sync] Fatal error in background sync job:', error);
  }
}

/**
 * Start the background email sync job
 * Runs every 5 minutes if enabled
 */
export function startEmailSyncJob() {
  // Check if background sync is enabled
  const isEnabled = process.env.ENABLE_BACKGROUND_EMAIL_SYNC === 'true';
  
  if (!isEnabled) {
    logger.info('[Background Sync] Background email sync is DISABLED (set ENABLE_BACKGROUND_EMAIL_SYNC=true to enable)');
    return;
  }
  
  logger.info('[Background Sync] Starting background email sync job (every 5 minutes)');
  
  // Run immediately on startup (after 30 seconds delay to let server stabilize)
  setTimeout(() => {
    runBackgroundEmailSync();
  }, 30000);
  
  // Then run every 5 minutes
  setInterval(() => {
    runBackgroundEmailSync();
  }, 5 * 60 * 1000);
}
