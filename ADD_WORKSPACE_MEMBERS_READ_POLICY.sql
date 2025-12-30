-- ============================================
-- Quick Fix: Add RLS policy for workspace_members SELECT
-- ============================================
-- Run this in Supabase SQL Editor (Project → SQL Editor)
-- This allows authenticated users to read their own workspace_members rows

-- Check existing policies first
SELECT policyname, cmd, roles, qual
FROM pg_policies
WHERE tablename = 'workspace_members';

-- Drop policy if it exists (idempotent)
DROP POLICY IF EXISTS "Users can read their workspace memberships" ON public.workspace_members;

-- Create the SELECT policy
CREATE POLICY "Users can read their workspace memberships"
ON public.workspace_members
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
);

-- Verify policy was created
SELECT policyname, cmd, roles, qual
FROM pg_policies
WHERE tablename = 'workspace_members';

-- Expected result: You should see "Users can read their workspace memberships" | SELECT | authenticated

