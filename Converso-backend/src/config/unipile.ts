/**
 * Unipile API Configuration
 */

export const UNIPILE_BASE_URL = process.env.UNIPILE_BASE_URL || 'https://api23.unipile.com:15315/api/v1';
export const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY!;
export const UNIPILE_WEBHOOK_SECRET = process.env.UNIPILE_WEBHOOK_SECRET;

// LinkedIn DM limits
export const LINKEDIN_DAILY_DM_LIMIT = parseInt(process.env.LINKEDIN_DAILY_DM_LIMIT || '120', 10);
export const LINKEDIN_DAILY_DM_WARN_AT = parseInt(process.env.LINKEDIN_DAILY_DM_WARN_AT || '80', 10);
export const LINKEDIN_INITIAL_SYNC_DAYS = parseInt(process.env.LINKEDIN_INITIAL_SYNC_DAYS || '30', 10);

if (!UNIPILE_API_KEY) {
  console.warn('[Unipile Config] UNIPILE_API_KEY is not set! LinkedIn integration will not work.');
}




