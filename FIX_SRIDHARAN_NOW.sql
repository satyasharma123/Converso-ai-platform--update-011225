-- ============================================================================
-- IMMEDIATE FIX FOR M SRIDHARAN - Set proper last_read_at
-- ============================================================================

-- Step 1: Get M Sridharan's conversation ID and messages
SELECT 
  '=== M Sridharan Messages ===' as info,
  id as conversation_id,
  sender_name,
  (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND is_from_lead = true) as total_messages,
  (SELECT MAX(created_at) FROM messages WHERE conversation_id = c.id) as last_message_time
FROM conversations c
WHERE sender_name ILIKE '%Sridharan%';

-- Step 2: Show the last 5 messages to see which ones are new
SELECT 
  '=== Last 5 Messages ===' as info,
  conversation_id,
  sender_name,
  LEFT(content, 50) as message,
  created_at,
  is_from_lead
FROM messages
WHERE conversation_id = (SELECT id FROM conversations WHERE sender_name ILIKE '%Sridharan%' LIMIT 1)
ORDER BY created_at DESC
LIMIT 5;

-- Step 3: Set last_read_at to the timestamp of the 3rd last message
-- This will make only the last 2 messages count as "unread"
UPDATE conversations
SET 
  last_read_at = (
    SELECT created_at 
    FROM messages 
    WHERE conversation_id = conversations.id 
      AND is_from_lead = true
    ORDER BY created_at DESC 
    OFFSET 2  -- Skip the last 2 messages
    LIMIT 1    -- Get the 3rd last message timestamp
  ),
  unread_count = 2  -- Manually set to 2 for now
WHERE sender_name ILIKE '%Sridharan%';

-- Step 4: Trigger recalculation
UPDATE conversations
SET unread_count = calculate_unread_count(id)
WHERE sender_name ILIKE '%Sridharan%';

-- Step 5: Verify the fix
SELECT 
  '=== VERIFICATION ===' as info,
  sender_name,
  unread_count,
  last_read_at,
  (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND is_from_lead = true) as total_messages,
  (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND is_from_lead = true AND created_at > COALESCE(last_read_at, '1900-01-01'::timestamptz)) as calculated_unread
FROM conversations c
WHERE sender_name ILIKE '%Sridharan%';




