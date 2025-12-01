-- Fix workspace issue - add workspace_id to profiles and assign default workspace

-- Step 1: Add workspace_id column to profiles if it doesn't exist
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- Step 2: Ensure workspace exists and assign to profiles
DO $$
DECLARE
  workspace_count INTEGER;
  default_workspace_id UUID;
BEGIN
  SELECT COUNT(*) INTO workspace_count FROM public.workspaces;
  
  IF workspace_count = 0 THEN
    -- Create default workspace
    INSERT INTO public.workspaces (name, created_at, updated_at)
    VALUES ('Default Workspace', NOW(), NOW())
    RETURNING id INTO default_workspace_id;
    
    RAISE NOTICE 'Created default workspace: %', default_workspace_id;
  ELSE
    -- Get first workspace
    SELECT id INTO default_workspace_id FROM public.workspaces LIMIT 1;
    RAISE NOTICE 'Using existing workspace: %', default_workspace_id;
  END IF;
  
  -- Update all profiles to have workspace_id
  UPDATE public.profiles
  SET workspace_id = default_workspace_id
  WHERE workspace_id IS NULL;
  
  RAISE NOTICE 'Updated profiles with workspace_id';
END $$;

-- Notify PostgREST
SELECT pg_notify('pgrst', 'reload schema');

