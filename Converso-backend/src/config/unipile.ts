/**
 * Unipile API Configuration
 * https://docs.unipile.com
 */

export const UNIPILE_BASE_URL = process.env.UNIPILE_BASE_URL || 'https://api.unipile.com/v1';
export const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY!;
export const UNIPILE_WEBHOOK_SECRET = process.env.UNIPILE_WEBHOOK_SECRET || '';

// LinkedIn DM safety limits
export const LINKEDIN_DAILY_DM_LIMIT = Number(process.env.LINKEDIN_DAILY_DM_LIMIT || 120);
export const LINKEDIN_DAILY_DM_WARN_AT = Number(process.env.LINKEDIN_DAILY_DM_WARN_AT || 80);
export const LINKEDIN_INITIAL_SYNC_DAYS = Number(process.env.LINKEDIN_INITIAL_SYNC_DAYS || 30);

// Validate required config
if (!UNIPILE_API_KEY && process.env.NODE_ENV !== 'test') {
  throw new Error('UNIPILE_API_KEY is required. Please set it in your .env file.');
}

// Log configuration (without secrets)
if (process.env.NODE_ENV !== 'production') {
  console.log('[Unipile Config] Base URL:', UNIPILE_BASE_URL);
  console.log('[Unipile Config] API Key:', UNIPILE_API_KEY ? '***' + UNIPILE_API_KEY.slice(-4) : 'NOT SET');
  console.log('[Unipile Config] Daily DM Limit:', LINKEDIN_DAILY_DM_LIMIT);
  console.log('[Unipile Config] Warn At:', LINKEDIN_DAILY_DM_WARN_AT);
  console.log('[Unipile Config] Initial Sync Days:', LINKEDIN_INITIAL_SYNC_DAYS);
}
