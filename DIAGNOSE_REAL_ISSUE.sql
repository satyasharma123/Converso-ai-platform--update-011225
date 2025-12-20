-- DIAGNOSE THE REAL EMAIL ISSUE
-- Check what's actually in the database

-- 1. Check conversations table
SELECT 
  'CONVERSATIONS TABLE' as section,
  id,
  conversation_type,
  sender_name,
  sender_email,
  subject,
  received_on_account_id,
  created_at
FROM conversations
WHERE conversation_type = 'email'
ORDER BY created_at DESC
LIMIT 10;

-- 2. Check messages table
SELECT 
  'MESSAGES TABLE' as section,
  id,
  conversation_id,
  provider,
  provider_folder,
  sender_name,
  sender_email,
  subject,
  is_from_lead,
  created_at
FROM messages
WHERE provider IN ('gmail', 'outlook')
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check connected accounts
SELECT 
  'CONNECTED ACCOUNTS' as section,
  id,
  account_type,
  account_email,
  oauth_provider,
  is_active
FROM connected_accounts
WHERE account_type = 'email';

-- 4. Check if conversations have messages
SELECT 
  'CONVERSATION-MESSAGE RELATIONSHIP' as section,
  c.id as conversation_id,
  c.subject,
  c.sender_email as conv_sender,
  COUNT(m.id) as message_count,
  STRING_AGG(DISTINCT m.provider_folder, ', ') as folders
FROM conversations c
LEFT JOIN messages m ON c.id = m.conversation_id
WHERE c.conversation_type = 'email'
GROUP BY c.id, c.subject, c.sender_email
ORDER BY c.created_at DESC
LIMIT 10;

