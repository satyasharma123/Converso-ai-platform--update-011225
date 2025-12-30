-- ============================================
-- Backfill Script: Fix existing users without workspace_members
-- ============================================
-- Run this ONCE in Supabase SQL Editor to fix existing users
-- This will:
-- 1. Detect users without workspace_members rows
-- 2. Create workspace_members entries for users who have workspaces
-- 3. Create workspaces and workspace_members for users who don't have either

-- Part 1: Add workspace_members for users who have workspace_id on profile but no membership
-- (Skip this if workspace_id doesn't exist on profiles - Part 2 handles it)

-- Part 2: For users with workspace_id on profile but no workspace_members row
-- Use a subquery approach that avoids conflicts by checking existence first
INSERT INTO workspace_members (workspace_id, user_id, role)
SELECT
  p.workspace_id,
  p.id,
  'admin'
FROM profiles p
WHERE p.workspace_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM workspace_members wm
  WHERE wm.user_id = p.id
  AND wm.workspace_id = p.workspace_id
);

-- Part 3: For users without workspace_id on profile, create workspace and membership
DO $$
DECLARE
  user_record RECORD;
  new_workspace_id UUID;
  user_email_prefix TEXT;
BEGIN
  FOR user_record IN 
    SELECT p.id, p.email, p.full_name
    FROM profiles p
    WHERE p.workspace_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM workspace_members wm WHERE wm.user_id = p.id
    )
  LOOP
    -- Extract email prefix
    user_email_prefix := split_part(user_record.email, '@', 1);

    -- Create workspace
    INSERT INTO workspaces (name, created_at, updated_at)
    VALUES (
      user_email_prefix || '''s Workspace',
      NOW(),
      NOW()
    )
    RETURNING id INTO new_workspace_id;

    -- Update profile with workspace_id
    UPDATE profiles
    SET workspace_id = new_workspace_id
    WHERE id = user_record.id;

    -- Create workspace_members row (check for existence first to avoid conflicts)
    INSERT INTO workspace_members (workspace_id, user_id, role)
    SELECT new_workspace_id, user_record.id, 'admin'
    WHERE NOT EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = new_workspace_id
      AND wm.user_id = user_record.id
    );
  END LOOP;
END $$;

