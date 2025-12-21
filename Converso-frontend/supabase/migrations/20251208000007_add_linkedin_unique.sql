-- Ensure linkedin_message_id is unique for upserts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'messages_linkedin_message_id_key'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_linkedin_message_id_key UNIQUE (linkedin_message_id);
  END IF;
END
$$;







