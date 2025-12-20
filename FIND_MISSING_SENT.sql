-- Find Outlook messages that might be sent messages but have wrong folder
SELECT 
  id,
  subject,
  sender_email,
  provider_folder,
  provider_message_id,
  created_at
FROM messages
WHERE provider = 'outlook'
  AND (
    provider_folder IS NULL 
    OR provider_folder = 'sent'
    OR sender_email = 'satya.sharma@live.in'  -- Messages sent BY the user
  )
ORDER BY created_at DESC
LIMIT 20;

