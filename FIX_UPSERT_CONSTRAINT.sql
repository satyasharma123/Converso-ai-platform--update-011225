-- Fix: Add unique constraint for linkedin_message_id to enable upserts
-- This is REQUIRED for .upsert(..., { onConflict: 'linkedin_message_id' }) to work

-- Create unique index on linkedin_message_id (partial index for non-null values only)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_messages_linkedin_message_id 
  ON public.messages(linkedin_message_id) 
  WHERE linkedin_message_id IS NOT NULL;

-- Verify the index was created
SELECT 
  indexname,
  indexdef,
  'Index created successfully!' as status
FROM pg_indexes
WHERE tablename = 'messages' 
  AND indexname = 'uniq_messages_linkedin_message_id';

-- Also verify we can now query by this column efficiently
EXPLAIN SELECT * FROM public.messages WHERE linkedin_message_id = 'test-id';
