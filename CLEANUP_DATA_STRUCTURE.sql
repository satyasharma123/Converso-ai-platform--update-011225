-- ============================================
-- DATA STRUCTURE CLEANUP
-- Clean up duplicate email data from messages table
-- 
-- IMPORTANT: Run ADD_EMAIL_BODY_COLUMN.sql FIRST!
-- ============================================

-- STEP 1: Show current state
SELECT 
  'Before Cleanup' as stage,
  (SELECT COUNT(*) FROM conversations WHERE conversation_type = 'email') as email_conversations,
  (SELECT COUNT(*) FROM conversations WHERE conversation_type = 'linkedin') as linkedin_conversations,
  (SELECT COUNT(*) FROM messages WHERE conversation_id IN 
    (SELECT id FROM conversations WHERE conversation_type = 'email')) as email_messages_duplicates,
  (SELECT COUNT(*) FROM messages WHERE conversation_id IN 
    (SELECT id FROM conversations WHERE conversation_type = 'linkedin')) as linkedin_messages,
  (SELECT COUNT(*) FROM messages WHERE conversation_id IS NULL) as orphaned_messages;

-- STEP 2: Delete duplicate email messages
-- (Emails should only be in conversations table, not messages table)
DELETE FROM messages 
WHERE conversation_id IN (
  SELECT id FROM conversations WHERE conversation_type = 'email'
);

-- STEP 3: Delete orphaned messages (no conversation_id)
DELETE FROM messages 
WHERE conversation_id IS NULL;

-- STEP 4: Optional - Delete all LinkedIn data if you want a clean start
-- Uncomment the lines below if you want to remove LinkedIn data too:

-- DELETE FROM messages 
-- WHERE conversation_id IN (
--   SELECT id FROM conversations WHERE conversation_type = 'linkedin'
-- );

-- DELETE FROM conversations 
-- WHERE conversation_type = 'linkedin';

-- STEP 5: Show final state
SELECT 
  'After Cleanup' as stage,
  (SELECT COUNT(*) FROM conversations WHERE conversation_type = 'email') as email_conversations,
  (SELECT COUNT(*) FROM conversations WHERE conversation_type = 'linkedin') as linkedin_conversations,
  (SELECT COUNT(*) FROM messages WHERE conversation_id IN 
    (SELECT id FROM conversations WHERE conversation_type = 'email')) as email_messages_should_be_zero,
  (SELECT COUNT(*) FROM messages WHERE conversation_id IN 
    (SELECT id FROM conversations WHERE conversation_type = 'linkedin')) as linkedin_messages,
  (SELECT COUNT(*) FROM messages WHERE conversation_id IS NULL) as orphaned_messages;

-- STEP 6: Verify conversations table structure (optional)
-- Uncomment to check if email_body column exists:
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'conversations' 
--   AND column_name = 'email_body';

-- RESULT: 
-- - email_conversations: Should remain same
-- - email_messages_should_be_zero: Should be 0 (no duplicates)
-- - linkedin_messages: Should remain same (or 0 if deleted)
-- - orphaned_messages: Should be 0
