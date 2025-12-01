-- Check what data exists and show the issue

-- 1. Check workspaces
SELECT 'WORKSPACES:' as info, id, name FROM public.workspaces;

-- 2. Check profiles and their workspace assignments
SELECT 'PROFILES:' as info, id, email, workspace_id FROM public.profiles;

-- 3. Check connected accounts
SELECT 'CONNECTED_ACCOUNTS:' as info, id, account_email, account_type, workspace_id, user_id FROM public.connected_accounts;

-- 4. Check how many conversations exist
SELECT 'CONVERSATIONS COUNT:' as info, COUNT(*) as total, 
       COUNT(CASE WHEN conversation_type = 'email' THEN 1 END) as emails,
       COUNT(CASE WHEN workspace_id IS NULL THEN 1 END) as missing_workspace
FROM public.conversations;

-- 5. Show sample conversations
SELECT 'SAMPLE CONVERSATIONS:' as info, id, sender_email, subject, workspace_id, received_on_account_id 
FROM public.conversations 
WHERE conversation_type = 'email' 
LIMIT 5;

