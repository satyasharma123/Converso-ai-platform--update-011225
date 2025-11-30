-- ========================================
-- CLEANUP DUMMY DATA
-- ========================================
-- This script removes all test/dummy conversations and messages
-- Run this before syncing real emails for a clean start

-- 1. DELETE ALL MESSAGES (cascades are disabled, so delete manually)
-- ========================================
DELETE FROM public.messages;

-- 2. DELETE ALL CONVERSATIONS
-- ========================================
DELETE FROM public.conversations;

-- 3. RESET SYNC STATUS (optional - forces fresh sync)
-- ========================================
DELETE FROM public.sync_status;

-- 4. VERIFY CLEANUP
-- ========================================
-- Check conversations (should be 0)
SELECT 'CONVERSATIONS' AS table_name, COUNT(*) AS remaining_count 
FROM public.conversations;

-- Check messages (should be 0)
SELECT 'MESSAGES' AS table_name, COUNT(*) AS remaining_count 
FROM public.messages;

-- Check sync_status (should be 0)
SELECT 'SYNC_STATUS' AS table_name, COUNT(*) AS remaining_count 
FROM public.sync_status;

-- ========================================
-- CLEANUP COMPLETE!
-- ========================================
-- Next steps:
-- 1. Reload your Email Inbox page
-- 2. Connect email accounts in Settings → Integrations (if not already)
-- 3. Sync will start automatically
-- 4. Fresh emails will appear (no dummy data)
