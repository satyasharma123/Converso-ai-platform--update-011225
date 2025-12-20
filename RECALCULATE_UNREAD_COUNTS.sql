-- Recalculate Unread Counts for LinkedIn Conversations
-- Run this to fix any incorrect unread_count values

-- Step 1: Check current state
SELECT 
  conversation_type,
  is_read,
  COUNT(*) as count,
  AVG(unread_count) as avg_unread_count,
  MAX(unread_count) as max_unread_count
FROM conversations
GROUP BY conversation_type, is_read
ORDER BY conversation_type, is_read;

-- Step 2: Recalculate unread counts for unread LinkedIn conversations
-- This counts actual unread messages from leads
UPDATE conversations
SET unread_count = (
  SELECT COUNT(*)::INTEGER
  FROM messages
  WHERE messages.conversation_id = conversations.id
    AND messages.is_from_lead = true
)
WHERE conversation_type = 'linkedin'
  AND is_read = false;

-- Step 3: Reset to 0 for all read conversations
UPDATE conversations
SET unread_count = 0
WHERE is_read = true;

-- Step 4: Verify the fix
SELECT 
  id,
  sender_name,
  conversation_type,
  is_read,
  unread_count,
  (SELECT COUNT(*) FROM messages WHERE conversation_id = conversations.id AND is_from_lead = true) as actual_unread_messages
FROM conversations
WHERE conversation_type = 'linkedin'
ORDER BY last_message_at DESC
LIMIT 20;

-- Step 5: Check for any discrepancies
SELECT 
  c.id,
  c.sender_name,
  c.unread_count as stored_count,
  COUNT(m.id) as actual_count,
  (c.unread_count - COUNT(m.id)) as difference
FROM conversations c
LEFT JOIN messages m ON m.conversation_id = c.id AND m.is_from_lead = true
WHERE c.conversation_type = 'linkedin' AND c.is_read = false
GROUP BY c.id, c.sender_name, c.unread_count
HAVING c.unread_count != COUNT(m.id)
ORDER BY difference DESC;





