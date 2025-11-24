-- ============================================
-- Fix: Make First User Admin, Block Subsequent Signups
-- Run this in Supabase Dashboard -> SQL Editor
-- This will fix the trigger to ensure first user is admin
-- ============================================

-- Drop existing trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create/Replace function that makes first user admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
  is_first_user BOOLEAN;
BEGIN
  -- Count existing users (excluding the one being created)
  -- We check all users to see if this is the first
  SELECT COUNT(*) INTO user_count
  FROM auth.users
  WHERE id != NEW.id;

  -- First user (count = 0) becomes admin
  -- Subsequent users are blocked
  is_first_user := (user_count = 0);

  IF is_first_user THEN
    -- First user: Create profile and assign admin role
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', 'Admin User')
    )
    ON CONFLICT (id) DO UPDATE
    SET email = NEW.email,
        full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', 'Admin User');

    -- Assign admin role (remove any existing SDR role first)
    DELETE FROM public.user_roles WHERE user_id = NEW.id;
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO UPDATE SET role = 'admin';

    RAISE NOTICE 'First user created as admin: %', NEW.email;
  ELSE
    -- Subsequent users: Raise exception to prevent user creation
    -- This will cause the transaction to rollback
    RAISE EXCEPTION 'Signup is disabled. Only the first user can sign up. Please contact an admin to create your account.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Fix existing user: Update first user to admin
-- This fixes the current user who signed up as SDR
DO $$
DECLARE
  first_user_id UUID;
  first_user_email TEXT;
BEGIN
  -- Get the first user (oldest created user)
  SELECT id, email INTO first_user_id, first_user_email
  FROM auth.users
  ORDER BY created_at ASC
  LIMIT 1;

  IF first_user_id IS NOT NULL THEN
    -- Delete any existing roles (SDR, etc.)
    DELETE FROM public.user_roles WHERE user_id = first_user_id;
    
    -- Assign admin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (first_user_id, 'admin')
    ON CONFLICT (user_id, role) DO UPDATE SET role = 'admin';

    RAISE NOTICE 'Updated first user (Email: %, ID: %) to admin role', first_user_email, first_user_id;
    RAISE NOTICE 'Removed any existing SDR role and assigned admin role';
  ELSE
    RAISE NOTICE 'No users found';
  END IF;
END $$;
