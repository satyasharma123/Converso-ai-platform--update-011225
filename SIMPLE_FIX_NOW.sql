-- ============================================================================
-- SIMPLEST FIX - Set last_read_at to 1 hour ago for M Sridharan
-- This will make only messages from the last hour count as unread
-- ============================================================================

-- Option 1: Set last_read_at to 1 hour ago
UPDATE conversations
SET 
  last_read_at = NOW() - INTERVAL '1 hour',
  unread_count = calculate_unread_count(id)
WHERE sender_name ILIKE '%Sridharan%';

-- Verify
SELECT 
  sender_name,
  unread_count,
  last_read_at,
  is_read
FROM conversations
WHERE sender_name ILIKE '%Sridharan%';

-- ============================================================================
-- If you want to mark the conversation as FULLY READ (0 unread):
-- ============================================================================
-- Uncomment and run this instead:
/*
UPDATE conversations
SET 
  is_read = true,
  last_read_at = NOW(),
  unread_count = 0
WHERE sender_name ILIKE '%Sridharan%';
*/



