-- ============================================
-- Migration: Add workspace_id to profiles and auto-assign on signup
-- ============================================
-- This migration ensures:
-- 1. workspace_id column exists on profiles table
-- 2. handle_new_user() function automatically creates/assigns workspace_id when a profile is created
-- 3. Existing profiles without workspace_id get assigned to default workspace

-- Step 1: Add workspace_id column to profiles if it doesn't exist
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- Step 2: Create index if it doesn't exist (may already exist from previous migration)
CREATE INDEX IF NOT EXISTS idx_profiles_workspace_id ON public.profiles(workspace_id);

-- Step 3: Ensure default workspace exists
DO $$
DECLARE
  workspace_count INTEGER;
  default_workspace_id UUID;
BEGIN
  SELECT COUNT(*) INTO workspace_count FROM public.workspaces;
  
  IF workspace_count = 0 THEN
    -- Create default workspace
    INSERT INTO public.workspaces (name, created_at, updated_at)
    VALUES ('My Workspace', NOW(), NOW())
    RETURNING id INTO default_workspace_id;
    
    RAISE NOTICE 'Created default workspace: %', default_workspace_id;
  ELSE
    -- Get first workspace or create one named "My Workspace"
    SELECT id INTO default_workspace_id 
    FROM public.workspaces 
    WHERE name = 'My Workspace'
    LIMIT 1;
    
    -- If "My Workspace" doesn't exist, use the first workspace
    IF default_workspace_id IS NULL THEN
      SELECT id INTO default_workspace_id FROM public.workspaces LIMIT 1;
    END IF;
    
    RAISE NOTICE 'Using existing workspace: %', default_workspace_id;
  END IF;
  
  -- Update all profiles without workspace_id to use default workspace
  UPDATE public.profiles
  SET workspace_id = default_workspace_id
  WHERE workspace_id IS NULL;
  
  RAISE NOTICE 'Updated profiles without workspace_id';
END $$;

-- Step 4: Update handle_new_user() function to automatically assign workspace_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
  is_first_user BOOLEAN;
  default_workspace_id UUID;
BEGIN
  -- Count existing users (excluding the one being created)
  SELECT COUNT(*) INTO user_count
  FROM auth.users
  WHERE id != NEW.id;

  -- First user (count = 0) becomes admin
  is_first_user := (user_count = 0);

  -- Get or create default workspace
  SELECT id INTO default_workspace_id 
  FROM public.workspaces 
  WHERE name = 'My Workspace'
  LIMIT 1;
  
  -- If "My Workspace" doesn't exist, try to get any workspace
  IF default_workspace_id IS NULL THEN
    SELECT id INTO default_workspace_id FROM public.workspaces LIMIT 1;
  END IF;
  
  -- If no workspace exists, create one
  IF default_workspace_id IS NULL THEN
    INSERT INTO public.workspaces (name, created_at, updated_at)
    VALUES ('My Workspace', NOW(), NOW())
    RETURNING id INTO default_workspace_id;
  END IF;

  IF is_first_user THEN
    -- First user: Create profile with workspace_id and assign admin role
    INSERT INTO public.profiles (id, email, full_name, workspace_id, status)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', 'Admin User'),
      default_workspace_id,
      'active'
    )
    ON CONFLICT (id) DO UPDATE
    SET email = NEW.email,
        full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', 'Admin User'),
        workspace_id = COALESCE(public.profiles.workspace_id, default_workspace_id),
        status = 'active';

    -- Assign admin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    RAISE NOTICE 'First user created as admin with workspace_id: %', default_workspace_id;
  ELSE
    -- Subsequent users: Raise exception to prevent user creation
    RAISE EXCEPTION 'Signup is disabled. Only the first user can sign up. Please contact an admin to create your account.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- Step 5: Add comment explaining the behavior
COMMENT ON FUNCTION public.handle_new_user() IS 
'Handles new user creation: First user becomes admin with workspace_id assigned, subsequent signups are blocked. SDRs must be added by admin.';

-- Step 6: Add comment to workspace_id column
COMMENT ON COLUMN public.profiles.workspace_id IS 'Workspace ID that the profile belongs to. Automatically assigned during signup.';








