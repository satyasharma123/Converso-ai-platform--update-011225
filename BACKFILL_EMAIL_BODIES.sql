-- ================================================
-- BACKFILL EMAIL BODIES FOR EXISTING MESSAGES
-- Fetch and store html_body and text_body for messages that don't have them
-- ================================================

-- This query identifies messages that need body fetching
-- These are email messages that have provider message IDs but no body content

SELECT 
  m.id,
  m.conversation_id,
  m.sender_name,
  m.subject,
  m.created_at,
  m.gmail_message_id,
  m.outlook_message_id,
  m.html_body,
  m.text_body,
  c.received_on_account_id,
  ca.oauth_provider
FROM messages m
JOIN conversations c ON c.id = m.conversation_id
JOIN connected_accounts ca ON ca.id = c.received_on_account_id
WHERE 
  -- Email messages only (not LinkedIn)
  m.conversation_type = 'email'
  -- Messages that have provider IDs
  AND (m.gmail_message_id IS NOT NULL OR m.outlook_message_id IS NOT NULL)
  -- But don't have body content
  AND (m.html_body IS NULL OR m.html_body = '')
  AND (m.text_body IS NULL OR m.text_body = '')
ORDER BY m.created_at DESC
LIMIT 100;

-- ================================================
-- MANUAL BACKFILL INSTRUCTIONS
-- ================================================

-- This query shows you which messages need body fetching.
-- The email bodies need to be fetched from Gmail/Outlook API.

-- To trigger body fetching for these messages:
-- 1. Open each email conversation in the UI
-- 2. The lazy-loading logic will automatically fetch the body
-- 3. Or, run a backend script to fetch bodies in bulk

-- ================================================
-- ALTERNATIVE: Trigger re-sync for recent emails
-- ================================================

-- If you want to re-sync recent emails to get their bodies:
-- 1. Delete messages without bodies (they'll be re-synced)
-- 2. Trigger email sync manually via API
-- 3. Or wait for next scheduled sync

-- Count of messages needing body fetch by provider
SELECT 
  ca.oauth_provider,
  ca.account_email,
  COUNT(*) as messages_without_body
FROM messages m
JOIN conversations c ON c.id = m.conversation_id
JOIN connected_accounts ca ON ca.id = c.received_on_account_id
WHERE 
  m.conversation_type = 'email'
  AND (m.gmail_message_id IS NOT NULL OR m.outlook_message_id IS NOT NULL)
  AND (m.html_body IS NULL OR m.html_body = '')
  AND (m.text_body IS NULL OR m.text_body = '')
GROUP BY ca.oauth_provider, ca.account_email
ORDER BY messages_without_body DESC;
