-- =====================================================
-- FIX: Unread Count Logic
-- The issue: unread_count should be 0 when conversation is read
-- =====================================================

-- UNDERSTANDING THE PROBLEM:
-- Currently, unread_count counts ALL messages from leads
-- But it should be:
--   - 0 if conversation is marked as read (is_read = true)
--   - Number of messages from leads if unread (is_read = false)

-- The logic is actually CORRECT in the function (line 28-30)
-- But the UPDATE queries are bypassing the function

-- =====================================================
-- CORRECT FIX: Reset counts for READ conversations
-- =====================================================

-- Step 1: Set unread_count to 0 for ALL read conversations
UPDATE conversations
SET unread_count = 0
WHERE is_read = true;

-- Step 2: For UNREAD conversations, keep the count
-- (Only update if is_read = false)
UPDATE conversations
SET unread_count = (
  SELECT COUNT(*)
  FROM messages
  WHERE messages.conversation_id = conversations.id
    AND messages.is_from_lead = true
)
WHERE conversation_type = 'linkedin'
  AND is_read = false;

-- Step 3: Verify the fix
SELECT 
  sender_name,
  is_read,
  unread_count,
  (SELECT COUNT(*) FROM messages WHERE conversation_id = conversations.id AND is_from_lead = true) as total_lead_messages,
  last_message_at
FROM conversations
WHERE conversation_type = 'linkedin'
ORDER BY last_message_at DESC
LIMIT 10;

-- Expected results:
-- - is_read = true  → unread_count = 0
-- - is_read = false → unread_count = total_lead_messages


-- =====================================================
-- EXPLANATION OF THE LOGIC:
-- =====================================================

-- The unread_count should work like this:

-- 1. New message arrives from lead
--    → is_read = false
--    → unread_count = number of messages from lead
--    → Badge shows the count

-- 2. You click the conversation
--    → Frontend calls: PATCH /api/conversations/:id/read { isRead: true }
--    → Backend updates: is_read = true
--    → Trigger sets: unread_count = 0
--    → Badge disappears

-- 3. Another message arrives
--    → Webhook updates: is_read = false
--    → Trigger recalculates: unread_count = new count
--    → Badge appears again


-- =====================================================
-- CHECK: Is the trigger working?
-- =====================================================

-- Check if the trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'conversations'
  AND trigger_name LIKE '%unread%';

-- Expected: reset_unread_count_on_read trigger should exist


-- =====================================================
-- MANUAL TEST: Mark a conversation as read
-- =====================================================

-- Find a conversation with unread_count > 0
SELECT id, sender_name, is_read, unread_count
FROM conversations
WHERE unread_count > 0
LIMIT 1;

-- Copy the ID and test (replace YOUR_CONVERSATION_ID):
-- UPDATE conversations
-- SET is_read = true
-- WHERE id = 'YOUR_CONVERSATION_ID';

-- Check if unread_count became 0:
-- SELECT id, sender_name, is_read, unread_count
-- FROM conversations
-- WHERE id = 'YOUR_CONVERSATION_ID';


-- =====================================================
-- FINAL VERIFICATION
-- =====================================================

SELECT 
  'READ conversations' as category,
  COUNT(*) as total,
  SUM(unread_count) as total_unread_count,
  MAX(unread_count) as max_unread_count
FROM conversations
WHERE conversation_type = 'linkedin'
  AND is_read = true

UNION ALL

SELECT 
  'UNREAD conversations' as category,
  COUNT(*) as total,
  SUM(unread_count) as total_unread_count,
  MAX(unread_count) as max_unread_count
FROM conversations
WHERE conversation_type = 'linkedin'
  AND is_read = false;

-- Expected:
-- READ conversations:   total_unread_count = 0, max_unread_count = 0
-- UNREAD conversations: total_unread_count > 0, max_unread_count > 0




