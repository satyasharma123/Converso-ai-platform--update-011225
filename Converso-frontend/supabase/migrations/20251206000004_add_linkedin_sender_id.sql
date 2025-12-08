-- Add linkedin_sender_id column to store LinkedIn provider internal ID
-- This is different from sender_id (which references internal Supabase users)

-- For messages table
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS linkedin_sender_id TEXT;

-- For conversations table (to store the other participant's LinkedIn ID)
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS linkedin_sender_id TEXT;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_messages_linkedin_sender_id 
  ON public.messages(linkedin_sender_id)
  WHERE linkedin_sender_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_linkedin_sender_id 
  ON public.conversations(linkedin_sender_id)
  WHERE linkedin_sender_id IS NOT NULL;

-- Verify columns were added
SELECT 
  'messages' as table_name,
  column_name,
  data_type,
  'Column added successfully!' as status
FROM information_schema.columns
WHERE table_name = 'messages' 
  AND column_name IN ('linkedin_sender_id', 'sender_linkedin_url')
UNION ALL
SELECT 
  'conversations' as table_name,
  column_name,
  data_type,
  'Column added successfully!' as status
FROM information_schema.columns
WHERE table_name = 'conversations' 
  AND column_name IN ('linkedin_sender_id', 'sender_linkedin_url');
