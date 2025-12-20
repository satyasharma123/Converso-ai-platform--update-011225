-- Add sync tracking columns to conversations table
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS initial_sync_done BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sender_enriched BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS picture_enriched BOOLEAN DEFAULT FALSE;

-- Create indexes for efficient querying during sync
CREATE INDEX IF NOT EXISTS idx_conversations_initial_sync_done
  ON public.conversations(initial_sync_done)
  WHERE conversation_type = 'linkedin' AND initial_sync_done = FALSE;

CREATE INDEX IF NOT EXISTS idx_conversations_sender_enriched
  ON public.conversations(sender_enriched)
  WHERE conversation_type = 'linkedin' AND sender_enriched = FALSE;

CREATE INDEX IF NOT EXISTS idx_conversations_picture_enriched
  ON public.conversations(picture_enriched)
  WHERE conversation_type = 'linkedin' AND picture_enriched = FALSE;

-- Add unique constraint on chat_id for upsert operations
CREATE UNIQUE INDEX IF NOT EXISTS uniq_conversations_chat_id
  ON public.conversations(chat_id)
  WHERE chat_id IS NOT NULL;

-- Ensure provider column exists and has index
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS provider TEXT;

CREATE INDEX IF NOT EXISTS idx_conversations_provider
  ON public.conversations(provider)
  WHERE provider IS NOT NULL;

-- Ensure provider column exists in messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS provider TEXT;

CREATE INDEX IF NOT EXISTS idx_messages_provider
  ON public.messages(provider)
  WHERE provider IS NOT NULL;




