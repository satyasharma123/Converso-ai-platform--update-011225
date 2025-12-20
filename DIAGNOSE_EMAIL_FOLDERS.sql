-- ============================================================================
-- DIAGNOSE EMAIL FOLDER ISSUE
-- Check why emails are showing in all folders
-- ============================================================================

-- 1. Check message distribution by provider_folder
SELECT 
  'Message Distribution by Folder' as section,
  provider,
  provider_folder,
  COUNT(*) as message_count,
  COUNT(DISTINCT conversation_id) as unique_conversations
FROM messages
WHERE provider IN ('gmail', 'outlook')
GROUP BY provider, provider_folder
ORDER BY provider, provider_folder;

-- 2. Check if conversations have multiple messages in different folders
WITH conversation_folders AS (
  SELECT 
    conversation_id,
    STRING_AGG(DISTINCT provider_folder, ', ' ORDER BY provider_folder) as all_folders,
    COUNT(DISTINCT provider_folder) as folder_count
  FROM messages
  WHERE provider IN ('gmail', 'outlook')
  GROUP BY conversation_id
)
SELECT 
  'Conversations with Multiple Folders' as section,
  folder_count,
  COUNT(*) as conversation_count,
  STRING_AGG(all_folders, ' | ' ORDER BY all_folders) as folder_combinations
FROM conversation_folders
WHERE folder_count > 1
GROUP BY folder_count
ORDER BY folder_count DESC;

-- 3. Sample conversations showing in multiple folders
WITH conversation_folders AS (
  SELECT 
    m.conversation_id,
    c.subject,
    STRING_AGG(DISTINCT m.provider_folder, ', ' ORDER BY m.provider_folder) as all_folders,
    COUNT(DISTINCT m.provider_folder) as folder_count,
    MAX(m.created_at) as latest_message_date,
    (SELECT provider_folder FROM messages WHERE conversation_id = m.conversation_id ORDER BY created_at DESC LIMIT 1) as latest_folder
  FROM messages m
  JOIN conversations c ON m.conversation_id = c.id
  WHERE m.provider IN ('gmail', 'outlook')
  GROUP BY m.conversation_id, c.subject
  HAVING COUNT(DISTINCT m.provider_folder) > 1
)
SELECT 
  'Sample: Conversations in Multiple Folders' as section,
  conversation_id,
  subject,
  all_folders,
  latest_folder,
  latest_message_date
FROM conversation_folders
ORDER BY latest_message_date DESC
LIMIT 10;

-- 4. Check sent emails specifically
SELECT 
  'Sent Emails Check' as section,
  m.id,
  m.conversation_id,
  m.sender_email,
  m.subject,
  m.provider_folder,
  m.is_from_lead,
  ca.account_email as account_email
FROM messages m
JOIN conversations c ON m.conversation_id = c.id
JOIN connected_accounts ca ON c.received_on_account_id = ca.id
WHERE m.provider IN ('gmail', 'outlook')
  AND m.provider_folder = 'sent'
ORDER BY m.created_at DESC
LIMIT 10;

-- 5. Check if sender_email matches account_email for sent folder
SELECT 
  'Sent Folder Validation' as section,
  CASE 
    WHEN LOWER(m.sender_email) = LOWER(ca.account_email) THEN 'Correct'
    ELSE 'WRONG - Received email in Sent folder'
  END as validation,
  COUNT(*) as count
FROM messages m
JOIN conversations c ON m.conversation_id = c.id
JOIN connected_accounts ca ON c.received_on_account_id = ca.id
WHERE m.provider IN ('gmail', 'outlook')
  AND m.provider_folder = 'sent'
GROUP BY validation;

