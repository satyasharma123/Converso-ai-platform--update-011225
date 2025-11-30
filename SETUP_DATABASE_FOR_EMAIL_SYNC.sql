-- ========================================
-- SETUP DATABASE FOR EMAIL SYNC
-- ========================================
-- This script sets up everything needed for email syncing to work properly

-- 1. CREATE DEFAULT WORKSPACE (if not exists)
-- ========================================
DO $$
DECLARE
  workspace_count INTEGER;
BEGIN
  -- Check if workspace already exists
  SELECT COUNT(*) INTO workspace_count FROM public.workspaces;
  
  IF workspace_count = 0 THEN
    -- Create default workspace
    INSERT INTO public.workspaces (name, created_at, updated_at)
    VALUES ('Default Workspace', NOW(), NOW());
    
    RAISE NOTICE 'Created default workspace';
  ELSE
    RAISE NOTICE 'Workspace already exists (% workspaces found)', workspace_count;
  END IF;
END $$;

-- 2. ADD WORKSPACE_ID COLUMNS (if not exists)
-- ========================================
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- 3. ADD EMAIL SYNC FIELDS TO CONVERSATIONS TABLE
-- ========================================
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS gmail_message_id TEXT,
ADD COLUMN IF NOT EXISTS gmail_thread_id TEXT,
ADD COLUMN IF NOT EXISTS outlook_message_id TEXT,
ADD COLUMN IF NOT EXISTS outlook_conversation_id TEXT,
ADD COLUMN IF NOT EXISTS email_timestamp TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS has_full_body BOOLEAN DEFAULT false;

-- 4. ADD EMAIL SYNC FIELDS TO MESSAGES TABLE
-- ========================================
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS gmail_message_id TEXT,
ADD COLUMN IF NOT EXISTS outlook_message_id TEXT,
ADD COLUMN IF NOT EXISTS email_body TEXT;

-- 5. CREATE INDEXES FOR BETTER PERFORMANCE
-- ========================================
CREATE INDEX IF NOT EXISTS idx_conversations_workspace 
  ON public.conversations(workspace_id);
  
CREATE INDEX IF NOT EXISTS idx_messages_workspace 
  ON public.messages(workspace_id);

CREATE INDEX IF NOT EXISTS idx_conversations_email_timestamp 
  ON public.conversations(email_timestamp);

CREATE INDEX IF NOT EXISTS idx_conversations_gmail_message_id 
  ON public.conversations(gmail_message_id);

CREATE INDEX IF NOT EXISTS idx_conversations_outlook_message_id 
  ON public.conversations(outlook_message_id);
  
CREATE INDEX IF NOT EXISTS idx_conversations_outlook_conversation_id 
  ON public.conversations(outlook_conversation_id);
  
CREATE INDEX IF NOT EXISTS idx_messages_gmail_message_id 
  ON public.messages(gmail_message_id);

CREATE INDEX IF NOT EXISTS idx_messages_outlook_message_id 
  ON public.messages(outlook_message_id);

-- 6. CREATE SYNC_STATUS TABLE (if not exists)
-- ========================================
CREATE TABLE IF NOT EXISTS public.sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  inbox_id UUID REFERENCES public.connected_accounts(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'error', 'pending')),
  last_synced_at TIMESTAMP WITH TIME ZONE,
  sync_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, inbox_id)
);

-- Create index for sync_status
CREATE INDEX IF NOT EXISTS idx_sync_status_workspace_inbox 
  ON public.sync_status(workspace_id, inbox_id);

-- Enable RLS on sync_status (if not already enabled)
ALTER TABLE public.sync_status ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view sync status for their workspace" ON public.sync_status;
DROP POLICY IF EXISTS "Admins can manage sync status" ON public.sync_status;

-- RLS policies for sync_status
CREATE POLICY "Users can view sync status for their workspace"
  ON public.sync_status FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage sync status"
  ON public.sync_status FOR ALL
  TO authenticated
  USING (true);

-- 7. UPDATE EXISTING CONVERSATIONS TO HAVE WORKSPACE_ID
-- ========================================
DO $$
DECLARE
  default_workspace_id UUID;
BEGIN
  -- Get the first workspace ID
  SELECT id INTO default_workspace_id FROM public.workspaces LIMIT 1;
  
  IF default_workspace_id IS NOT NULL THEN
    -- Update conversations without workspace_id
    UPDATE public.conversations
    SET workspace_id = default_workspace_id
    WHERE workspace_id IS NULL;
    
    -- Update messages without workspace_id
    UPDATE public.messages
    SET workspace_id = default_workspace_id
    WHERE workspace_id IS NULL;
    
    RAISE NOTICE 'Updated conversations and messages with workspace_id';
  END IF;
END $$;

-- 8. VERIFY THE SETUP
-- ========================================
-- Check workspace
SELECT 'WORKSPACE CHECK' AS check_type, COUNT(*) AS count FROM public.workspaces;

-- Check workspace_id column exists
SELECT 
  'WORKSPACE_ID COLUMNS' AS check_type,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversations' AND column_name = 'workspace_id'
  ) AS conversations_has_workspace_id,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'workspace_id'
  ) AS messages_has_workspace_id;

-- Check email sync fields in conversations
SELECT 
  'EMAIL SYNC FIELDS IN CONVERSATIONS' AS check_type,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversations' AND column_name = 'gmail_message_id'
  ) AS gmail_message_id_exists,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversations' AND column_name = 'outlook_message_id'
  ) AS outlook_message_id_exists,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversations' AND column_name = 'email_timestamp'
  ) AS email_timestamp_exists,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversations' AND column_name = 'has_full_body'
  ) AS has_full_body_exists;

-- Check email sync fields in messages
SELECT 
  'EMAIL SYNC FIELDS IN MESSAGES' AS check_type,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'gmail_message_id'
  ) AS gmail_message_id_exists,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'outlook_message_id'
  ) AS outlook_message_id_exists,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'email_body'
  ) AS email_body_exists;

-- Check sync_status table
SELECT 'SYNC_STATUS TABLE' AS check_type, 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sync_status') AS table_exists;

-- Check connected accounts
SELECT 'CONNECTED ACCOUNTS' AS check_type, COUNT(*) AS count, 
       STRING_AGG(account_type || ': ' || account_email, ', ') AS accounts
FROM public.connected_accounts
WHERE account_type = 'email';

-- Check existing conversations
SELECT 'EXISTING CONVERSATIONS' AS check_type, COUNT(*) AS count
FROM public.conversations
WHERE conversation_type = 'email';

-- ========================================
-- SETUP COMPLETE!
-- ========================================
-- Next steps:
-- 1. Reload your Email Inbox page
-- 2. The system should automatically start syncing emails
-- 3. Check the sync banner at the top for progress
-- 4. If sync doesn't start, go to Settings > Integrations and click "Sync Now"
