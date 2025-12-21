-- Add linkedin_message_id column for LinkedIn upserts
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS linkedin_message_id text;

-- Optional: enforce uniqueness to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS messages_linkedin_message_id_uidx
  ON public.messages(linkedin_message_id)
  WHERE linkedin_message_id IS NOT NULL;








