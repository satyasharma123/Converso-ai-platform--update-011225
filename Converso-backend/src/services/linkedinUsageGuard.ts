/**
 * LinkedIn DM Usage Guard
 * Enforces daily DM limits to protect accounts from LinkedIn restrictions
 */

import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../utils/logger';
import { LINKEDIN_DAILY_DM_LIMIT, LINKEDIN_DAILY_DM_WARN_AT } from '../config/unipile';

interface QuotaCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  warn: boolean;
  error?: string;
}

/**
 * Get daily DM usage for an account
 */
export async function getDailyUsage(accountId: string, date?: Date): Promise<number> {
  try {
    const targetDate = date || new Date();
    const dateString = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD

    const { data, error } = await supabaseAdmin
      .from('linkedin_daily_usage')
      .select('sent_count')
      .eq('account_id', accountId)
      .eq('date', dateString)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found
      throw error;
    }

    return data?.sent_count || 0;
  } catch (error: any) {
    logger.error(`[Usage Guard] Failed to get daily usage for account ${accountId}:`, error);
    return 0;
  }
}

/**
 * Increment daily DM usage counter
 */
export async function incrementDailyUsage(
  accountId: string,
  count: number,
  date?: Date
): Promise<void> {
  try {
    const targetDate = date || new Date();
    const dateString = targetDate.toISOString().split('T')[0];

    // Use upsert to handle both insert and update
    const { error } = await supabaseAdmin
      .from('linkedin_daily_usage')
      .upsert(
        {
          account_id: accountId,
          date: dateString,
          sent_count: await getDailyUsage(accountId, targetDate) + count,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'account_id,date',
        }
      );

    if (error) throw error;

    logger.info(`[Usage Guard] Incremented usage for account ${accountId} by ${count}`);
  } catch (error: any) {
    logger.error(`[Usage Guard] Failed to increment usage for account ${accountId}:`, error);
    throw error;
  }
}

/**
 * Check if sending N DMs is allowed and consume quota if yes
 */
export async function checkAndConsumeDmQuota(
  accountId: string,
  count: number
): Promise<QuotaCheckResult> {
  try {
    const currentUsage = await getDailyUsage(accountId);
    const newUsage = currentUsage + count;

    logger.info(
      `[Usage Guard] Account ${accountId}: ${currentUsage}/${LINKEDIN_DAILY_DM_LIMIT} DMs sent today`
    );

    // Hard stop: Exceeded limit
    if (newUsage > LINKEDIN_DAILY_DM_LIMIT) {
      logger.warn(
        `[Usage Guard] Account ${accountId} BLOCKED: ${newUsage} would exceed limit ${LINKEDIN_DAILY_DM_LIMIT}`
      );

      return {
        allowed: false,
        current: currentUsage,
        limit: LINKEDIN_DAILY_DM_LIMIT,
        remaining: Math.max(0, LINKEDIN_DAILY_DM_LIMIT - currentUsage),
        warn: false,
        error: `Daily LinkedIn DM limit reached (${currentUsage}/${LINKEDIN_DAILY_DM_LIMIT}). To protect your account, we have paused sending for today. The limit will reset tomorrow.`,
      };
    }

    // Allowed but warn if approaching limit
    const shouldWarn = newUsage >= LINKEDIN_DAILY_DM_WARN_AT;

    if (shouldWarn) {
      logger.warn(
        `[Usage Guard] Account ${accountId} WARNING: ${newUsage}/${LINKEDIN_DAILY_DM_LIMIT} (threshold: ${LINKEDIN_DAILY_DM_WARN_AT})`
      );
    }

    // Consume quota
    await incrementDailyUsage(accountId, count);

    return {
      allowed: true,
      current: newUsage,
      limit: LINKEDIN_DAILY_DM_LIMIT,
      remaining: LINKEDIN_DAILY_DM_LIMIT - newUsage,
      warn: shouldWarn,
    };
  } catch (error: any) {
    logger.error(`[Usage Guard] Failed to check quota for account ${accountId}:`, error);

    // On error, fail safe and block
    return {
      allowed: false,
      current: 0,
      limit: LINKEDIN_DAILY_DM_LIMIT,
      remaining: 0,
      warn: false,
      error: 'Unable to verify DM quota. Please try again later.',
    };
  }
}

/**
 * Get usage summary for an account (for UI display)
 */
export async function getUsageSummary(accountId: string): Promise<{
  today: number;
  limit: number;
  remaining: number;
  percentage: number;
  status: 'safe' | 'warning' | 'critical' | 'blocked';
}> {
  try {
    const today = await getDailyUsage(accountId);
    const remaining = Math.max(0, LINKEDIN_DAILY_DM_LIMIT - today);
    const percentage = Math.round((today / LINKEDIN_DAILY_DM_LIMIT) * 100);

    let status: 'safe' | 'warning' | 'critical' | 'blocked' = 'safe';
    if (today >= LINKEDIN_DAILY_DM_LIMIT) {
      status = 'blocked';
    } else if (today >= LINKEDIN_DAILY_DM_WARN_AT) {
      status = 'critical';
    } else if (today >= LINKEDIN_DAILY_DM_WARN_AT * 0.7) {
      // 70% of warning threshold
      status = 'warning';
    }

    return {
      today,
      limit: LINKEDIN_DAILY_DM_LIMIT,
      remaining,
      percentage,
      status,
    };
  } catch (error: any) {
    logger.error(`[Usage Guard] Failed to get usage summary for account ${accountId}:`, error);

    return {
      today: 0,
      limit: LINKEDIN_DAILY_DM_LIMIT,
      remaining: LINKEDIN_DAILY_DM_LIMIT,
      percentage: 0,
      status: 'safe',
    };
  }
}

/**
 * Reset usage for testing (DO NOT USE IN PRODUCTION)
 */
export async function resetDailyUsage(accountId: string): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cannot reset usage in production');
  }

  const today = new Date().toISOString().split('T')[0];

  await supabaseAdmin
    .from('linkedin_daily_usage')
    .delete()
    .eq('account_id', accountId)
    .eq('date', today);

  logger.info(`[Usage Guard] Reset usage for account ${accountId}`);
}
