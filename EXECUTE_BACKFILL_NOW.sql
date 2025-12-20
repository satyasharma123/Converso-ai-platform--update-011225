-- ===================================================================
-- STEP 2: BACKFILL EXISTING EMAIL MESSAGES WITH provider_folder
-- ===================================================================
-- SAFETY: Only touches email messages (NOT LinkedIn)
-- CRITICAL: Must run BEFORE triggering sync
-- ===================================================================

-- Backfill provider_folder for existing email messages
UPDATE messages m
SET provider_folder = COALESCE(c.email_folder, 'inbox')
FROM conversations c
WHERE m.conversation_id = c.id
  AND c.conversation_type = 'email'  -- ✅ SAFETY: Only email messages
  AND m.provider_folder IS NULL;      -- ✅ Only update NULL values

-- Verify backfill results
SELECT 
  'Backfill Results' as status,
  provider_folder,
  COUNT(*) as count
FROM messages m
JOIN conversations c ON c.id = m.conversation_id
WHERE c.conversation_type = 'email'
GROUP BY provider_folder
ORDER BY count DESC;

-- Check remaining NULL (should be 0 for email messages)
SELECT 
  'Remaining NULL for emails' as status,
  COUNT(*) as count
FROM messages m
JOIN conversations c ON c.id = m.conversation_id
WHERE c.conversation_type = 'email'
  AND m.provider_folder IS NULL;

-- ✅ Expected result: All email messages now have provider_folder
-- ✅ LinkedIn messages untouched (no conversation_type filter applied to them)


