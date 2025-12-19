-- Check if messages exist for email conversations

-- 1. Count email conversations
SELECT 
  'Email Conversations' as section,
  COUNT(*) as total_conversations
FROM conversations
WHERE conversation_type = 'email';

-- 2. Count email messages
SELECT 
  'Email Messages' as section,
  COUNT(*) as total_messages,
  COUNT(DISTINCT conversation_id) as unique_conversations
FROM messages
WHERE provider IN ('gmail', 'outlook');

-- 3. Check if conversations have messages
WITH conv_message_count AS (
  SELECT 
    c.id as conversation_id,
    c.subject,
    COUNT(m.id) as message_count
  FROM conversations c
  LEFT JOIN messages m ON c.id = m.conversation_id
  WHERE c.conversation_type = 'email'
  GROUP BY c.id, c.subject
)
SELECT 
  'Conversations with/without messages' as section,
  CASE 
    WHEN message_count = 0 THEN 'NO MESSAGES'
    ELSE 'HAS MESSAGES'
  END as status,
  COUNT(*) as conversation_count
FROM conv_message_count
GROUP BY status;

-- 4. Sample conversations WITHOUT messages
SELECT 
  'Sample: Conversations WITHOUT messages' as section,
  c.id,
  c.subject,
  c.sender_email,
  c.conversation_type,
  c.created_at
FROM conversations c
LEFT JOIN messages m ON c.id = m.conversation_id
WHERE c.conversation_type = 'email'
  AND m.id IS NULL
LIMIT 10;

-- 5. Check provider field in messages
SELECT 
  'Messages by provider' as section,
  provider,
  COUNT(*) as count
FROM messages
GROUP BY provider;
