-- ============================================
-- Migration: Fix workspace auto-creation for new users
-- ============================================
-- This migration ensures:
-- 1. Unique constraint on workspace_members (workspace_id, user_id)
-- 2. handle_new_user() automatically creates workspace and workspace_members row
-- 3. Every new user gets their own workspace as admin

-- Step 1: Ensure workspace_members table exists with correct structure
-- (If it doesn't exist, create it)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workspace_members') THEN
    CREATE TABLE public.workspace_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );

    -- Enable RLS
    ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON public.workspace_members(user_id);
  END IF;
END $$;

-- Step 2a: Add status column if it doesn't exist (for existing tables)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'workspace_members' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE public.workspace_members
    ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
  END IF;
END $$;

-- Step 2b: Add unique constraint to prevent duplicate workspace_members rows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_workspace_member'
  ) THEN
    ALTER TABLE public.workspace_members
    ADD CONSTRAINT unique_workspace_member
    UNIQUE (workspace_id, user_id);
  END IF;
END $$;

-- Step 3: Update handle_new_user() function to automatically create workspace and workspace_members
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_workspace_id UUID;
  user_email_prefix TEXT;
BEGIN
  -- Extract email prefix for workspace name (e.g., "john" from "john@example.com")
  user_email_prefix := split_part(NEW.email, '@', 1);

  -- 1. Create profile
  INSERT INTO public.profiles (id, email, full_name, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', user_email_prefix),
    'active'
  )
  ON CONFLICT (id) DO UPDATE
  SET email = NEW.email,
      full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
      status = 'active';

  -- 2. Create default workspace for user
  INSERT INTO public.workspaces (name, created_at, updated_at)
  VALUES (
    user_email_prefix || '''s Workspace',
    NOW(),
    NOW()
  )
  RETURNING id INTO new_workspace_id;

  -- 3. Update profile with workspace_id
  UPDATE public.profiles
  SET workspace_id = new_workspace_id
  WHERE id = NEW.id;

  -- 4. Add user as admin to workspace_members
  -- Check if status column exists, if so include it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'workspace_members' 
    AND column_name = 'status'
  ) THEN
    INSERT INTO public.workspace_members (workspace_id, user_id, role, status)
    VALUES (new_workspace_id, NEW.id, 'admin', 'active')
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
  ELSE
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (new_workspace_id, NEW.id, 'admin')
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
  END IF;

  -- 5. Assign admin role in user_roles table
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Step 4: Add comment explaining the behavior
COMMENT ON FUNCTION public.handle_new_user() IS 
'Handles new user creation: Creates profile, workspace, workspace_members row, and assigns admin role. Each user gets their own workspace.';

