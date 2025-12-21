-- Check provider_folder distribution for ALL messages
SELECT 
  provider,
  provider_folder,
  COUNT(*) as count,
  COUNT(DISTINCT conversation_id) as unique_conversations
FROM messages
WHERE provider IN ('gmail', 'outlook')
GROUP BY provider, provider_folder
ORDER BY provider, count DESC;

-- Check if the 3 Outlook sent messages have provider_folder set
SELECT 
  id,
  conversation_id,
  subject,
  sender_email,
  provider_folder,
  created_at
FROM messages
WHERE provider = 'outlook'
  AND sender_email = 'satya.sharma@live.in'
ORDER BY created_at DESC
LIMIT 10;


