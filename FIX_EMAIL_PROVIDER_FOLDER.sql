-- ============================================================================
-- FIX EMAIL PROVIDER_FOLDER - Comprehensive Fix for Email Folder Display
-- ============================================================================
-- This script fixes missing provider_folder values for email messages
-- STRICTLY affects only Gmail/Outlook emails - LinkedIn is NEVER touched
-- ============================================================================

-- STEP 1: DIAGNOSTIC - Check current state of email messages
-- ============================================================================
SELECT 
  'DIAGNOSTIC: Current Email Message State' as section,
  provider,
  provider_folder,
  COUNT(*) as message_count
FROM messages
WHERE provider IN ('gmail', 'outlook')  -- ONLY email providers
GROUP BY provider, provider_folder
ORDER BY provider, provider_folder;

-- STEP 2: DIAGNOSTIC - Check LinkedIn messages are separate (should NOT be affected)
-- ============================================================================
SELECT 
  'DIAGNOSTIC: LinkedIn Messages (should be unchanged)' as section,
  provider,
  COUNT(*) as message_count,
  COUNT(*) FILTER (WHERE provider_folder IS NOT NULL) as has_folder
FROM messages
WHERE provider = 'linkedin'
GROUP BY provider;

-- STEP 3: FIX - Set provider_folder='inbox' for email messages with NULL folder
-- ============================================================================
-- Logic: If an email message has no provider_folder set, it's likely from
-- inbox (the default/most common folder). This ensures they show up.
UPDATE messages
SET provider_folder = 'inbox'
WHERE provider IN ('gmail', 'outlook')  -- ONLY email providers
  AND provider_folder IS NULL;

-- STEP 4: FIX - Set provider_folder='sent' for outgoing emails
-- ============================================================================
-- Logic: Emails where sender matches the connected account email are SENT emails
-- First, let's identify sent emails by matching sender to account email
WITH sent_emails AS (
  SELECT 
    m.id as message_id,
    m.sender_email,
    m.provider_folder,
    ca.account_email
  FROM messages m
  JOIN conversations c ON m.conversation_id = c.id
  JOIN connected_accounts ca ON c.received_on_account_id = ca.id
  WHERE m.provider IN ('gmail', 'outlook')  -- ONLY email providers
    AND LOWER(m.sender_email) = LOWER(ca.account_email)  -- Sender matches account
    AND (m.provider_folder IS NULL OR m.provider_folder = 'inbox')  -- Currently wrong folder
)
UPDATE messages
SET provider_folder = 'sent'
WHERE id IN (SELECT message_id FROM sent_emails);

-- STEP 5: VERIFY - Check the fix worked
-- ============================================================================
SELECT 
  'AFTER FIX: Email Message State' as section,
  provider,
  provider_folder,
  COUNT(*) as message_count
FROM messages
WHERE provider IN ('gmail', 'outlook')  -- ONLY email providers
GROUP BY provider, provider_folder
ORDER BY provider, provider_folder;

-- STEP 6: VERIFY - LinkedIn is still untouched
-- ============================================================================
SELECT 
  'VERIFY: LinkedIn Messages (should be same as before)' as section,
  provider,
  COUNT(*) as message_count,
  COUNT(*) FILTER (WHERE provider_folder IS NOT NULL) as has_folder
FROM messages
WHERE provider = 'linkedin'
GROUP BY provider;

-- STEP 7: FIX - Correct is_from_lead for sent emails
-- ============================================================================
-- Sent emails are FROM us (user), not from leads - is_from_lead should be FALSE
UPDATE messages
SET is_from_lead = FALSE
WHERE provider IN ('gmail', 'outlook')  -- ONLY email providers
  AND provider_folder = 'sent';

-- STEP 8: Show sample of fixed sent emails
-- ============================================================================
SELECT 
  'SAMPLE: Fixed Sent Emails' as section,
  m.id,
  m.sender_email,
  m.subject,
  m.provider_folder,
  m.is_from_lead,
  m.provider,
  m.created_at
FROM messages m
WHERE m.provider IN ('gmail', 'outlook')
  AND m.provider_folder = 'sent'
ORDER BY m.created_at DESC
LIMIT 10;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- This script:
-- 1. ✅ Sets provider_folder='inbox' for email messages with NULL folder
-- 2. ✅ Sets provider_folder='sent' for emails where sender matches account
-- 3. ✅ Fixes is_from_lead=FALSE for sent emails (they're from us, not leads)
-- 4. ❌ NEVER touches LinkedIn messages (provider='linkedin')
-- ============================================================================


