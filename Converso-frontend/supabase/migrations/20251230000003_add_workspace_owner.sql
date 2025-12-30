-- 20251230000003_add_workspace_owner.sql
-- Add owner fields to workspaces table and backfill existing data

BEGIN;

-- A) Add owner fields (nullable first for safe backfill)
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS owner_user_id uuid NULL,
  ADD COLUMN IF NOT EXISTS owner_email text NULL;

-- B) Backfill owner_user_id using earliest ADMIN membership per workspace
-- We prefer workspace_members.role = 'admin' OR 'ADMIN'
WITH first_admin AS (
  SELECT
    wm.workspace_id,
    wm.user_id,
    ROW_NUMBER() OVER (
      PARTITION BY wm.workspace_id
      ORDER BY wm.created_at ASC NULLS LAST
    ) AS rn
  FROM public.workspace_members wm
  WHERE LOWER(wm.role) = 'admin'
)
UPDATE public.workspaces w
SET owner_user_id = fa.user_id
FROM first_admin fa
WHERE w.id = fa.workspace_id
  AND fa.rn = 1
  AND w.owner_user_id IS NULL;

-- C) If some workspaces have no admin (edge case), fallback to earliest membership
WITH first_member AS (
  SELECT
    wm.workspace_id,
    wm.user_id,
    ROW_NUMBER() OVER (
      PARTITION BY wm.workspace_id
      ORDER BY wm.created_at ASC NULLS LAST
    ) AS rn
  FROM public.workspace_members wm
)
UPDATE public.workspaces w
SET owner_user_id = fm.user_id
FROM first_member fm
WHERE w.id = fm.workspace_id
  AND fm.rn = 1
  AND w.owner_user_id IS NULL;

-- D) Backfill owner_email from profiles table if you store email there
-- If profiles.email does not exist, SKIP this block.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='email'
  ) THEN
    UPDATE public.workspaces w
    SET owner_email = p.email
    FROM public.profiles p
    WHERE p.id = w.owner_user_id
      AND w.owner_email IS NULL;
  END IF;
END $$;

-- E) Make owner_user_id required (after backfill)
ALTER TABLE public.workspaces
  ALTER COLUMN owner_user_id SET NOT NULL;

-- F) Add FK (safe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workspaces_owner_user_id_fkey'
  ) THEN
    ALTER TABLE public.workspaces
      ADD CONSTRAINT workspaces_owner_user_id_fkey
      FOREIGN KEY (owner_user_id)
      REFERENCES auth.users(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- G) Optional: index to speed owner checks
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_user_id
  ON public.workspaces(owner_user_id);

COMMIT;

