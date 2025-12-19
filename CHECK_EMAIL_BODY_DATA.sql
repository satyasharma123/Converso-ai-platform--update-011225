-- Check if emails still have their body/preview data after cleanup
SELECT 
  id,
  sender_name,
  sender_email,
  subject,
  email_folder,
  CASE 
    WHEN email_body_html IS NOT NULL THEN 'Has HTML body'
    WHEN email_body IS NOT NULL THEN 'Has legacy body'
    WHEN preview IS NOT NULL THEN 'Has preview only'
    ELSE 'NO DATA'
  END as body_status,
  LENGTH(COALESCE(email_body_html, email_body, preview, '')) as content_length,
  has_full_body,
  email_body_fetched_at,
  gmail_message_id,
  outlook_message_id,
  created_at
FROM conversations
WHERE conversation_type = 'email'
  AND email_folder = 'inbox'
ORDER BY created_at DESC
LIMIT 10;

-- Check if there are any emails with NO content at all
SELECT 
  'Emails with NO content' as check_name,
  COUNT(*) as count
FROM conversations
WHERE conversation_type = 'email'
  AND email_folder = 'inbox'
  AND email_body_html IS NULL
  AND email_body IS NULL
  AND preview IS NULL;

-- Check total inbox emails
SELECT 
  'Total inbox emails' as check_name,
  COUNT(*) as count
FROM conversations
WHERE conversation_type = 'email'
  AND email_folder = 'inbox';
