-- Verification Queries for LinkedIn Message Sync
-- Run these queries in your Supabase SQL Editor to verify LinkedIn messages are syncing correctly

-- ============================================
-- 1. Check if LinkedIn messages exist in public.messages
-- ============================================
SELECT 
    COUNT(*) as total_linkedin_messages,
    COUNT(DISTINCT conversation_id) as unique_conversations,
    MIN(created_at) as oldest_message,
    MAX(created_at) as newest_message
FROM public.messages
WHERE linkedin_message_id IS NOT NULL;

-- ============================================
-- 2. Get the latest 20 LinkedIn messages
-- ============================================
SELECT 
    id,
    conversation_id,
    sender_name,
    LEFT(content, 100) as content_preview,
    created_at,
    is_from_lead,
    linkedin_message_id,
    workspace_id
FROM public.messages
WHERE linkedin_message_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;

-- ============================================
-- 3. Check LinkedIn conversations
-- ============================================
SELECT 
    id,
    sender_name,
    subject,
    LEFT(preview, 100) as preview_text,
    last_message_at,
    conversation_type,
    status,
    is_read,
    workspace_id,
    received_on_account_id
FROM public.conversations
WHERE conversation_type = 'linkedin'
ORDER BY last_message_at DESC
LIMIT 20;

-- ============================================
-- 4. Get LinkedIn messages with conversation details
-- ============================================
SELECT 
    c.sender_name as conversation_with,
    c.subject,
    m.sender_name as message_from,
    LEFT(m.content, 80) as message_preview,
    m.created_at as message_time,
    m.is_from_lead,
    m.linkedin_message_id
FROM public.messages m
JOIN public.conversations c ON m.conversation_id = c.id
WHERE m.linkedin_message_id IS NOT NULL
ORDER BY m.created_at DESC
LIMIT 30;

-- ============================================
-- 5. Check connected LinkedIn accounts
-- ============================================
SELECT 
    id,
    account_name,
    account_type,
    unipile_account_id,
    sync_status,
    last_synced_at,
    sync_error,
    is_active,
    workspace_id
FROM public.connected_accounts
WHERE account_type = 'linkedin'
ORDER BY created_at DESC;

-- ============================================
-- 6. Count messages per LinkedIn account
-- Note: Messages are linked via conversations -> received_on_account_id
-- ============================================
SELECT 
    ca.account_name,
    ca.sync_status,
    ca.last_synced_at,
    COUNT(m.id) as message_count,
    MIN(m.created_at) as oldest_message,
    MAX(m.created_at) as newest_message
FROM public.connected_accounts ca
LEFT JOIN public.conversations c ON c.received_on_account_id = ca.id
LEFT JOIN public.messages m ON m.conversation_id = c.id AND m.linkedin_message_id IS NOT NULL
WHERE ca.account_type = 'linkedin'
GROUP BY ca.id, ca.account_name, ca.sync_status, ca.last_synced_at
ORDER BY ca.account_name;

-- ============================================
-- 7. Check for any messages in old linkedin_messages table (if it exists)
-- This table is OBSOLETE and should be empty or dropped
-- ============================================
-- SELECT COUNT(*) FROM public.linkedin_messages;  -- This should be 0 or table shouldn't exist

-- ============================================
-- 8. Verify unique constraint on linkedin_message_id
-- ============================================
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'messages' 
  AND indexname LIKE '%linkedin_message_id%';

-- ============================================
-- Expected Results:
-- ============================================
-- Query 1: Should show the total number of LinkedIn messages synced
-- Query 2: Should show the latest LinkedIn messages with content
-- Query 3: Should show LinkedIn conversations
-- Query 4: Should show messages with conversation context
-- Query 5: Should show your connected LinkedIn accounts with sync status
-- Query 6: Should show message counts per account
-- Query 8: Should show the unique index on linkedin_message_id
