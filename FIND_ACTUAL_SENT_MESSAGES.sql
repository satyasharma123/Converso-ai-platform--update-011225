-- Find ACTUAL Outlook sent messages
-- These should have been synced from the Sent folder in Outlook

-- Step 1: Check if there are ANY Outlook messages that originated from Sent folder
SELECT 
  id,
  conversation_id,
  subject,
  sender_email,
  provider,
  provider_folder,
  provider_message_id,
  created_at
FROM messages
WHERE provider = 'outlook'
  AND sender_email = 'satya.sharma@live.in'
  AND subject LIKE '%McDonald%'
ORDER BY created_at DESC;

-- Step 2: Check the Outlook message IDs to see if they match the Sent folder
-- We need to verify if these messages were actually synced from Outlook Sent folder
-- or if they're just received messages where you're the sender

-- Step 3: List ALL Outlook messages with provider_folder info
SELECT 
  provider_folder,
  COUNT(*) as count,
  string_agg(DISTINCT subject, ' | ') as sample_subjects
FROM messages
WHERE provider = 'outlook'
GROUP BY provider_folder
ORDER BY provider_folder;


