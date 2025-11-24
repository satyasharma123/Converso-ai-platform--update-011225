-- ============================================
-- Verify Admin Role for Current User
-- Run this to check and fix your admin role
-- ============================================

-- Check current user roles
SELECT 
  u.id,
  u.email,
  u.created_at,
  ur.role,
  p.full_name
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
LEFT JOIN public.profiles p ON u.id = p.id
ORDER BY u.created_at ASC;

-- If satya@leadnex.co is not admin, run this to fix:
-- UPDATE public.user_roles 
-- SET role = 'admin' 
-- WHERE user_id = (SELECT id FROM auth.users WHERE email = 'satya@leadnex.co' LIMIT 1);

-- Or delete and recreate the role:
-- DELETE FROM public.user_roles WHERE user_id = (SELECT id FROM auth.users WHERE email = 'satya@leadnex.co' LIMIT 1);
-- INSERT INTO public.user_roles (user_id, role) 
-- VALUES ((SELECT id FROM auth.users WHERE email = 'satya@leadnex.co' LIMIT 1), 'admin');

