-- ===================================================================
-- ADD PROVIDER_FOLDER TO MESSAGES TABLE
-- Store folder information at MESSAGE level (not conversation level)
-- ===================================================================

-- Add provider_folder column to messages table
-- This stores which folder this message belongs to: 'inbox', 'sent', 'trash'
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS provider_folder TEXT;

-- Add index for efficient folder-based queries
CREATE INDEX IF NOT EXISTS idx_messages_provider_folder
ON public.messages(provider_folder, created_at DESC)
WHERE provider_folder IS NOT NULL;

-- Add index for conversation + folder queries (for deriving conversation folder from latest message)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_folder
ON public.messages(conversation_id, created_at DESC, provider_folder)
WHERE provider_folder IS NOT NULL;

-- Add provider_message_id for Gmail/Outlook message IDs
-- (Replaces gmail_message_id/outlook_message_id with unified field)
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS provider_message_id TEXT;

-- Add provider_thread_id for Gmail/Outlook thread IDs
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS provider_thread_id TEXT;

-- Add unique constraint to prevent duplicate messages
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_provider_message_id_unique
ON public.messages(provider_message_id, workspace_id)
WHERE provider_message_id IS NOT NULL;

-- ===================================================================
-- COMMENT: email_folder in conversations is now DERIVED from latest message
-- We do NOT remove it for backward compatibility, but it's no longer the source of truth
-- ===================================================================

COMMENT ON COLUMN public.messages.provider_folder IS 'Folder from email provider: inbox, sent, trash, archive, drafts, important';
COMMENT ON COLUMN public.messages.provider_message_id IS 'Unique message ID from Gmail/Outlook provider';
COMMENT ON COLUMN public.messages.provider_thread_id IS 'Thread/conversation ID from Gmail/Outlook provider';


