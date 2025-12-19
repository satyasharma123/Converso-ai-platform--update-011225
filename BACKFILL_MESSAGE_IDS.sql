-- ===================================================================
-- BACKFILL MESSAGE IDS - Populate gmail_message_id and outlook_message_id
-- ===================================================================

-- For each email conversation, get the first message's provider_message_id
-- and store it in the conversation's gmail_message_id or outlook_message_id

-- STEP 1: Backfill Gmail message IDs
UPDATE conversations c
SET gmail_message_id = m.provider_message_id
FROM (
  SELECT DISTINCT ON (conversation_id) 
    conversation_id,
    provider_message_id
  FROM messages
  WHERE provider = 'gmail'
    AND provider_message_id IS NOT NULL
  ORDER BY conversation_id, created_at ASC
) m
WHERE c.id = m.conversation_id
  AND c.conversation_type = 'email'
  AND c.gmail_message_id IS NULL;

-- Check Gmail backfill results
SELECT 
  'Gmail message IDs backfilled' as status,
  COUNT(*) as count
FROM conversations
WHERE conversation_type = 'email'
  AND gmail_message_id IS NOT NULL;

-- STEP 2: Backfill Outlook message IDs
UPDATE conversations c
SET outlook_message_id = m.provider_message_id
FROM (
  SELECT DISTINCT ON (conversation_id) 
    conversation_id,
    provider_message_id
  FROM messages
  WHERE provider = 'outlook'
    AND provider_message_id IS NOT NULL
  ORDER BY conversation_id, created_at ASC
) m
WHERE c.id = m.conversation_id
  AND c.conversation_type = 'email'
  AND c.outlook_message_id IS NULL;

-- Check Outlook backfill results
SELECT 
  'Outlook message IDs backfilled' as status,
  COUNT(*) as count
FROM conversations
WHERE conversation_type = 'email'
  AND outlook_message_id IS NOT NULL;

-- STEP 3: Verify - check a few conversations
SELECT 
  'Sample conversations with message IDs' as status,
  subject,
  gmail_message_id,
  outlook_message_id
FROM conversations
WHERE conversation_type = 'email'
  AND (gmail_message_id IS NOT NULL OR outlook_message_id IS NOT NULL)
LIMIT 5;

