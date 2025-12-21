-- Check Outlook account sync status
-- Run this in Supabase SQL Editor

-- 1. Check if last_synced_at was cleared and then updated
SELECT 
  id,
  account_email,
  oauth_provider,
  last_synced_at,
  created_at
FROM connected_accounts
WHERE oauth_provider = 'microsoft';

-- 2. Check all Outlook messages and their folders
SELECT 
  provider_folder,
  subject,
  sender_email,
  created_at,
  html_body IS NOT NULL as has_html_body
FROM messages
WHERE provider = 'outlook'
ORDER BY created_at DESC
LIMIT 20;

-- 3. Check if there are ANY messages with provider_folder = 'sent' or 'trash'
SELECT 
  COUNT(*) FILTER (WHERE provider_folder = 'sent') as sent_count,
  COUNT(*) FILTER (WHERE provider_folder = 'trash') as trash_count,
  COUNT(*) FILTER (WHERE provider_folder = 'inbox') as inbox_count,
  COUNT(*) as total_count
FROM messages
WHERE provider = 'outlook';


