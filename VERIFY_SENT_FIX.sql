-- Verify the Sent folder fix worked
SELECT 
  provider_folder,
  COUNT(*) as total_messages,
  COUNT(*) FILTER (WHERE sender_email = 'satya.sharma@live.in') as sent_by_user,
  COUNT(*) FILTER (WHERE sender_email != 'satya.sharma@live.in') as received_from_others
FROM messages
WHERE provider = 'outlook'
GROUP BY provider_folder
ORDER BY provider_folder;


