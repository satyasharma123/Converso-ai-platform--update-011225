-- ===================================================================
-- BACKFILL PROVIDER_FOLDER FOR EXISTING MESSAGES
-- Copies email_folder from conversations to messages.provider_folder
-- ===================================================================

-- Step 1: Update existing messages with provider_folder from their conversation
-- This handles old messages that were synced before the migration
UPDATE messages m
SET provider_folder = COALESCE(c.email_folder, 'inbox')
FROM conversations c
WHERE m.conversation_id = c.id
  AND c.conversation_type = 'email'
  AND m.provider_folder IS NULL;

-- Step 2: Verify backfill
SELECT 
  'After backfill' as status,
  provider_folder, 
  COUNT(*) as count
FROM messages
WHERE provider_folder IS NOT NULL
GROUP BY provider_folder
ORDER BY count DESC;

-- Step 3: Check remaining NULL
SELECT 
  'Remaining NULL' as status,
  COUNT(*) as count
FROM messages
WHERE provider_folder IS NULL;

-- ✅ Backfill complete!




