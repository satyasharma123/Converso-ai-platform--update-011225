-- Fix RLS Policies to Allow Workspace Creation
-- Copy and paste this ENTIRE script into Supabase SQL Editor and click "Run"

-- ============================================
-- 1. Allow service_role to manage workspaces
-- ============================================

CREATE POLICY IF NOT EXISTS "Service role can manage all workspaces"
  ON public.workspaces FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 2. Allow service_role to manage messages
-- ============================================

CREATE POLICY IF NOT EXISTS "Service role can manage all messages"
  ON public.messages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 3. Allow service_role to manage conversations
-- ============================================

CREATE POLICY IF NOT EXISTS "Service role can manage all conversations"
  ON public.conversations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 4. Allow service_role to manage connected_accounts
-- ============================================

CREATE POLICY IF NOT EXISTS "Service role can manage all connected_accounts"
  ON public.connected_accounts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 5. Create a default workspace if none exists
-- ============================================

INSERT INTO public.workspaces (name)
SELECT 'Default Workspace'
WHERE NOT EXISTS (
  SELECT 1 FROM public.workspaces LIMIT 1
);

-- ============================================
-- 6. Verify workspace was created
-- ============================================

SELECT 
  id, 
  name, 
  created_at,
  'Workspace created successfully!' as status
FROM public.workspaces
LIMIT 1;

-- ============================================
-- Expected Result:
-- You should see one row with your workspace details
-- ============================================
