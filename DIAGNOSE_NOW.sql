-- ===================================================================
-- EMERGENCY DIAGNOSIS - Find out what's actually in the database
-- ===================================================================

-- 1. Check total messages count
SELECT 
  '1. Total messages' as check_name,
  COUNT(*) as total_count
FROM messages;

-- 2. Check messages by conversation type
SELECT 
  '2. Messages by conversation type' as check_name,
  c.conversation_type,
  COUNT(*) as count
FROM messages m
LEFT JOIN conversations c ON c.id = m.conversation_id
GROUP BY c.conversation_type;

-- 3. Check if email conversations exist
SELECT 
  '3. Email conversations' as check_name,
  COUNT(*) as count
FROM conversations
WHERE conversation_type = 'email';

-- 4. Check conversations table structure
SELECT 
  '4. Conversations sample' as check_name,
  id,
  conversation_type,
  sender_email,
  subject,
  email_folder,
  gmail_thread_id,
  outlook_conversation_id
FROM conversations
WHERE conversation_type = 'email'
LIMIT 5;

-- 5. Check if messages are linked to conversations
SELECT 
  '5. Messages without conversation link' as check_name,
  COUNT(*) as count
FROM messages
WHERE conversation_id IS NULL;

-- 6. Check messages table structure
SELECT 
  '6. Messages sample' as check_name,
  m.id,
  m.conversation_id,
  m.sender_email,
  m.subject,
  m.provider_folder,
  m.gmail_message_id,
  m.outlook_message_id,
  m.linkedin_message_id
FROM messages m
LIMIT 10;

-- 7. Check if email messages exist but aren't linked properly
SELECT 
  '7. Messages with email indicators' as check_name,
  COUNT(*) as count
FROM messages
WHERE gmail_message_id IS NOT NULL 
   OR outlook_message_id IS NOT NULL;

-- ===================================================================
-- This will tell us:
-- - Do email conversations exist?
-- - Do email messages exist?
-- - Are they linked properly?
-- - What's the actual data structure?
-- ===================================================================

