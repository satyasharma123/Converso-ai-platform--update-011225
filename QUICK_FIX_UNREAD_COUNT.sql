-- =====================================================
-- QUICK FIX: Restore Unread Count System
-- Copy and paste this ENTIRE script into Supabase SQL Editor
-- =====================================================

-- Step 1: Ensure unread_count column exists
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0;

-- Step 2: Create index for performance
CREATE INDEX IF NOT EXISTS idx_conversations_unread_count 
ON public.conversations(unread_count) 
WHERE unread_count > 0;

-- Step 3: Recalculate ALL unread counts
-- For unread LinkedIn conversations
UPDATE conversations
SET unread_count = (
  SELECT COUNT(*)
  FROM messages
  WHERE messages.conversation_id = conversations.id
    AND messages.is_from_lead = true
)
WHERE conversation_type = 'linkedin'
  AND is_read = false;

-- For read conversations, set to 0
UPDATE conversations
SET unread_count = 0
WHERE is_read = true;

-- Step 4: Verify the fix
SELECT 
  'VERIFICATION' as step,
  COUNT(*) FILTER (WHERE is_read = false AND unread_count > 0) as unread_with_count,
  COUNT(*) FILTER (WHERE is_read = false AND unread_count = 0) as unread_without_count,
  COUNT(*) FILTER (WHERE is_read = true AND unread_count = 0) as read_correct,
  SUM(unread_count) as total_unread_messages
FROM conversations
WHERE conversation_type = 'linkedin';

-- Step 5: Show sample results
SELECT 
  sender_name,
  is_read,
  unread_count,
  last_message_at
FROM conversations
WHERE conversation_type = 'linkedin'
ORDER BY last_message_at DESC
LIMIT 10;





