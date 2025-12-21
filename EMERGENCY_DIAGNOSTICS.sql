-- ===================================================================
-- EMERGENCY DIAGNOSTICS - Check what's wrong
-- ===================================================================

-- 1. Check email conversations with bodies
SELECT 
  '1. Email conversations with bodies' as check_name,
  COUNT(*) as total,
  COUNT(email_body_html) as has_html_body,
  COUNT(email_body_text) as has_text_body,
  COUNT(email_body) as has_legacy_body,
  COUNT(preview) as has_preview
FROM conversations
WHERE conversation_type = 'email';

-- 2. Check sample email with body
SELECT 
  '2. Sample email conversation' as check_name,
  id,
  subject,
  LENGTH(email_body_html) as html_length,
  LENGTH(email_body_text) as text_length,
  LENGTH(email_body) as legacy_body_length,
  LENGTH(preview) as preview_length,
  email_body_fetched_at,
  email_folder
FROM conversations
WHERE conversation_type = 'email'
  AND subject IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;

-- 3. Check sent emails in conversations
SELECT 
  '3. Sent emails in conversations' as check_name,
  COUNT(*) as count
FROM conversations
WHERE conversation_type = 'email'
  AND email_folder = 'sent';

-- 4. Check sent messages (new architecture)
SELECT 
  '4. Sent messages (new arch)' as check_name,
  COUNT(*) as count
FROM messages m
JOIN conversations c ON c.id = m.conversation_id
WHERE c.conversation_type = 'email'
  AND m.provider_folder = 'sent';

-- 5. Check trash messages
SELECT 
  '5. Trash messages' as check_name,
  COUNT(*) as count
FROM messages m
JOIN conversations c ON c.id = m.conversation_id
WHERE c.conversation_type = 'email'
  AND m.provider_folder = 'trash';

-- 6. Check if sync is creating conversations vs messages
SELECT 
  '6. Recent email activity' as check_name,
  'conversations' as table_name,
  COUNT(*) as created_today
FROM conversations
WHERE conversation_type = 'email'
  AND created_at >= CURRENT_DATE

UNION ALL

SELECT 
  '6. Recent email activity' as check_name,
  'messages' as table_name,
  COUNT(*) as created_today
FROM messages m
JOIN conversations c ON c.id = m.conversation_id
WHERE c.conversation_type = 'email'
  AND m.created_at >= CURRENT_DATE;



