-- Check if there are any deleted/trash messages
SELECT 
  provider_folder,
  COUNT(*) as message_count
FROM messages
WHERE provider IN ('gmail', 'outlook')
  AND (provider_folder = 'trash' OR provider_folder = 'deleted' OR provider_folder LIKE '%trash%' OR provider_folder LIKE '%delete%')
GROUP BY provider_folder;

-- Check all unique folder values
SELECT DISTINCT provider_folder, COUNT(*) as count
FROM messages
WHERE provider IN ('gmail', 'outlook')
GROUP BY provider_folder
ORDER BY count DESC;
