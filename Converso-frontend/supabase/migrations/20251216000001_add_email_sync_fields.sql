-- Migration: Add email sync fields for incremental sync and lazy body loading
-- Date: 2024-12-16
-- Purpose: Support metadata-only sync and lazy body loading for email accounts

-- Add last_synced_at to connected_accounts for incremental sync (email accounts only)
ALTER TABLE public.connected_accounts 
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add email body lazy-loading fields to conversations table
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS email_body_html TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS email_body_text TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS email_body_fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add comment to clarify usage
COMMENT ON COLUMN public.connected_accounts.last_synced_at IS 'Last successful sync timestamp for email accounts (Gmail/Outlook). Used for incremental sync. NULL for LinkedIn accounts.';
COMMENT ON COLUMN public.conversations.email_body_html IS 'Full HTML email body. Fetched lazily on first open. NULL until fetched.';
COMMENT ON COLUMN public.conversations.email_body_text IS 'Plain text version of email body. Optional.';
COMMENT ON COLUMN public.conversations.email_body_fetched_at IS 'Timestamp when email body was fetched from provider. NULL if not yet fetched.';

-- Create index for efficient querying by last_synced_at
CREATE INDEX IF NOT EXISTS idx_connected_accounts_last_synced 
ON public.connected_accounts(last_synced_at) 
WHERE account_type = 'email';

-- Create index for conversations that need body fetching
CREATE INDEX IF NOT EXISTS idx_conversations_body_not_fetched 
ON public.conversations(id, conversation_type) 
WHERE email_body_fetched_at IS NULL AND conversation_type = 'email';




