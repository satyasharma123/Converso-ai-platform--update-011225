-- ===================================================================
-- CHECK CURRENT EMAIL DATA
-- Run this to see what's actually in your database
-- ===================================================================

-- 1. How many email conversations exist?
SELECT 
  'Email Conversations' as check_name,
  COUNT(*) as count
FROM conversations
WHERE conversation_type = 'email';

-- 2. How many email messages exist?
SELECT 
  'Email Messages' as check_name,
  COUNT(*) as count
FROM messages
WHERE provider IN ('gmail', 'outlook');

-- 3. What folders do the messages have?
SELECT 
  'Messages by Folder' as check_name,
  provider_folder,
  COUNT(*) as count
FROM messages
WHERE provider IN ('gmail', 'outlook')
GROUP BY provider_folder
ORDER BY count DESC;

-- 4. What is_from_lead values do messages have?
SELECT 
  'Messages by is_from_lead' as check_name,
  is_from_lead,
  COUNT(*) as count
FROM messages
WHERE provider IN ('gmail', 'outlook')
GROUP BY is_from_lead;

-- 5. Sample of 5 email messages to see actual data
SELECT 
  id,
  conversation_id,
  sender_name,
  sender_email,
  provider_folder,
  is_from_lead,
  provider,
  LEFT(subject, 50) as subject_preview
FROM messages
WHERE provider IN ('gmail', 'outlook')
ORDER BY created_at DESC
LIMIT 5;

-- 6. Sample of 5 email conversations to see actual data
SELECT 
  id,
  sender_name,
  sender_email,
  LEFT(subject, 50) as subject_preview,
  conversation_type
FROM conversations
WHERE conversation_type = 'email'
ORDER BY last_message_at DESC
LIMIT 5;
