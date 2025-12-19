-- ============================================
-- SDRXS PHASE 1: SDR Visibility via RLS
-- ============================================
-- This migration updates RLS policies on conversations table to enforce:
-- 1. ADMIN users: Can SELECT ALL conversations within their workspace
-- 2. SDR users: Can SELECT ONLY conversations where assigned_to = auth.uid()
-- 3. SDR users CANNOT see unassigned or other users' conversations
--
-- IMPORTANT: This does NOT modify UPDATE/INSERT/DELETE policies (future phases)

-- ============================================
-- Step 1: Create helper function to get user's workspace_id
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_workspace_id(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id
  FROM public.profiles
  WHERE id = _user_id
  LIMIT 1
$$;

COMMENT ON FUNCTION public.get_user_workspace_id(UUID) IS 
'Returns the workspace_id for a given user. Used in RLS policies for workspace isolation.';

-- ============================================
-- Step 2: Drop existing SELECT policies on conversations
-- ============================================

DROP POLICY IF EXISTS "Admins can view all conversations" ON public.conversations;
DROP POLICY IF EXISTS "SDRs can view assigned conversations" ON public.conversations;

-- ============================================
-- Step 3: Create new SELECT policies with workspace isolation
-- ============================================

-- Policy 1: Admins can view all conversations in their workspace
CREATE POLICY "Admins can view workspace conversations"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND workspace_id = public.get_user_workspace_id(auth.uid())
  );

-- Policy 2: SDRs can view ONLY their assigned conversations in their workspace
CREATE POLICY "SDRs can view assigned conversations only"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'sdr')
    AND assigned_to = auth.uid()
    AND workspace_id = public.get_user_workspace_id(auth.uid())
  );

-- ============================================
-- Step 4: Add comments for documentation
-- ============================================

COMMENT ON POLICY "Admins can view workspace conversations" ON public.conversations IS 
'SDRXS Phase 1: Admins can SELECT all conversations within their workspace';

COMMENT ON POLICY "SDRs can view assigned conversations only" ON public.conversations IS 
'SDRXS Phase 1: SDRs can SELECT only conversations explicitly assigned to them (assigned_to = auth.uid())';

-- ============================================
-- Verification Query (for testing)
-- ============================================
-- Run these queries to verify the policies work correctly:
--
-- As Admin (should see all conversations in workspace):
-- SELECT id, sender_name, assigned_to, workspace_id FROM conversations;
--
-- As SDR (should see only assigned conversations):
-- SELECT id, sender_name, assigned_to, workspace_id FROM conversations;
--
-- Test unassigned conversation visibility (SDR should see 0 rows):
-- SELECT COUNT(*) FROM conversations WHERE assigned_to IS NULL;
