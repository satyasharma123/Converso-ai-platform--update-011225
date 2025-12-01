-- Fix connected_accounts table - add workspace_id and assign to default workspace

-- Step 1: Add workspace_id column to connected_accounts if it doesn't exist
ALTER TABLE public.connected_accounts
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Step 2: Assign all connected accounts to the default workspace
DO $$
DECLARE
  default_workspace_id UUID;
BEGIN
  -- Get first workspace
  SELECT id INTO default_workspace_id FROM public.workspaces LIMIT 1;
  
  IF default_workspace_id IS NULL THEN
    RAISE EXCEPTION 'No workspace found. Please run FIX_WORKSPACE_ISSUE.sql first.';
  END IF;
  
  -- Update all connected accounts to have workspace_id
  UPDATE public.connected_accounts
  SET workspace_id = default_workspace_id
  WHERE workspace_id IS NULL;
  
  RAISE NOTICE 'Updated % connected accounts with workspace_id: %', 
    (SELECT COUNT(*) FROM public.connected_accounts WHERE workspace_id = default_workspace_id),
    default_workspace_id;
END $$;

-- Step 3: Update all conversations to have workspace_id if missing
DO $$
DECLARE
  default_workspace_id UUID;
BEGIN
  SELECT id INTO default_workspace_id FROM public.workspaces LIMIT 1;
  
  UPDATE public.conversations
  SET workspace_id = default_workspace_id
  WHERE workspace_id IS NULL;
  
  RAISE NOTICE 'Updated % conversations with workspace_id', 
    (SELECT COUNT(*) FROM public.conversations WHERE workspace_id = default_workspace_id);
END $$;

-- Notify PostgREST
SELECT pg_notify('pgrst', 'reload schema');

