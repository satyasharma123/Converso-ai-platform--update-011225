-- ============================================
-- Migration: Add RLS policy for users to read their workspace memberships
-- ============================================
-- This allows authenticated users (Admin/SDR/Member) to:
-- - READ their own workspace_members rows
-- - See ALL workspaces they belong to in workspace switcher
-- - Fixes issue where SDR cannot see assigned workspaces

-- Step 1: Check if policy already exists (idempotent)
DO $$
BEGIN
  -- Drop existing policy if it exists (to avoid conflicts)
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'workspace_members' 
    AND policyname = 'Users can read their workspace memberships'
  ) THEN
    DROP POLICY "Users can read their workspace memberships" ON public.workspace_members;
  END IF;
END $$;

-- Step 2: Create the SELECT policy
CREATE POLICY "Users can read their workspace memberships"
ON public.workspace_members
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
);

-- Step 3: Add comment explaining the policy
COMMENT ON POLICY "Users can read their workspace memberships" ON public.workspace_members IS 
'Allows authenticated users to read their own workspace_members rows. This enables workspace switcher to show all workspaces the user belongs to. Secure: users can only see their own memberships.';

