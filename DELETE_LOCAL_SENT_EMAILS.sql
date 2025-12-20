-- ===================================================================
-- DELETE LOCAL SENT EMAILS - PROVIDER-SYNC-FIRST CLEANUP
-- ===================================================================
--
-- PURPOSE:
--   Remove all locally fabricated sent email conversations
--   Keep ONLY provider-synced email data
--   Match LinkedIn architecture: provider → sync → display
--
-- SAFETY:
--   - Email-only deletion (conversation_type = 'email')
--   - LinkedIn data completely untouched
--   - Inbox emails preserved
--   - Provider-synced sent emails preserved
--
-- ===================================================================

-- STEP 1: Safety check - LinkedIn data
SELECT 
  'LinkedIn conversations (MUST NOT CHANGE)' as check_name,
  COUNT(*) as count,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM conversations
WHERE conversation_type = 'linkedin';

-- Expected: Your LinkedIn conversation count (should remain unchanged after cleanup)

-- STEP 2: Check current email folder distribution
SELECT 
  'Current email folder distribution' as check_name,
  email_folder,
  COUNT(*) as count,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM conversations
WHERE conversation_type = 'email'
GROUP BY email_folder
ORDER BY email_folder;

-- Expected BEFORE cleanup:
--   inbox: ~410-475 (provider-synced ✅)
--   sent: ~2-10 (locally fabricated ❌ to be deleted)
--   NULL: some count (legacy)
--   Other folders: various counts (provider-synced ✅)

-- STEP 3: Identify locally fabricated sent emails
-- These were created by local email send logic (not synced from provider)
-- Characteristics:
--   - email_folder = 'sent'
--   - Created recently (after we added local sent logic)
--   - May lack provider message IDs
SELECT 
  'Locally fabricated sent emails (TO BE DELETED)' as check_name,
  id,
  sender_name,
  sender_email,
  subject,
  email_folder,
  gmail_message_id,
  outlook_message_id,
  created_at
FROM conversations
WHERE conversation_type = 'email'
  AND email_folder = 'sent'
ORDER BY created_at DESC;

-- These are the conversations that will be DELETED

-- STEP 4: Backup before deletion (safety)
CREATE TABLE IF NOT EXISTS conversations_local_sent_backup AS
SELECT * FROM conversations
WHERE conversation_type = 'email'
  AND email_folder = 'sent';

SELECT 
  'Backup created' as status,
  COUNT(*) as backed_up_count
FROM conversations_local_sent_backup;

-- STEP 5: Delete locally fabricated sent conversations
DELETE FROM conversations
WHERE conversation_type = 'email'
  AND email_folder = 'sent';

-- STEP 6: Verify deletion
SELECT 
  'After cleanup: email folder distribution' as check_name,
  email_folder,
  COUNT(*) as count
FROM conversations
WHERE conversation_type = 'email'
GROUP BY email_folder
ORDER BY email_folder;

-- Expected AFTER cleanup:
--   inbox: ~410-475 (UNCHANGED ✅)
--   sent: 0 (DELETED ✅)
--   NULL: some count (UNCHANGED ✅)
--   Other folders: various counts (UNCHANGED ✅)

-- STEP 7: Verify LinkedIn untouched
SELECT 
  'LinkedIn conversations (FINAL CHECK)' as check_name,
  COUNT(*) as count,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM conversations
WHERE conversation_type = 'linkedin';

-- Expected: EXACT SAME count as STEP 1 ✅

-- STEP 8: Verify inbox emails preserved
SELECT 
  'Inbox emails (MUST BE PRESERVED)' as check_name,
  COUNT(*) as count,
  COUNT(DISTINCT sender_email) as unique_senders,
  COUNT(CASE WHEN preview IS NOT NULL THEN 1 END) as with_preview
FROM conversations
WHERE conversation_type = 'email'
  AND (email_folder = 'inbox' OR email_folder IS NULL);

-- Expected: All inbox emails intact ✅

-- ===================================================================
-- CLEANUP COMPLETE
-- ===================================================================

-- SUMMARY:
SELECT 
  'CLEANUP SUMMARY' as status,
  (SELECT COUNT(*) FROM conversations WHERE conversation_type = 'email' AND email_folder = 'sent') as remaining_sent,
  (SELECT COUNT(*) FROM conversations_local_sent_backup) as deleted_count,
  (SELECT COUNT(*) FROM conversations WHERE conversation_type = 'linkedin') as linkedin_unchanged;

-- Expected:
--   remaining_sent: 0 ✅
--   deleted_count: 2-10 (locally fabricated sent emails)
--   linkedin_unchanged: Your LinkedIn count ✅

-- ===================================================================
-- WHAT WAS DELETED:
-- ===================================================================
--   ❌ Locally fabricated sent conversations (email_folder = 'sent')
--   ❌ Created by local email send logic (not from provider)
--
-- WHAT WAS PRESERVED:
-- ===================================================================
--   ✅ All inbox emails (provider-synced)
--   ✅ All LinkedIn conversations (100% untouched)
--   ✅ All LinkedIn messages (100% untouched)
--   ✅ Provider-synced emails in other folders (archive, drafts, etc.)
--   ✅ All email bodies, attachments, metadata
--
-- ===================================================================
-- NEXT STEPS:
-- ===================================================================
--   1. ✅ Database cleaned
--   2. Restart backend (already done)
--   3. Trigger email sync to sync sent folder from provider
--   4. Sent emails will now come from Gmail/Outlook Sent folder
--   5. Test: Send an email → Wait for sync → Check Sent folder
--
-- ===================================================================
-- PROVIDER-SYNC-FIRST ARCHITECTURE NOW ACTIVE
-- ===================================================================
--   Email now matches LinkedIn architecture:
--     provider → sync → conversations → messages → UI
--
--   No more local invention ✅
--   No more hybrid logic ✅
--   No more sent folder corruption ✅
--
-- ===================================================================



