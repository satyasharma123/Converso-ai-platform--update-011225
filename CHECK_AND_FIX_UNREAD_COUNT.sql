-- =====================================================
-- CHECK AND FIX UNREAD COUNT SYSTEM
-- Run this in Supabase SQL Editor
-- =====================================================

-- STEP 1: Check if unread_count column exists
-- =====================================================
SELECT 
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'conversations' 
  AND column_name = 'unread_count';

-- If the above returns no rows, the column doesn't exist
-- Run the migration: Converso-frontend/supabase/migrations/20251215000002_add_unread_count.sql


-- STEP 2: Check current unread_count values
-- =====================================================
SELECT 
  id,
  sender_name,
  conversation_type,
  is_read,
  unread_count,
  last_message_at
FROM conversations
WHERE conversation_type = 'linkedin'
ORDER BY last_message_at DESC
LIMIT 10;

-- If unread_count is NULL or 0 for unread conversations, continue to STEP 3


-- STEP 3: Count actual unread messages per conversation
-- =====================================================
SELECT 
  c.id,
  c.sender_name,
  c.is_read,
  c.unread_count as stored_count,
  COUNT(m.id) as actual_count,
  CASE 
    WHEN c.unread_count != COUNT(m.id) THEN '❌ MISMATCH'
    ELSE '✅ OK'
  END as status
FROM conversations c
LEFT JOIN messages m ON m.conversation_id = c.id AND m.is_from_lead = true
WHERE c.conversation_type = 'linkedin'
  AND c.is_read = false
GROUP BY c.id, c.sender_name, c.is_read, c.unread_count
ORDER BY c.last_message_at DESC;


-- STEP 4: Fix unread counts for all LinkedIn conversations
-- =====================================================
-- This will recalculate and update all unread counts

-- For unread conversations, count messages from leads
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
WHERE conversation_type = 'linkedin'
  AND is_read = true;


-- STEP 5: Verify the fix
-- =====================================================
SELECT 
  id,
  sender_name,
  is_read,
  unread_count,
  (
    SELECT COUNT(*)
    FROM messages
    WHERE messages.conversation_id = conversations.id
      AND messages.is_from_lead = true
  ) as actual_message_count,
  CASE 
    WHEN unread_count = (
      SELECT COUNT(*)
      FROM messages
      WHERE messages.conversation_id = conversations.id
        AND messages.is_from_lead = true
    ) THEN '✅ CORRECT'
    ELSE '❌ WRONG'
  END as verification
FROM conversations
WHERE conversation_type = 'linkedin'
  AND is_read = false
ORDER BY last_message_at DESC
LIMIT 10;


-- STEP 6: Check if triggers exist
-- =====================================================
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('conversations', 'messages')
  AND trigger_name LIKE '%unread%';

-- Expected triggers:
-- 1. update_unread_count_on_message_insert (on messages table)
-- 2. reset_unread_count_on_read (on conversations table)


-- STEP 7: Test with a specific conversation
-- =====================================================
-- Replace 'YOUR_CONVERSATION_ID' with an actual conversation ID

SELECT 
  c.id,
  c.sender_name,
  c.is_read,
  c.unread_count,
  COUNT(m.id) FILTER (WHERE m.is_from_lead = true) as lead_messages,
  COUNT(m.id) FILTER (WHERE m.is_from_lead = false) as your_messages,
  COUNT(m.id) as total_messages
FROM conversations c
LEFT JOIN messages m ON m.conversation_id = c.id
WHERE c.id = 'YOUR_CONVERSATION_ID'
GROUP BY c.id, c.sender_name, c.is_read, c.unread_count;


-- STEP 8: Check recent messages
-- =====================================================
SELECT 
  m.id,
  m.conversation_id,
  m.content,
  m.is_from_lead,
  m.sender_name,
  m.created_at,
  c.sender_name as conversation_sender,
  c.unread_count
FROM messages m
JOIN conversations c ON c.id = m.conversation_id
WHERE c.conversation_type = 'linkedin'
ORDER BY m.created_at DESC
LIMIT 20;


-- =====================================================
-- QUICK FIX: If nothing else works
-- =====================================================
-- This will force recalculate all unread counts

DO $$
DECLARE
  conv RECORD;
  msg_count INTEGER;
BEGIN
  FOR conv IN 
    SELECT id, is_read 
    FROM conversations 
    WHERE conversation_type = 'linkedin'
  LOOP
    IF conv.is_read = false THEN
      -- Count unread messages from leads
      SELECT COUNT(*) INTO msg_count
      FROM messages
      WHERE conversation_id = conv.id
        AND is_from_lead = true;
      
      UPDATE conversations
      SET unread_count = msg_count
      WHERE id = conv.id;
    ELSE
      -- Set to 0 for read conversations
      UPDATE conversations
      SET unread_count = 0
      WHERE id = conv.id;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Unread counts recalculated successfully!';
END $$;


-- =====================================================
-- FINAL VERIFICATION
-- =====================================================
SELECT 
  conversation_type,
  is_read,
  COUNT(*) as total_conversations,
  SUM(unread_count) as total_unread_messages,
  AVG(unread_count) as avg_unread_per_conversation,
  MAX(unread_count) as max_unread
FROM conversations
WHERE conversation_type = 'linkedin'
GROUP BY conversation_type, is_read
ORDER BY is_read;

-- Expected output:
-- conversation_type | is_read | total_conversations | total_unread_messages | avg_unread | max_unread
-- linkedin         | false   | X                   | Y                     | Z          | W
-- linkedin         | true    | A                   | 0                     | 0          | 0





