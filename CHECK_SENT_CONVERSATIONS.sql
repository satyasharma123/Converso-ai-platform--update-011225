-- Check if conversations exist for sent messages
-- and verify their derived_folder

-- Step 1: Check messages in sent folder
SELECT 
  'MESSAGES' as type,
  id,
  conversation_id,
  subject,
  sender_email,
  provider_folder,
  created_at
FROM messages
WHERE provider = 'outlook'
  AND provider_folder = 'sent'
ORDER BY created_at DESC;

-- Step 2: Check if conversations exist for these messages
SELECT 
  'CONVERSATIONS' as type,
  c.id,
  c.subject,
  c.sender_email,
  c.email_folder as old_folder,
  c.conversation_type,
  c.received_on_account_id
FROM conversations c
WHERE c.id IN (
  SELECT DISTINCT conversation_id 
  FROM messages 
  WHERE provider = 'outlook' 
    AND provider_folder = 'sent'
);

-- Step 3: Check what derived_folder would be computed
-- (This simulates the backend logic)
WITH latest_messages AS (
  SELECT DISTINCT ON (conversation_id)
    conversation_id,
    provider_folder,
    created_at
  FROM messages
  WHERE provider = 'outlook'
  ORDER BY conversation_id, created_at DESC
)
SELECT 
  c.id as conversation_id,
  c.subject,
  c.sender_email,
  c.email_folder as old_folder,
  lm.provider_folder as derived_folder_from_latest_msg
FROM conversations c
LEFT JOIN latest_messages lm ON lm.conversation_id = c.id
WHERE c.id IN (
  SELECT DISTINCT conversation_id 
  FROM messages 
  WHERE provider = 'outlook' 
    AND provider_folder = 'sent'
)
ORDER BY c.id;
