-- ===================================================================
-- CHECK SENT FOLDER SYNC STATUS
-- ===================================================================

-- Step 1: Check if sent emails exist in database
SELECT 
  'Sent emails in database' as check_name,
  COUNT(*) as count,
  MAX(created_at) as most_recent,
  MIN(created_at) as oldest
FROM conversations
WHERE conversation_type = 'email'
  AND email_folder = 'sent';

-- Expected: 
--   If 0: Sent folder hasn't been synced yet ← THIS IS LIKELY YOUR ISSUE
--   If >0: Sent emails exist, frontend filter issue

-- Step 2: Check sync status for your email accounts
SELECT 
  'Email account sync status' as check_name,
  ca.account_email,
  ca.account_type,
  ss.status,
  ss.last_synced_at,
  ss.sync_error
FROM connected_accounts ca
LEFT JOIN sync_status ss ON ss.account_id = ca.id
WHERE ca.account_type = 'email'
ORDER BY ca.account_email;

-- Expected: status = 'completed' or 'in_progress'

-- Step 3: Check ALL email folders synced
SELECT 
  'Email folders in database' as check_name,
  COALESCE(email_folder, 'NULL') as folder,
  COUNT(*) as count,
  MAX(email_timestamp) as most_recent_email,
  COUNT(CASE WHEN is_read = false THEN 1 END) as unread_count
FROM conversations
WHERE conversation_type = 'email'
GROUP BY email_folder
ORDER BY count DESC;

-- Expected folders: inbox, sent, archive, drafts, important, deleted
-- If 'sent' is missing → Sent folder not synced yet

-- Step 4: Check if you have sent any emails from Gmail/Outlook
-- (This checks provider's sent folder, not our database)
-- You need to check Gmail/Outlook directly

-- ===================================================================
-- DIAGNOSIS:
-- ===================================================================
-- If Step 1 shows 0 sent emails:
--   → Sent folder has NOT been synced from provider yet
--   → SOLUTION: Trigger email sync manually OR wait for auto-sync
--
-- If Step 1 shows sent emails exist:
--   → Frontend filter issue
--   → SOLUTION: Check browser console for errors
--
-- ===================================================================




