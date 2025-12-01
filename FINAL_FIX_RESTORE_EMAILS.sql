-- FINAL FIX: Restore emails by ensuring all workspace_id fields are properly set
-- This will restore your emails to working state

DO $$
DECLARE
  default_workspace_id UUID;
  user_record RECORD;
BEGIN
  -- Get or create default workspace
  SELECT id INTO default_workspace_id FROM public.workspaces LIMIT 1;
  
  IF default_workspace_id IS NULL THEN
    INSERT INTO public.workspaces (name, created_at, updated_at)
    VALUES ('Default Workspace', NOW(), NOW())
    RETURNING id INTO default_workspace_id;
    RAISE NOTICE 'Created workspace: %', default_workspace_id;
  ELSE
    RAISE NOTICE 'Using existing workspace: %', default_workspace_id;
  END IF;

  -- Fix profiles
  UPDATE public.profiles
  SET workspace_id = default_workspace_id
  WHERE workspace_id IS NULL OR workspace_id != default_workspace_id;
  
  RAISE NOTICE 'Updated % profiles', (SELECT COUNT(*) FROM public.profiles WHERE workspace_id = default_workspace_id);

  -- Fix connected_accounts - this is the KEY fix
  UPDATE public.connected_accounts
  SET workspace_id = default_workspace_id
  WHERE workspace_id IS NULL OR workspace_id != default_workspace_id;
  
  RAISE NOTICE 'Updated % connected accounts', (SELECT COUNT(*) FROM public.connected_accounts WHERE workspace_id = default_workspace_id);

  -- Fix conversations
  UPDATE public.conversations
  SET workspace_id = default_workspace_id
  WHERE workspace_id IS NULL OR workspace_id != default_workspace_id;
  
  RAISE NOTICE 'Updated % conversations', (SELECT COUNT(*) FROM public.conversations WHERE workspace_id = default_workspace_id);

  -- Verify the fix
  RAISE NOTICE '=== VERIFICATION ===';
  RAISE NOTICE 'Total conversations: %', (SELECT COUNT(*) FROM public.conversations);
  RAISE NOTICE 'Total connected accounts: %', (SELECT COUNT(*) FROM public.connected_accounts);
  RAISE NOTICE 'All should have workspace_id: %', default_workspace_id;
  
END $$;

-- Reload PostgREST schema
SELECT pg_notify('pgrst', 'reload schema');

-- Show summary
SELECT 
  'SUMMARY' as info,
  (SELECT COUNT(*) FROM public.workspaces) as workspaces,
  (SELECT COUNT(*) FROM public.profiles WHERE workspace_id IS NOT NULL) as profiles_with_workspace,
  (SELECT COUNT(*) FROM public.connected_accounts WHERE workspace_id IS NOT NULL) as accounts_with_workspace,
  (SELECT COUNT(*) FROM public.conversations WHERE workspace_id IS NOT NULL) as conversations_with_workspace;

