-- =====================================================
-- IMMEDIATE FIX: Reset unread_count for read conversations
-- Run this in Supabase SQL Editor NOW
-- =====================================================

-- This will fix the M Sridharan conversation showing 28 unread
-- when it's actually been read

UPDATE conversations
SET unread_count = 0
WHERE is_read = true;

-- Verify the fix
SELECT 
  sender_name,
  is_read,
  unread_count,
  last_message_at
FROM conversations
WHERE conversation_type = 'linkedin'
  AND sender_name LIKE '%Sridharan%';

-- Expected: M Sridharan should now have unread_count = 0




