-- Check if emails have message IDs and received_account
SELECT 
  id,
  subject,
  gmail_message_id,
  outlook_message_id,
  received_on_account_id,
  CASE 
    WHEN gmail_message_id IS NOT NULL THEN 'Has Gmail ID ✅'
    WHEN outlook_message_id IS NOT NULL THEN 'Has Outlook ID ✅'
    ELSE 'NO MESSAGE ID ❌'
  END as message_id_status
FROM conversations
WHERE conversation_type = 'email'
  AND subject LIKE '%meeting recap%'
LIMIT 5;


