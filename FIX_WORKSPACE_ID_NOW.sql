-- ===================================================================
-- FIX WORKSPACE_ID FOR EMAIL ACCOUNTS
-- ===================================================================

-- STEP 1: Update existing email accounts to have correct workspace_id
UPDATE connected_accounts
SET workspace_id = 'b60f2c6c-326f-453f-9a7f-2fc80c08413a'
WHERE account_type = 'email'
  AND user_id = '5a8d206b-ea85-4502-bd16-994fe26cb601'
  AND workspace_id IS NULL;

-- STEP 2: Verify the fix
SELECT 
  'After fix' as status,
  id,
  account_email,
  oauth_provider,
  workspace_id,
  user_id,
  is_active
FROM connected_accounts
WHERE account_type = 'email'
ORDER BY created_at DESC;


