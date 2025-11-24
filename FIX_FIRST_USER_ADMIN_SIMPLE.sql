-- ============================================
-- Fix: Make First User Admin, Block Subsequent Signups
-- Run this ENTIRE script in Supabase Dashboard -> SQL Editor
-- ============================================

-- Step 1: Drop existing trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Step 2: Create function that makes first user admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
BEGIN
  -- Count existing users (excluding the one being created)
  SELECT COUNT(*) INTO user_count
  FROM auth.users
  WHERE id != NEW.id;

  -- First user (count = 0) becomes admin
  IF user_count = 0 THEN
    -- Create profile
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', 'Admin User')
    )
    ON CONFLICT (id) DO UPDATE
    SET email = NEW.email,
        full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', 'Admin User');

    -- Delete any existing roles and assign admin
    DELETE FROM public.user_roles WHERE user_id = NEW.id;
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  ELSE
    -- Subsequent users: Block signup
    RAISE EXCEPTION 'Signup is disabled. Only the first user can sign up. Please contact an admin to create your account.';
  END IF;

  RETURN NEW;
END;
$$;

-- Step 3: Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 4: Fix existing first user to admin
DO $$
DECLARE
  first_user_id UUID;
  first_user_email TEXT;
BEGIN
  SELECT id, email INTO first_user_id, first_user_email
  FROM auth.users
  ORDER BY created_at ASC
  LIMIT 1;

  IF first_user_id IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = first_user_id;
    INSERT INTO public.user_roles (user_id, role)
    VALUES (first_user_id, 'admin')
    ON CONFLICT (user_id, role) DO UPDATE SET role = 'admin';
  END IF;
END $$;

