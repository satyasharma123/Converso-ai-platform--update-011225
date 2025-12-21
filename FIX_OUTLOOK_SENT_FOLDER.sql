-- Fix Outlook Sent messages that have wrong provider_folder
-- This updates existing messages to have the correct folder

-- Step 1: Check current state
SELECT 
  'BEFORE UPDATE' as status,
  provider_folder,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE sender_email = 'satya.sharma@live.in') as sent_by_user
FROM messages
WHERE provider = 'outlook'
GROUP BY provider_folder;

-- Step 2: Update messages sent BY the user to have provider_folder = 'sent'
-- These are messages where sender_email matches the account email
UPDATE messages
SET provider_folder = 'sent'
WHERE provider = 'outlook'
  AND sender_email = 'satya.sharma@live.in'
  AND (provider_folder IS NULL OR provider_folder = 'inbox');

-- Step 3: Verify the fix
SELECT 
  'AFTER UPDATE' as status,
  provider_folder,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE sender_email = 'satya.sharma@live.in') as sent_by_user
FROM messages
WHERE provider = 'outlook'
GROUP BY provider_folder;

-- Step 4: Show sample of updated sent messages
SELECT 
  subject,
  sender_email,
  provider_folder,
  created_at
FROM messages
WHERE provider = 'outlook'
  AND provider_folder = 'sent'
ORDER BY created_at DESC
LIMIT 10;


