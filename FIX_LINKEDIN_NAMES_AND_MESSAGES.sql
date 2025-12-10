-- ============================================
-- FIX LINKEDIN CONTACT NAMES AND MISSING MESSAGES
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Check which conversations have "LinkedIn Contact" as name
SELECT 
  id,
  sender_name,
  chat_id,
  sender_attendee_id,
  last_message_at
FROM public.conversations
WHERE conversation_type = 'linkedin'
AND sender_name = 'LinkedIn Contact'
ORDER BY last_message_at DESC;

-- Step 2: Check connected LinkedIn accounts
SELECT 
  id,
  account_name,
  unipile_account_id,
  is_active
FROM public.connected_accounts
WHERE account_type = 'linkedin';

-- ============================================
-- After checking the above, note your connected_account_id
-- Then run the sync commands in your terminal (see below)
-- ============================================
