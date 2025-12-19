-- ===================================================================
-- FIX CORRUPTED EMAILS - Diagnosis and Repair
-- ===================================================================
-- ISSUE: Some emails show user's name instead of sender name
-- CAUSE: Sent folder creation used provider IDs that conflicted with inbox emails
-- SOLUTION: Delete corrupted sent conversations, keep original inbox emails
-- ===================================================================

-- STEP 1: DIAGNOSE - Find corrupted emails
-- (These will show user's name in sender_name but email provider's email in sender_email)
-- Run this first to see what's corrupted:

SELECT 
  id,
  sender_name,
  sender_email,
  subject,
  email_folder,
  email_timestamp,
  is_read,
  conversation_type
FROM public.conversations
WHERE conversation_type = 'email'  -- ✅ EMAIL ONLY - Never touches LinkedIn!
  AND email_folder IN ('sent', 'inbox')
  AND (
    -- Find emails where sender_name doesn't match sender_email domain
    (sender_name != sender_email AND position('@' in sender_email) > 0)
    OR
    -- Find potential duplicates (same gmail_thread_id or outlook_conversation_id)
    gmail_thread_id IN (
      SELECT gmail_thread_id 
      FROM public.conversations 
      WHERE gmail_thread_id IS NOT NULL 
        AND conversation_type = 'email'
      GROUP BY gmail_thread_id 
      HAVING COUNT(*) > 1
    )
    OR
    outlook_conversation_id IN (
      SELECT outlook_conversation_id 
      FROM public.conversations 
      WHERE outlook_conversation_id IS NOT NULL 
        AND conversation_type = 'email'
      GROUP BY outlook_conversation_id 
      HAVING COUNT(*) > 1
    )
  )
ORDER BY email_timestamp DESC;

-- ===================================================================
-- STEP 2: BACKUP - Create backup before fixing
-- ===================================================================

-- Create a backup table (OPTIONAL but RECOMMENDED)
CREATE TABLE IF NOT EXISTS conversations_backup_20241216 AS 
SELECT * FROM public.conversations 
WHERE conversation_type = 'email';  -- ✅ EMAIL ONLY backup

-- ===================================================================
-- STEP 3: FIX - Delete corrupted sent folder conversations
-- ===================================================================
-- This deletes ONLY sent folder emails that have provider IDs
-- (which shouldn't exist - sent folders are local copies only)
-- Original inbox emails are PRESERVED ✅

DELETE FROM public.conversations
WHERE conversation_type = 'email'  -- ✅ EMAIL ONLY - Never touches LinkedIn!
  AND email_folder = 'sent'         -- Only delete from sent folder
  AND (
    gmail_message_id IS NOT NULL 
    OR outlook_message_id IS NOT NULL
    OR gmail_thread_id IS NOT NULL 
    OR outlook_conversation_id IS NOT NULL
  );

-- This removes sent conversations that were created with provider IDs
-- which could conflict with inbox conversations

-- ===================================================================
-- STEP 4: VERIFY - Check if inbox emails are intact
-- ===================================================================

SELECT 
  'Inbox emails intact' as status,
  COUNT(*) as count
FROM public.conversations
WHERE conversation_type = 'email'
  AND (email_folder = 'inbox' OR email_folder IS NULL)
GROUP BY email_folder;

-- Check sent folder (should be clean now)
SELECT 
  'Sent folder after cleanup' as status,
  COUNT(*) as count
FROM public.conversations
WHERE conversation_type = 'email'
  AND email_folder = 'sent';

-- ===================================================================
-- STEP 5: LINKEDIN SAFETY CHECK (CRITICAL!)
-- ===================================================================
-- Verify LinkedIn conversations are completely untouched

SELECT 
  'LinkedIn conversations (should be UNCHANGED)' as status,
  COUNT(*) as count
FROM public.conversations
WHERE conversation_type = 'linkedin'  -- ✅ LinkedIn check
GROUP BY conversation_type;

-- Detailed LinkedIn check - all fields should be intact
SELECT 
  id,
  sender_name,
  sender_linkedin_url,
  unipile_chat_id,
  linkedin_sender_id,
  last_message_at,
  conversation_type
FROM public.conversations
WHERE conversation_type = 'linkedin'
ORDER BY last_message_at DESC
LIMIT 10;

-- ===================================================================
-- ALTERNATE APPROACH (If Step 3 is too aggressive):
-- Only delete sent conversations created in the last hour
-- ===================================================================

/*
DELETE FROM public.conversations
WHERE conversation_type = 'email'
  AND email_folder = 'sent'
  AND email_timestamp > NOW() - INTERVAL '1 hour'
  AND (
    gmail_message_id IS NOT NULL 
    OR outlook_message_id IS NOT NULL
  );
*/

-- ===================================================================
-- NOTES:
-- ===================================================================
-- 1. All queries use conversation_type = 'email' filter - LinkedIn is NEVER touched
-- 2. Only 'sent' folder emails are deleted, inbox is preserved
-- 3. Backup is created before any deletions
-- 4. LinkedIn safety checks included
-- 5. After fix, future sent emails won't have provider IDs (fixed in code)
