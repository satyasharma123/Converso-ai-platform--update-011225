-- ============================================================================
-- CLEAN SENT FOLDER DATA - Fix Sent Email Header Display
-- ============================================================================
-- 
-- PROBLEM: Sent emails showing wrong FROM/TO because old messages don't have
-- sender_name, sender_email, or is_from_lead fields populated correctly.
--
-- SOLUTION: Delete sent folder conversations and messages, then re-sync.
--
-- ⚠️ WARNING: This will delete ALL sent folder conversations!
-- Make sure you have a backup or are okay with re-syncing.
-- ============================================================================

-- Step 1: Check what will be deleted
SELECT 
  'SENT MESSAGES TO DELETE' as info,
  COUNT(*) as count,
  COUNT(DISTINCT conversation_id) as conversations_affected
FROM messages 
WHERE provider_folder = 'sent'
AND workspace_id = (SELECT id FROM workspaces LIMIT 1);

-- Step 2: Check conversations that will be deleted
SELECT 
  'SENT CONVERSATIONS TO DELETE' as info,
  COUNT(*) as count
FROM conversations
WHERE id IN (
  SELECT DISTINCT conversation_id 
  FROM messages 
  WHERE provider_folder = 'sent'
  AND workspace_id = (SELECT id FROM workspaces LIMIT 1)
);

-- ============================================================================
-- UNCOMMENT BELOW TO ACTUALLY DELETE (after reviewing above counts)
-- ============================================================================

-- Step 3: Delete sent folder messages
-- DELETE FROM messages 
-- WHERE provider_folder = 'sent' 
-- AND workspace_id = (SELECT id FROM workspaces LIMIT 1);

-- Step 4: Delete conversations that only have sent messages
-- (This will orphan conversations that have both sent and received messages)
-- DELETE FROM conversations 
-- WHERE id IN (
--   SELECT c.id
--   FROM conversations c
--   LEFT JOIN messages m ON m.conversation_id = c.id AND m.provider_folder != 'sent'
--   WHERE c.id IN (
--     SELECT DISTINCT conversation_id 
--     FROM messages 
--     WHERE provider_folder = 'sent'
--     AND workspace_id = (SELECT id FROM workspaces LIMIT 1)
--   )
--   GROUP BY c.id
--   HAVING COUNT(m.id) = 0  -- Only delete if no non-sent messages exist
-- );

-- ============================================================================
-- ALTERNATIVE: Update existing messages with correct sender info
-- ============================================================================
-- 
-- If you don't want to delete, you can try updating existing messages:
-- 
-- UPDATE messages
-- SET 
--   sender_name = COALESCE(sender_name, 'Unknown'),
--   sender_email = COALESCE(sender_email, 'unknown@example.com'),
--   is_from_lead = CASE 
--     WHEN provider_folder = 'sent' THEN false 
--     ELSE true 
--   END
-- WHERE provider_folder = 'sent'
-- AND workspace_id = (SELECT id FROM workspaces LIMIT 1)
-- AND (sender_name IS NULL OR sender_email IS NULL OR is_from_lead IS NULL);
--
-- But this won't fix the FROM/TO swap issue because the data is fundamentally wrong.
-- Better to delete and re-sync.

-- ============================================================================
-- AFTER RUNNING THIS SCRIPT
-- ============================================================================
-- 
-- 1. Go to Settings → Connected Accounts
-- 2. Click "Sync" on your Gmail account (or disconnect/reconnect)
-- 3. Wait for sync to complete (watch Terminal 6)
-- 4. Sent folder emails will be re-synced with correct data
-- 5. FROM/TO will display correctly
-- 
-- ============================================================================

