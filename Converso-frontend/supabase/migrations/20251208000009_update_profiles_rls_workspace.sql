-- ============================================
-- Migration: Update profiles RLS policy to be workspace-aware
-- ============================================
-- This migration ensures users can only view profiles from their own workspace

-- Drop the old policy that allows viewing all profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create new workspace-aware policy for profiles
CREATE POLICY "Users can view profiles in their workspace"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  );

-- Add comment explaining the policy
COMMENT ON POLICY "Users can view profiles in their workspace" ON public.profiles IS 
'Users can only view profiles (team members) from their own workspace';




