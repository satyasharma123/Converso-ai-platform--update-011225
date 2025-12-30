-- ============================================================
-- AUDIT QUERIES FOR WORKSPACE NAME AND DROPDOWN ISSUES
-- ============================================================
-- Run these in Supabase SQL Editor (as postgres role)
-- Replace :uid with the actual user UUID (Admin who sees duplicates)

-- ============================================================
-- PHASE 4.1: Check for duplicate workspace_members rows
-- ============================================================
-- If this returns rows → DB has duplicate memberships
-- If empty → duplicates are created in frontend mapping/render
SELECT 
  wm.user_id, 
  wm.workspace_id, 
  count(*) as memberships
FROM workspace_members wm
WHERE wm.user_id = 'PASTE_ADMIN_UUID_HERE'
GROUP BY wm.user_id, wm.workspace_id
HAVING count(*) > 1;

-- ============================================================
-- PHASE 4.2: Get all workspaces for a user
-- ============================================================
SELECT 
  w.id,
  w.name,
  w.created_at,
  wm.user_id,
  wm.role,
  wm.created_at as membership_created_at
FROM workspaces w
INNER JOIN workspace_members wm ON w.id = wm.workspace_id
WHERE wm.user_id = 'PASTE_ADMIN_UUID_HERE'
ORDER BY wm.created_at ASC;

-- ============================================================
-- PHASE 4.3: Check for workspaces with same name
-- ============================================================
-- If this returns rows → Multiple workspaces have same name (DB data issue)
SELECT 
  name,
  count(*) as count,
  array_agg(id) as workspace_ids
FROM workspaces
GROUP BY name
HAVING count(*) > 1;

-- ============================================================
-- PHASE 4.4: Verify workspace_members unique constraint
-- ============================================================
SELECT 
  conname,
  pg_get_constraintdef(c.oid) as constraint_definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'workspace_members'
  AND contype = 'u'; -- 'u' = unique constraint

