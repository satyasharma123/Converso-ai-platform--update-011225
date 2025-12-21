-- ============================================================================
-- VERIFICATION SCRIPT - Run this to check the unread count fix
-- ============================================================================

-- 1. Show M Sridharan's conversation details
SELECT 
  '=== M Sridharan Conversation ===' as section,
  id,
  sender_name,
  is_read,
  last_read_at,
  unread_count as current_unread_count,
  last_message_at,
  (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND is_from_lead = true) as total_lead_messages,
  calculate_unread_count(id) as recalculated_count
FROM conversations c
WHERE sender_name ILIKE '%Sridharan%'
ORDER BY last_message_at DESC;

-- 2. Show recent messages for M Sridharan (replace ID after finding it above)
-- Uncomment and replace CONVERSATION_ID after running query #1
/*
SELECT 
  '=== Recent Messages from M Sridharan ===' as section,
  sender_name,
  LEFT(content, 50) as message_preview,
  created_at,
  is_from_lead,
  CASE 
    WHEN created_at > COALESCE((SELECT last_read_at FROM conversations WHERE id = 'CONVERSATION_ID_HERE'), '1900-01-01'::timestamptz)
    THEN '🔵 UNREAD'
    ELSE '✅ READ'
  END as read_status
FROM messages
WHERE conversation_id = 'CONVERSATION_ID_HERE'
ORDER BY created_at DESC
LIMIT 10;
*/

-- 3. Show all LinkedIn conversations with unread counts
SELECT 
  '=== All LinkedIn Conversations ===' as section,
  sender_name,
  is_read,
  last_read_at,
  unread_count,
  calculate_unread_count(id) as correct_count,
  CASE 
    WHEN unread_count != calculate_unread_count(id) THEN '❌ MISMATCH'
    ELSE '✅ CORRECT'
  END as status,
  last_message_at
FROM conversations
WHERE conversation_type = 'linkedin'
ORDER BY last_message_at DESC
LIMIT 20;

-- 4. Count conversations with incorrect unread counts
SELECT 
  '=== Summary ===' as section,
  COUNT(*) as total_linkedin_conversations,
  COUNT(*) FILTER (WHERE unread_count != calculate_unread_count(id)) as conversations_with_wrong_count,
  COUNT(*) FILTER (WHERE unread_count = calculate_unread_count(id)) as conversations_with_correct_count,
  SUM(unread_count) as total_unread_shown,
  SUM(calculate_unread_count(id)) as total_unread_actual
FROM conversations
WHERE conversation_type = 'linkedin';

-- 5. Show example of how the fix works
SELECT 
  '=== How the Fix Works ===' as section,
  'Before: Counted ALL messages from lead' as before,
  'After: Counts only messages after last_read_at' as after,
  'Result: Shows only NEW unread messages' as result;





