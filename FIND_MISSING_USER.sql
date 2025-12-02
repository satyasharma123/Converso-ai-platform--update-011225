-- Find the missing user satya@techsavvy.ai

-- Step 1: Check if user exists in auth.users
SELECT 
    id,
    email,
    created_at,
    email_confirmed_at,
    deleted_at
FROM auth.users 
WHERE email = 'satya@techsavvy.ai';

-- Step 2: Check if user exists in profiles
SELECT 
    id,
    full_name,
    email,
    status,
    is_deleted,
    workspace_id,
    created_at
FROM public.profiles 
WHERE email = 'satya@techsavvy.ai';

-- Step 3: Check all profiles to see workspace_ids
SELECT 
    full_name,
    email,
    status,
    is_deleted,
    workspace_id
FROM public.profiles 
ORDER BY created_at DESC;

-- Step 4: If user exists in auth but not in profiles, we need to create the profile
-- We'll do this in the next query after we see the results
