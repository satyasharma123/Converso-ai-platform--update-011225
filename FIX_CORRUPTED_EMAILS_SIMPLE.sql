-- ===================================================================
-- FIX CORRUPTED EMAILS - SIMPLE VERSION
-- ===================================================================
-- This is a simplified version that avoids column existence issues
-- ===================================================================

-- STEP 1: Check how many corrupted sent emails exist
SELECT COUNT(*) as corrupted_sent_count
FROM public.conversations
WHERE conversation_type = 'email'  -- ✅ EMAIL ONLY - Never touches LinkedIn!
  AND email_folder = 'sent'
  AND (
    gmail_message_id IS NOT NULL 
    OR outlook_message_id IS NOT NULL
  );

-- STEP 2: See the corrupted emails (optional - to review before deleting)
SELECT 
  id,
  sender_name,
  sender_email,
  subject,
  email_folder,
  email_timestamp
FROM public.conversations
WHERE conversation_type = 'email'
  AND email_folder = 'sent'
  AND (
    gmail_message_id IS NOT NULL 
    OR outlook_message_id IS NOT NULL
  )
ORDER BY email_timestamp DESC
LIMIT 20;

-- STEP 3: DELETE corrupted sent folder emails
-- (Original inbox emails are preserved!)
DELETE FROM public.conversations
WHERE conversation_type = 'email'  -- ✅ EMAIL ONLY - Never touches LinkedIn!
  AND email_folder = 'sent'
  AND (
    gmail_message_id IS NOT NULL 
    OR outlook_message_id IS NOT NULL
    OR gmail_thread_id IS NOT NULL 
    OR outlook_conversation_id IS NOT NULL
  );

-- STEP 4: Verify inbox emails are intact
SELECT 
  'Inbox count' as status,
  COUNT(*) as count
FROM public.conversations
WHERE conversation_type = 'email'
  AND (email_folder = 'inbox' OR email_folder IS NULL);

-- STEP 5: Verify LinkedIn is untouched (simple count)
SELECT 
  'LinkedIn count' as status,
  COUNT(*) as count
FROM public.conversations
WHERE conversation_type = 'linkedin';
