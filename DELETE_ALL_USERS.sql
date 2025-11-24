-- ============================================
-- Delete All Users Script
-- Run this in Supabase Dashboard -> SQL Editor
-- WARNING: This will delete ALL users and their data!
-- ============================================

DO $$
DECLARE
  user_record RECORD;
BEGIN
  RAISE NOTICE 'Starting user deletion...';

  -- Delete all user roles first (foreign key constraint)
  DELETE FROM public.user_roles;
  RAISE NOTICE 'Deleted all user roles';

  -- Delete all profiles
  DELETE FROM public.profiles;
  RAISE NOTICE 'Deleted all profiles';

  -- Delete all conversations assigned to users
  UPDATE public.conversations SET assigned_to = NULL;
  RAISE NOTICE 'Cleared conversation assignments';

  -- Delete all messages from users (keep lead messages)
  DELETE FROM public.messages WHERE sender_id IS NOT NULL;
  RAISE NOTICE 'Deleted user messages';

  -- Delete all connected accounts
  DELETE FROM public.connected_accounts;
  RAISE NOTICE 'Deleted all connected accounts';

  -- Delete all auth users
  -- Note: This must be done via Supabase Admin API or Dashboard
  -- SQL can't directly delete from auth.users due to RLS
  RAISE NOTICE 'Note: Auth users must be deleted manually from Authentication -> Users in Supabase Dashboard';
  RAISE NOTICE 'Or use the Supabase Admin API to delete users';

  RAISE NOTICE '';
  RAISE NOTICE '✅ User data cleaned!';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANT: You must manually delete auth users:';
  RAISE NOTICE '   1. Go to Supabase Dashboard';
  RAISE NOTICE '   2. Navigate to: Authentication -> Users';
  RAISE NOTICE '   3. Delete all users manually';
  RAISE NOTICE '';
  RAISE NOTICE '   Or use the backend script: npm run delete-users';

END $$;

