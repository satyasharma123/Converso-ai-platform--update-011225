-- ============================================
-- CHECK FOR CORRUPTED INBOX EMAILS
-- ============================================

-- 1. Check inbox emails that have YOUR name as sender (WRONG!)
SELECT 
  id,
  sender_name,
  sender_email,
  subject,
  email_folder,
  email_body_html,
  email_timestamp,
  created_at
FROM conversations
WHERE conversation_type = 'email'
  AND (email_folder = 'inbox' OR email_folder IS NULL)
  AND (sender_name LIKE '%Satya%' OR sender_name LIKE '%Sharma%')
ORDER BY created_at DESC
LIMIT 10;

-- 2. Check for inbox emails with no email body
SELECT 
  id,
  sender_name,
  subject,
  email_folder,
  CASE 
    WHEN email_body_html IS NULL THEN 'NULL html'
    WHEN email_body_html = '' THEN 'EMPTY html'
    WHEN LENGTH(email_body_html) < 50 THEN 'SHORT html'
    ELSE 'OK'
  END as body_status,
  email_timestamp
FROM conversations
WHERE conversation_type = 'email'
  AND (email_folder = 'inbox' OR email_folder IS NULL)
  AND (email_body_html IS NULL OR email_body_html = '' OR LENGTH(email_body_html) < 50)
ORDER BY email_timestamp DESC
LIMIT 10;

-- 3. Show recent sent folder emails (should have YOUR name)
SELECT 
  id,
  sender_name,
  subject,
  email_folder,
  email_timestamp
FROM conversations  
WHERE conversation_type = 'email'
  AND email_folder = 'sent'
ORDER BY email_timestamp DESC
LIMIT 5;

