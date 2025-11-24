-- ============================================
-- Migration: Add OAuth Token Storage to Connected Accounts
-- This allows storing OAuth tokens for Gmail, Outlook, LinkedIn
-- ============================================

-- Add OAuth token columns to connected_accounts table
ALTER TABLE public.connected_accounts
ADD COLUMN IF NOT EXISTS oauth_access_token TEXT,
ADD COLUMN IF NOT EXISTS oauth_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS oauth_token_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS oauth_provider TEXT, -- 'google', 'microsoft', 'linkedin'
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'pending', -- 'pending', 'syncing', 'success', 'error'
ADD COLUMN IF NOT EXISTS sync_error TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_connected_accounts_user_id ON public.connected_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_connected_accounts_oauth_provider ON public.connected_accounts(oauth_provider);

-- Add comment explaining the columns
COMMENT ON COLUMN public.connected_accounts.oauth_access_token IS 'Encrypted OAuth access token for API access';
COMMENT ON COLUMN public.connected_accounts.oauth_refresh_token IS 'Encrypted OAuth refresh token for token renewal';
COMMENT ON COLUMN public.connected_accounts.oauth_token_expires_at IS 'When the access token expires';
COMMENT ON COLUMN public.connected_accounts.oauth_provider IS 'OAuth provider: google, microsoft, or linkedin';
COMMENT ON COLUMN public.connected_accounts.last_synced_at IS 'Last successful sync timestamp';
COMMENT ON COLUMN public.connected_accounts.sync_status IS 'Current sync status';
COMMENT ON COLUMN public.connected_accounts.sync_error IS 'Last sync error message if any';

