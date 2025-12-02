-- Force complete refresh of PostgREST schema cache
SELECT pg_notify('pgrst', 'reload schema');
SELECT pg_notify('pgrst', 'reload config');

-- Verify the account exists and show its details
SELECT 
  'ACCOUNT EXISTS' as status,
  id, 
  account_email, 
  account_type,
  oauth_provider,
  workspace_id,
  user_id,
  is_active
FROM public.connected_accounts 
WHERE id = '3a81a305-a899-439a-af95-e41cb9dc8606';


