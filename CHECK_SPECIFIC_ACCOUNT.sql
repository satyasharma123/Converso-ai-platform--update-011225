-- Check if the specific account exists
SELECT * FROM public.connected_accounts 
WHERE id = '3a81a305-a899-439a-af95-e41cb9dc8606';

-- Show all connected accounts
SELECT id, user_id, account_email, account_type, workspace_id, is_active 
FROM public.connected_accounts;

