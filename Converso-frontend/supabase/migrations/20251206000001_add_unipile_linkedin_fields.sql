-- Migration: Add Unipile LinkedIn integration fields
-- Date: 2025-12-06
-- Description: Adds fields needed for Unipile API integration and LinkedIn DM usage tracking

-- =============================================
-- 1. Update connected_accounts table
-- =============================================

-- Add unipile_account_id if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'connected_accounts' AND column_name = 'unipile_account_id'
  ) THEN
    ALTER TABLE connected_accounts 
    ADD COLUMN unipile_account_id TEXT;
    
    COMMENT ON COLUMN connected_accounts.unipile_account_id IS 
    'Unipile account ID for API integration (used for LinkedIn accounts)';
  END IF;
END $$;

-- Ensure oauth_access_token can be null (not used by Unipile)
ALTER TABLE connected_accounts 
ALTER COLUMN oauth_access_token DROP NOT NULL;

-- =============================================
-- 2. Update conversations table
-- =============================================

-- Add provider column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversations' AND column_name = 'provider'
  ) THEN
    ALTER TABLE conversations 
    ADD COLUMN provider TEXT DEFAULT 'email';
    
    COMMENT ON COLUMN conversations.provider IS 
    'Message provider: email, linkedin, etc.';
  END IF;
END $$;

-- Add external_conversation_id if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversations' AND column_name = 'external_conversation_id'
  ) THEN
    ALTER TABLE conversations 
    ADD COLUMN external_conversation_id TEXT;
    
    COMMENT ON COLUMN conversations.external_conversation_id IS 
    'External platform conversation/thread ID (e.g., Unipile conversation ID)';
  END IF;
END $$;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_conversations_external_id 
ON conversations(external_conversation_id);

CREATE INDEX IF NOT EXISTS idx_conversations_provider 
ON conversations(provider);

-- =============================================
-- 3. Update messages table
-- =============================================

-- Add provider column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'provider'
  ) THEN
    ALTER TABLE messages 
    ADD COLUMN provider TEXT DEFAULT 'email';
    
    COMMENT ON COLUMN messages.provider IS 
    'Message provider: email, linkedin, etc.';
  END IF;
END $$;

-- Add external_message_id if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'external_message_id'
  ) THEN
    ALTER TABLE messages 
    ADD COLUMN external_message_id TEXT;
    
    COMMENT ON COLUMN messages.external_message_id IS 
    'External platform message ID (e.g., Unipile message ID)';
  END IF;
END $$;

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_messages_external_id 
ON messages(external_message_id);

CREATE INDEX IF NOT EXISTS idx_messages_provider 
ON messages(provider);

-- =============================================
-- 4. Create linkedin_daily_usage table
-- =============================================

CREATE TABLE IF NOT EXISTS linkedin_daily_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES connected_accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  sent_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure one row per account per day
  UNIQUE(account_id, date)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_linkedin_daily_usage_account_date 
ON linkedin_daily_usage(account_id, date DESC);

-- Add comments
COMMENT ON TABLE linkedin_daily_usage IS 
'Tracks daily LinkedIn DM usage per account to enforce safety limits';

COMMENT ON COLUMN linkedin_daily_usage.account_id IS 
'Connected account ID (must be a LinkedIn account)';

COMMENT ON COLUMN linkedin_daily_usage.date IS 
'Date (UTC) for which usage is tracked';

COMMENT ON COLUMN linkedin_daily_usage.sent_count IS 
'Number of LinkedIn DMs sent on this date';

-- =============================================
-- 5. Enable RLS on new table
-- =============================================

ALTER TABLE linkedin_daily_usage ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own workspace's LinkedIn usage
CREATE POLICY "Users can view linkedin usage for their workspace"
ON linkedin_daily_usage
FOR SELECT
USING (
  account_id IN (
    SELECT ca.id 
    FROM connected_accounts ca
    WHERE ca.workspace_id = (
      SELECT workspace_id FROM profiles WHERE user_id = auth.uid()
    )
  )
);

-- Policy: Service role can manage all usage
CREATE POLICY "Service role can manage all linkedin usage"
ON linkedin_daily_usage
FOR ALL
USING (true);

-- =============================================
-- Success message
-- =============================================

DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully: Unipile LinkedIn fields added';
END $$;
