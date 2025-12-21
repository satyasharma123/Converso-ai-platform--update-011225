-- ============================================================================
-- NUCLEAR OPTION: Reset ALL LinkedIn conversations to read with 0 unread
-- ============================================================================

-- Step 1: Mark ALL LinkedIn conversations as read
UPDATE conversations
SET 
  is_read = true,
  last_read_at = NOW(),
  unread_count = 0
WHERE conversation_type = 'linkedin';

-- Step 2: Verify M Sridharan specifically
SELECT 
  '=== M SRIDHARAN AFTER RESET ===' as section,
  sender_name,
  is_read,
  unread_count,
  last_read_at
FROM conversations
WHERE sender_name ILIKE '%Sridharan%';

-- Step 3: Show all LinkedIn conversations
SELECT 
  '=== ALL LINKEDIN CONVERSATIONS ===' as section,
  sender_name,
  is_read,
  unread_count,
  last_read_at
FROM conversations
WHERE conversation_type = 'linkedin'
ORDER BY last_message_at DESC
LIMIT 20;

-- Expected result: ALL conversations should show:
-- is_read = true
-- unread_count = 0
-- last_read_at = [current timestamp]





