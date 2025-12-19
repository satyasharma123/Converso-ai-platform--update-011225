-- Check if preview field exists and has data
SELECT 
  id,
  sender_name,
  sender_email,
  subject,
  CASE 
    WHEN preview IS NULL THEN '❌ NULL'
    WHEN preview = '' THEN '❌ EMPTY STRING'
    WHEN LENGTH(preview) > 0 THEN '✅ HAS PREVIEW (' || LENGTH(preview) || ' chars)'
    ELSE '❓ UNKNOWN'
  END as preview_status,
  LEFT(preview, 100) as preview_snippet,
  email_folder,
  created_at
FROM conversations
WHERE conversation_type = 'email'
  AND (email_folder = 'inbox' OR email_folder IS NULL)
ORDER BY created_at DESC
LIMIT 10;

-- Summary: How many emails have preview vs don't
SELECT 
  CASE 
    WHEN preview IS NULL THEN 'NULL (no preview)'
    WHEN preview = '' THEN 'EMPTY STRING'
    WHEN LENGTH(preview) > 0 THEN 'HAS PREVIEW'
  END as preview_state,
  COUNT(*) as count
FROM conversations
WHERE conversation_type = 'email'
  AND (email_folder = 'inbox' OR email_folder IS NULL)
GROUP BY preview_state;
