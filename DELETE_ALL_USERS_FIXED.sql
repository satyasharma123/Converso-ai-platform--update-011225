-- ============================================
-- Delete All Users Script (Fixed - Handles Foreign Keys)
-- Run this in Supabase Dashboard -> SQL Editor
-- This deletes users in the correct order to avoid foreign key errors
-- ============================================

DO $$
DECLARE
  user_record RECORD;
  deleted_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting user deletion process...';
  RAISE NOTICE '';

  -- Step 1: Delete user messages (messages sent by users, not leads)
  RAISE NOTICE 'Step 1: Deleting user messages...';
  DELETE FROM public.messages WHERE sender_id IS NOT NULL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '   ✓ Deleted % user messages', deleted_count;

  -- Step 2: Clear conversation assignments and account references
  RAISE NOTICE 'Step 2: Clearing conversation assignments and account references...';
  UPDATE public.conversations SET assigned_to = NULL WHERE assigned_to IS NOT NULL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '   ✓ Cleared % conversation assignments', deleted_count;
  
  -- Clear received_on_account_id references (required before deleting connected_accounts)
  UPDATE public.conversations SET received_on_account_id = NULL WHERE received_on_account_id IS NOT NULL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '   ✓ Cleared % account references from conversations', deleted_count;

  -- Step 3: Delete connected accounts (now safe - no foreign key references)
  RAISE NOTICE 'Step 3: Deleting connected accounts...';
  DELETE FROM public.connected_accounts;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '   ✓ Deleted % connected accounts', deleted_count;

  -- Step 4: Delete user roles
  RAISE NOTICE 'Step 4: Deleting user roles...';
  DELETE FROM public.user_roles;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '   ✓ Deleted % user roles', deleted_count;

  -- Step 5: Delete profiles
  RAISE NOTICE 'Step 5: Deleting profiles...';
  DELETE FROM public.profiles;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE '   ✓ Deleted % profiles', deleted_count;

  RAISE NOTICE '';
  RAISE NOTICE '✅ All user-related data deleted!';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANT: Now delete auth users manually:';
  RAISE NOTICE '   1. Go to Supabase Dashboard';
  RAISE NOTICE '   2. Navigate to: Authentication -> Users';
  RAISE NOTICE '   3. Select all users and delete';
  RAISE NOTICE '';
  RAISE NOTICE '   OR use the backend script: cd Converso-backend && npm run delete-users';

END $$;

