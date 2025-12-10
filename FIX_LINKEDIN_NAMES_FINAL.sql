-- ============================================
-- FINAL FIX FOR "LINKEDIN CONTACT" NAMES
-- ============================================

-- Check how many need fixing
SELECT COUNT(*) as conversations_to_fix
FROM public.conversations
WHERE conversation_type = 'linkedin'
AND sender_name = 'LinkedIn Contact';

-- Get your connected account ID (COPY THIS VALUE)
SELECT 
  id as "YOUR_CONNECTED_ACCOUNT_ID",
  account_name
FROM public.connected_accounts
WHERE account_type = 'linkedin'
LIMIT 1;
