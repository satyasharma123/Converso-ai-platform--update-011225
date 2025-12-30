-- ============================================
-- Check existing workspace_members_role_check constraint
-- ============================================
-- Run this FIRST to see what the current constraint allows

SELECT 
  conname as constraint_name,
  pg_get_constraintdef(c.oid) as constraint_definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'workspace_members'
  AND conname = 'workspace_members_role_check';

-- Also check all constraints on workspace_members table
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(c.oid) as constraint_definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'workspace_members'
ORDER BY conname;

