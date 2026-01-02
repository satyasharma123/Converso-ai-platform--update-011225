-- ============================================
-- Migration: Fix workspaces SELECT RLS policy for secure workspace access
-- ============================================
-- This ensures users can only SELECT workspaces they belong to via workspace_members
-- Required for WorkspaceContext.fetchWorkspaces() to work correctly
-- Fixes infinite loading issue after signup/workspace creation

-- Step 1: Drop the overly permissive policy if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'workspaces' 
    AND policyname = 'Users can view workspace'
  ) THEN
    DROP POLICY "Users can view workspace" ON public.workspaces;
  END IF;
END $$;

-- Step 2: Create secure SELECT policy that only allows users to see workspaces they belong to
-- This is required for the Supabase join query:
-- .select('workspace_id, role, workspaces:workspaces(id, name, owner_user_id)')
CREATE POLICY "Users can view their workspaces"
ON public.workspaces
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT workspace_id
    FROM public.workspace_members
    WHERE user_id = auth.uid()
  )
);

-- Step 3: Add comment explaining the policy
COMMENT ON POLICY "Users can view their workspaces" ON public.workspaces IS 
'Allows authenticated users to SELECT only workspaces they belong to (via workspace_members). Required for workspace switcher and WorkspaceContext to function. Secure: users cannot see workspaces they are not members of.';

