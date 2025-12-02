-- Fix existing users to have proper status and is_deleted values
-- Run this in Supabase SQL Editor

-- Step 1: Make sure columns exist (in case migration wasn't fully applied)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('invited', 'active'));

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- Step 2: Set is_deleted to false for all existing users (where it's NULL)
UPDATE public.profiles 
SET is_deleted = false 
WHERE is_deleted IS NULL;

-- Step 3: Set status to 'active' for all existing users who have signed up
-- (they exist in the auth.users table, so they've signed up)
UPDATE public.profiles 
SET status = 'active' 
WHERE status IS NULL OR status = 'invited';

-- Step 4: Verify the changes
SELECT 
    id,
    full_name,
    email,
    status,
    is_deleted,
    workspace_id,
    created_at
FROM public.profiles 
ORDER BY created_at DESC;
