-- ===================================================================
-- CHECK CONNECTED ACCOUNTS - Find out where they are
-- ===================================================================

-- 1. Check all connected accounts (any workspace)
SELECT 
  '1. All connected accounts' as check_name,
  id,
  account_type,
  oauth_provider,
  account_email,
  workspace_id,
  user_id,
  is_active,
  created_at
FROM connected_accounts
ORDER BY created_at DESC
LIMIT 10;

-- 2. Check user's workspace
SELECT 
  '2. Your workspace' as check_name,
  w.id as workspace_id,
  w.name,
  p.id as user_id,
  p.email as user_email
FROM workspaces w
JOIN profiles p ON p.workspace_id = w.id
ORDER BY w.created_at DESC
LIMIT 5;

-- 3. Check email accounts by type
SELECT 
  '3. Email accounts by provider' as check_name,
  oauth_provider,
  COUNT(*) as count,
  MAX(created_at) as last_created
FROM connected_accounts
WHERE account_type = 'email'
GROUP BY oauth_provider;

-- 4. Check if accounts are inactive
SELECT 
  '4. Inactive email accounts' as check_name,
  account_email,
  oauth_provider,
  is_active,
  created_at
FROM connected_accounts
WHERE account_type = 'email'
  AND is_active = false
ORDER BY created_at DESC;

-- 5. Check recent account activity
SELECT 
  '5. Recent account changes' as check_name,
  account_type,
  account_email,
  is_active,
  created_at
FROM connected_accounts
WHERE account_type = 'email'
ORDER BY created_at DESC
LIMIT 5;

