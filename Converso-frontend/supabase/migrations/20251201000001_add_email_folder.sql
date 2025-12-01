-- Add email_folder column to conversations table
-- This stores which folder/label the email belongs to (inbox, sent, drafts, etc.)

ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS email_folder TEXT DEFAULT 'inbox';

-- Create index for faster folder-based queries
CREATE INDEX IF NOT EXISTS idx_conversations_email_folder 
  ON public.conversations(email_folder) 
  WHERE conversation_type = 'email';

-- Update existing emails to have 'inbox' as default folder
UPDATE public.conversations
SET email_folder = 'inbox'
WHERE conversation_type = 'email' AND email_folder IS NULL;

