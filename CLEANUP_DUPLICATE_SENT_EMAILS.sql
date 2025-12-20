-- ================================================
-- STEP 6: DATABASE CLEANUP
-- Delete duplicate sent email conversations
-- Following LinkedIn architecture: ONE conversation per thread
-- ================================================

-- SAFETY CHECK 1: Verify LinkedIn data is separate
SELECT 
  'LinkedIn conversations (should be unchanged)' as check_name,
  COUNT(*) as count
FROM conversations
WHERE conversation_type = 'linkedin';

-- SAFETY CHECK 2: Current state before cleanup
SELECT 
  'Current email conversations by folder' as check_name,
  email_folder,
  COUNT(*) as count
FROM conversations
WHERE conversation_type = 'email'
GROUP BY email_folder
ORDER BY email_folder;

-- Expected:
-- inbox: ~410
-- sent: ~8 (these are DUPLICATES to be deleted)
-- NULL: some count

-- STEP 1: Backup duplicate sent conversations (safety)
CREATE TABLE IF NOT EXISTS conversations_sent_duplicates_backup AS
SELECT * FROM conversations 
WHERE conversation_type = 'email' 
  AND email_folder = 'sent';

-- Verify backup
SELECT 
  'Backed up sent conversations' as status,
  COUNT(*) as count 
FROM conversations_sent_duplicates_backup;

-- STEP 2: Delete duplicate sent conversations
-- These are fake records created during email send
-- Real sent emails are stored in messages table ✅
DELETE FROM conversations
WHERE conversation_type = 'email'
  AND email_folder = 'sent';

-- STEP 3: Verify cleanup
SELECT 
  'After cleanup: email conversations by folder' as check_name,
  email_folder,
  COUNT(*) as count
FROM conversations
WHERE conversation_type = 'email'
GROUP BY email_folder
ORDER BY email_folder;

-- Expected:
-- inbox: ~410 (unchanged)
-- sent: 0 (deleted!)
-- NULL: some count (unchanged)

-- STEP 4: Verify messages table is intact
SELECT 
  'Messages by conversation type' as check_name,
  c.conversation_type,
  COUNT(DISTINCT m.id) as message_count,
  COUNT(DISTINCT m.conversation_id) as unique_conversations
FROM messages m
JOIN conversations c ON c.id = m.conversation_id
GROUP BY c.conversation_type;

-- Expected:
-- email: All messages intact ✅
-- linkedin: All messages intact ✅

-- STEP 5: Verify sent messages exist (check after migration)
-- NOTE: is_sent column added by migration 20251216000003
-- This step will work after you run the migration
SELECT 
  'Sent email messages (all from user)' as check_name,
  COUNT(*) as sent_message_count
FROM messages m
JOIN conversations c ON c.id = m.conversation_id
WHERE c.conversation_type = 'email'
  AND m.is_from_lead = FALSE;

-- Expected: Count of messages sent by users ✅

-- STEP 6: Verify LinkedIn completely untouched
SELECT 
  'LinkedIn conversations (final check)' as check_name,
  COUNT(*) as count,
  MAX(created_at) as last_created
FROM conversations
WHERE conversation_type = 'linkedin';

-- Expected: Same count as SAFETY CHECK 1 ✅

-- STEP 7: Summary
SELECT 
  'CLEANUP COMPLETE' as status,
  (SELECT COUNT(*) FROM conversations WHERE conversation_type = 'email' AND email_folder = 'sent') as remaining_sent_conversations,
  (SELECT COUNT(*) FROM conversations_sent_duplicates_backup) as backed_up_count,
  (SELECT COUNT(*) FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.conversation_type = 'email' AND m.is_from_lead = FALSE) as user_sent_messages;

-- Expected:
-- remaining_sent_conversations: 0 ✅
-- backed_up_count: ~8 ✅
-- user_sent_messages: ~8 ✅

-- ================================================
-- CLEANUP SCRIPT COMPLETE
-- ================================================

-- WHAT WAS DELETED:
-- - Duplicate "sent" conversation records (email_folder = 'sent')

-- WHAT WAS PRESERVED:
-- - Original inbox email conversations ✅
-- - All sent messages in messages table ✅
-- - All LinkedIn conversations ✅
-- - All LinkedIn messages ✅

-- NEXT STEPS:
-- 1. Run migration: 20251216000003_add_is_sent_to_messages.sql
-- 2. Restart backend server
-- 3. Test inbox folder (should show inbox emails)
-- 4. Test sent folder (should show threads where you replied)
-- 5. Send test reply (should NOT create duplicate)

-- ================================================



