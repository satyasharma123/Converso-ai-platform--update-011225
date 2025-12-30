-- 20251230000004_block_owner_update.sql
-- Prevent updates to owner_user_id field (immutable)

BEGIN;

CREATE OR REPLACE FUNCTION public.prevent_owner_change()
RETURNS trigger AS $$
BEGIN
  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
    RAISE EXCEPTION 'owner_user_id is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_owner_change ON public.workspaces;

CREATE TRIGGER trg_prevent_owner_change
BEFORE UPDATE ON public.workspaces
FOR EACH ROW
EXECUTE FUNCTION public.prevent_owner_change();

COMMIT;

