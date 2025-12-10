-- Migration: First User Becomes Admin, Subsequent Signups Blocked
-- This ensures only the first user can sign up and becomes admin
-- SDRs must be added by admin, not through signup

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create new function that makes first user admin and blocks others
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
  -- We check BEFORE this user is committed, so we need to count all users
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

    -- Assign admin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

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

-- Add comment explaining the behavior
COMMENT ON FUNCTION public.handle_new_user() IS 
'Handles new user creation: First user becomes admin, subsequent signups are blocked. SDRs must be added by admin.';

