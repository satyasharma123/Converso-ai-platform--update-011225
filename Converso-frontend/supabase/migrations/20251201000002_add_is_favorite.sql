-- Add is_favorite flag to conversations

ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_conversations_is_favorite
  ON public.conversations(is_favorite)
  WHERE conversation_type = 'email';






