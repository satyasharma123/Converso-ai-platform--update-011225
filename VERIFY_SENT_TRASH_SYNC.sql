-- ===================================================================
-- STEP 5: VERIFICATION - Check Sent + Trash Sync Results
-- ===================================================================

-- 1. Check messages by provider_folder
SELECT 
  '1. Messages by folder' as check_name,
  provider_folder,
  COUNT(*) as count,
  MAX(created_at) as most_recent
FROM messages
WHERE provider_folder IS NOT NULL
GROUP BY provider_folder
ORDER BY count DESC;

-- Expected: Should see 'sent' and 'trash' with counts > 0

-- 2. Check email messages specifically
SELECT 
  '2. Email messages by folder' as check_name,
  m.provider_folder,
  COUNT(*) as count
FROM messages m
JOIN conversations c ON c.id = m.conversation_id
WHERE c.conversation_type = 'email'
  AND m.provider_folder IS NOT NULL
GROUP BY m.provider_folder
ORDER BY count DESC;

-- 3. Check for NULL provider_folder in email messages (should be 0)
SELECT 
  '3. NULL provider_folder in emails' as check_name,
  COUNT(*) as count
FROM messages m
JOIN conversations c ON c.id = m.conversation_id
WHERE c.conversation_type = 'email'
  AND m.provider_folder IS NULL;

-- Expected: 0 rows

-- 4. Sample sent emails
SELECT 
  '4. Sample sent emails' as check_name,
  m.subject,
  m.sender_email,
  m.provider_folder,
  m.created_at
FROM messages m
JOIN conversations c ON c.id = m.conversation_id
WHERE c.conversation_type = 'email'
  AND m.provider_folder = 'sent'
ORDER BY m.created_at DESC
LIMIT 5;

-- 5. Sample trash emails
SELECT 
  '5. Sample trash emails' as check_name,
  m.subject,
  m.sender_email,
  m.provider_folder,
  m.created_at
FROM messages m
JOIN conversations c ON c.id = m.conversation_id
WHERE c.conversation_type = 'email'
  AND m.provider_folder = 'trash'
ORDER BY m.created_at DESC
LIMIT 5;

-- 6. Check conversations with derived_folder (via latest message)
WITH latest_messages AS (
  SELECT DISTINCT ON (conversation_id)
    conversation_id,
    provider_folder,
    created_at
  FROM messages
  WHERE provider_folder IS NOT NULL
  ORDER BY conversation_id, created_at DESC
)
SELECT 
  '6. Conversations by derived folder' as check_name,
  lm.provider_folder as derived_folder,
  COUNT(*) as count
FROM conversations c
JOIN latest_messages lm ON lm.conversation_id = c.id
WHERE c.conversation_type = 'email'
GROUP BY lm.provider_folder
ORDER BY count DESC;

-- Expected: Should see 'sent' and 'trash' with counts > 0

-- 7. Check LinkedIn messages NOT touched
SELECT 
  '7. LinkedIn messages (should have NO provider_folder)' as check_name,
  COUNT(*) as total_linkedin_messages,
  COUNT(m.provider_folder) as linkedin_with_provider_folder
FROM messages m
JOIN conversations c ON c.id = m.conversation_id
WHERE c.conversation_type = 'linkedin';

-- Expected: linkedin_with_provider_folder = 0 (LinkedIn untouched)

-- ===================================================================
-- SUCCESS CRITERIA:
-- ===================================================================
-- ✅ Check 1: Shows 'sent' and 'trash' with counts > 0
-- ✅ Check 2: Email messages have provider_folder populated
-- ✅ Check 3: No NULL provider_folder for email messages
-- ✅ Check 4: Sample sent emails exist
-- ✅ Check 5: Sample trash emails exist
-- ✅ Check 6: Conversations derive folder from latest message
-- ✅ Check 7: LinkedIn messages have NO provider_folder (untouched)
-- ===================================================================


