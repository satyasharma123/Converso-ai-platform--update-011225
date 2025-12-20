-- ===================================================================
-- QUICK APPLY: Add provider_folder to messages table
-- Run this in Supabase SQL Editor
-- ===================================================================

-- Add provider_folder column to messages table
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS provider_folder TEXT;

-- Add index for efficient folder-based queries
CREATE INDEX IF NOT EXISTS idx_messages_provider_folder
ON public.messages(provider_folder, created_at DESC)
WHERE provider_folder IS NOT NULL;

-- Add index for conversation + folder queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation_folder
ON public.messages(conversation_id, created_at DESC, provider_folder)
WHERE provider_folder IS NOT NULL;

-- Add provider_message_id for Gmail/Outlook message IDs
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS provider_message_id TEXT;

-- Add provider_thread_id for Gmail/Outlook thread IDs
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS provider_thread_id TEXT;

-- Add unique constraint to prevent duplicate messages
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_provider_message_id_unique
ON public.messages(provider_message_id, workspace_id)
WHERE provider_message_id IS NOT NULL;

-- Verify columns added
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'messages' 
  AND column_name IN ('provider_folder', 'provider_message_id', 'provider_thread_id')
ORDER BY column_name;

-- ✅ Migration applied successfully!



