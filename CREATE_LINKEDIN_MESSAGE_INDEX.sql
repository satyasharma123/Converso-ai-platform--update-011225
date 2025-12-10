-- Create Unique Index on linkedin_message_id
-- This is needed for the upsert operation to work
-- Copy and paste this into Supabase SQL Editor and click "Run"

-- Drop existing index if any (to avoid conflicts)
DROP INDEX IF EXISTS public.messages_linkedin_message_id_uidx;

-- Create the unique index
CREATE UNIQUE INDEX messages_linkedin_message_id_uidx
  ON public.messages(linkedin_message_id)
  WHERE linkedin_message_id IS NOT NULL;

-- Verify the index was created
SELECT 
  indexname,
  indexdef,
  'SUCCESS: Index created!' as status
FROM pg_indexes
WHERE tablename = 'messages' 
  AND indexname = 'messages_linkedin_message_id_uidx';
