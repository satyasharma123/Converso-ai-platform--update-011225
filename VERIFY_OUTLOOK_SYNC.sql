-- Verify Outlook Sent & Trash messages were synced
-- Run this in Supabase SQL Editor

SELECT 
  provider_folder, 
  COUNT(*) as message_count
FROM messages 
WHERE provider = 'outlook' 
GROUP BY provider_folder
ORDER BY provider_folder;

-- Expected result:
-- provider_folder | message_count
-- ----------------+--------------
-- archive         | X
-- drafts          | X
-- inbox           | 84
-- sent            | X  ← Should now have messages!
-- trash           | X  ← Should now have messages!


