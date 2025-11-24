-- ============================================
-- Verify Admin Setup
-- Run this to check if everything is configured correctly
-- ============================================

-- Check all users and their roles
SELECT 
  u.id,
  u.email,
  u.created_at,
  ur.role,
  p.full_name,
  CASE 
    WHEN ur.role = 'admin' THEN '✅ Admin'
    WHEN ur.role = 'sdr' THEN '⚠️ SDR'
    ELSE '❌ No Role'
  END as status
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
LEFT JOIN public.profiles p ON u.id = p.id
ORDER BY u.created_at ASC;

-- Check trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Check function exists
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name = 'handle_new_user'
  AND routine_schema = 'public';

