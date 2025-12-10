-- ============================================
-- FIX: Remove infinite recursion in profiles RLS policy
-- ============================================

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view profiles in their workspace" ON public.profiles;

-- Option 1: Simple policy - users can view their own profile and workspace members
CREATE POLICY "Users can view profiles in their workspace"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    -- User can see their own profile
    id = auth.uid()
    OR
    -- User can see profiles in same workspace (using a direct workspace check)
    workspace_id = (
      SELECT p.workspace_id 
      FROM public.profiles p
      WHERE p.id = auth.uid()
      LIMIT 1
    )
  );

-- Alternative Option 2: If above still has issues, use this simpler version
-- This allows authenticated users to view all profiles (like before)
-- Uncomment if Option 1 doesn't work:
/*
DROP POLICY IF EXISTS "Users can view profiles in their workspace" ON public.profiles;
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);
*/

-- Verify the policy
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd 
FROM pg_policies 
WHERE tablename = 'profiles';

-- Test query (should work without recursion)
SELECT id, email, full_name, workspace_id FROM public.profiles LIMIT 5;
