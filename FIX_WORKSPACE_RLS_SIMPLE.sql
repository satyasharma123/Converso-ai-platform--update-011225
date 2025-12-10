-- Simple Fix for Workspace RLS Policies
-- Copy and paste this into Supabase SQL Editor and click "Run"

-- ============================================
-- Step 1: Drop existing policies (if any) to avoid conflicts
-- ============================================

DROP POLICY IF EXISTS "Service role can manage all workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Service role can manage all messages" ON public.messages;
DROP POLICY IF EXISTS "Service role can manage all conversations" ON public.conversations;
DROP POLICY IF EXISTS "Service role can manage all connected_accounts" ON public.connected_accounts;

-- ============================================
-- Step 2: Create policies for service_role
-- ============================================

CREATE POLICY "Service role can manage all workspaces"
  ON public.workspaces
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage all messages"
  ON public.messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage all conversations"
  ON public.conversations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage all connected_accounts"
  ON public.connected_accounts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Step 3: Create default workspace
-- ============================================

INSERT INTO public.workspaces (name)
SELECT 'Default Workspace'
WHERE NOT EXISTS (
  SELECT 1 FROM public.workspaces LIMIT 1
);

-- ============================================
-- Step 4: Verify workspace exists
-- ============================================

SELECT 
  id, 
  name, 
  created_at,
  'SUCCESS: Workspace created!' as status
FROM public.workspaces
LIMIT 1;
