-- Update LinkedIn conversations with preview from their latest message
-- This is a one-time fix for existing conversations without previews

-- Update conversations with preview from their latest message
UPDATE conversations c
SET preview = COALESCE(
  LEFT(m.content, 500),
  'No message content'
)
FROM (
  SELECT DISTINCT ON (conversation_id)
    conversation_id,
    content
  FROM messages
  WHERE conversation_id IN (
    SELECT id 
    FROM conversations 
    WHERE conversation_type = 'linkedin' 
    AND (preview IS NULL OR preview = '')
  )
  ORDER BY conversation_id, created_at DESC
) m
WHERE c.id = m.conversation_id
  AND c.conversation_type = 'linkedin'
  AND (c.preview IS NULL OR c.preview = '');

-- Verify the update
SELECT 
  COUNT(*) as total_linkedin_conversations,
  COUNT(preview) as conversations_with_preview,
  COUNT(*) - COUNT(preview) as conversations_without_preview,
  ROUND(COUNT(preview) * 100.0 / COUNT(*), 2) as percentage_with_preview
FROM conversations
WHERE conversation_type = 'linkedin';

-- Show sample of updated conversations
SELECT 
  id,
  sender_name,
  subject,
  LEFT(preview, 100) as preview_sample,
  LENGTH(preview) as preview_length
FROM conversations
WHERE conversation_type = 'linkedin'
  AND preview IS NOT NULL
ORDER BY last_message_at DESC
LIMIT 10;
