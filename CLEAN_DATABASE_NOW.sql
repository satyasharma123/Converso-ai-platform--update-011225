-- ============================================================================
-- CLEAN DATABASE - Remove Backup Tables and Bad Email Data
-- ============================================================================
-- This will clean up the database and prepare for proper email sync
-- LinkedIn is NEVER touched (provider='linkedin' is excluded)
-- ============================================================================

-- STEP 1: Drop backup tables and views (not needed)
-- ============================================================================
DROP TABLE IF EXISTS conversations_local_sent_backup CASCADE;
DROP TABLE IF EXISTS conversations_sent_duplicates_backup CASCADE;
DROP VIEW IF EXISTS conversation_last_message_preview CASCADE;

-- STEP 2: Delete ALL email messages (they're incorrectly synced)
-- ============================================================================
-- LinkedIn is SAFE - only deleting gmail/outlook messages
DELETE FROM messages 
WHERE provider IN ('gmail', 'outlook');

-- STEP 3: Delete ALL email conversations (sender_email is wrong for all of them)
-- ============================================================================
-- LinkedIn is SAFE - only deleting email conversations
DELETE FROM conversations 
WHERE conversation_type = 'email';

-- STEP 4: Verify cleanup
-- ============================================================================
SELECT 
  'Email Conversations (should be 0)' as check_name,
  COUNT(*) as count
FROM conversations
WHERE conversation_type = 'email'

UNION ALL

SELECT 
  'Email Messages (should be 0)' as check_name,
  COUNT(*) as count
FROM messages
WHERE provider IN ('gmail', 'outlook')

UNION ALL

SELECT 
  'LinkedIn Conversations (should be UNCHANGED)' as check_name,
  COUNT(*) as count
FROM conversations
WHERE conversation_type = 'linkedin'

UNION ALL

SELECT 
  'LinkedIn Messages (should be UNCHANGED)' as check_name,
  COUNT(*) as count
FROM messages
WHERE provider = 'linkedin';

-- ============================================================================
-- After running this, go to Settings → Integrations → Reconnect email accounts
-- ============================================================================

