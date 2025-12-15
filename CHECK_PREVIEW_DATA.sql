-- Check if LinkedIn conversations have preview data
-- Run this in Supabase SQL Editor to verify the data

-- Check all LinkedIn conversations and their preview status
SELECT 
  id,
  sender_name,
  subject,
  CASE 
    WHEN preview IS NULL THEN '❌ NULL'
    WHEN preview = '' THEN '⚠️ EMPTY'
    ELSE '✅ HAS PREVIEW'
  END as preview_status,
  LENGTH(preview) as preview_length,
  LEFT(preview, 100) as preview_sample,
  last_message_at,
  created_at
FROM conversations
WHERE conversation_type = 'linkedin'
ORDER BY last_message_at DESC
LIMIT 20;

-- Summary statistics
SELECT 
  COUNT(*) as total_linkedin_conversations,
  COUNT(preview) as conversations_with_preview,
  COUNT(*) - COUNT(preview) as conversations_without_preview,
  ROUND(COUNT(preview) * 100.0 / COUNT(*), 2) as percentage_with_preview
FROM conversations
WHERE conversation_type = 'linkedin';

-- Check messages for a specific conversation (replace with actual conversation_id)
-- SELECT 
--   id,
--   content,
--   LENGTH(content) as content_length,
--   created_at,
--   is_from_lead
-- FROM messages
-- WHERE conversation_id = 'YOUR_CONVERSATION_ID_HERE'
-- ORDER BY created_at DESC
-- LIMIT 10;
