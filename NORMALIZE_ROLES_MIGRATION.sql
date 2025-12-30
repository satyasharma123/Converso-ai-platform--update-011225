-- ============================================
-- Migration: Normalize roles to ADMIN and SDR only
-- ============================================
-- This migration ensures:
-- 1. All 'member' roles are converted to 'SDR'
-- 2. Default role for workspace_members is 'SDR' (not 'member')
-- 3. Only ADMIN and SDR roles exist going forward

-- Step 1: Update all existing 'member' roles to 'SDR'
UPDATE workspace_members
SET role = 'SDR'
WHERE role = 'member' OR role = 'Member' OR role = 'MEMBER';

-- Step 2: Update default value for role column
ALTER TABLE workspace_members
ALTER COLUMN role SET DEFAULT 'SDR';

-- Step 3: Add check constraint to prevent invalid roles (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'workspace_members_role_check'
  ) THEN
    ALTER TABLE workspace_members
    ADD CONSTRAINT workspace_members_role_check
    CHECK (role IN ('ADMIN', 'SDR', 'admin', 'sdr'));
  END IF;
END $$;

-- Step 4: Normalize case to uppercase (optional - can be done in application layer)
-- UPDATE workspace_members SET role = UPPER(role);

-- Step 5: Verify no 'member' roles remain
SELECT 
  role,
  COUNT(*) as count
FROM workspace_members
GROUP BY role
ORDER BY role;

-- Expected result: Only 'ADMIN', 'SDR', 'admin', or 'sdr' should appear

