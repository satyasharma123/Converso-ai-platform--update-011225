# Account Owner Implementation

## Summary
Implemented "Account Owner" at database level and enforced that ONLY the account owner can perform destructive actions (delete workspace/account).

## Changes Made

### Phase 1: Database Migration - Add Owner Fields

**File:** `Converso-frontend/supabase/migrations/20251230000003_add_workspace_owner.sql`

- Added `owner_user_id` (uuid, NOT NULL) and `owner_email` (text, nullable) columns to `workspaces` table
- Backfilled existing workspaces:
  1. First tries to find earliest ADMIN member per workspace
  2. Falls back to earliest member if no admin exists
  3. Backfills `owner_email` from `profiles` table if available
- Added foreign key constraint: `workspaces_owner_user_id_fkey` → `auth.users(id)`
- Added index: `idx_workspaces_owner_user_id` for performance

### Phase 2: Backend - Set Owner on Workspace Creation

**Files Modified:**
1. `Converso-backend/src/api/workspace.ts`
   - Updated `createWorkspace()` to accept `ownerUserId` and `ownerEmail` parameters
   - Sets owner fields during workspace creation

2. `Converso-backend/src/services/workspace.ts`
   - Updated service layer to pass owner parameters through

3. `Converso-backend/src/routes/workspace.routes.ts`
   - Updated auto-create workspace logic to set owner when creating default workspace

**Frontend Files Modified:**
1. `Converso-frontend/src/hooks/useAuth.tsx`
   - Updated signup workspace creation to set `owner_user_id` and `owner_email`

2. `Converso-frontend/src/pages/CreateWorkspace.tsx`
   - Updated workspace creation to set owner fields

### Phase 3: Backend - Owner-Only Delete Guardrails

**File:** `Converso-backend/src/routes/workspace.routes.ts`

**DELETE /api/workspace endpoint:**
- **BEFORE:** Checked if user was ADMIN (role-based)
- **AFTER:** Checks if user is OWNER (`workspace.owner_user_id === userId`)
- Returns 403 if user is not the owner
- Error message: "Only the account owner can delete this workspace"

**Logic:**
1. Validates `userId` and `workspaceId` (X-Workspace-Id header)
2. Fetches workspace row to get `owner_user_id`
3. Compares `ws.owner_user_id !== userId`
4. If not owner → 403 error
5. If owner → proceeds with delete

### Phase 4: Prevent Owner Mutations

**File:** `Converso-frontend/supabase/migrations/20251230000004_block_owner_update.sql`

- Created database trigger `trg_prevent_owner_change`
- Function `prevent_owner_change()` raises exception if `owner_user_id` is changed
- Ensures `owner_user_id` is immutable after creation

**Verification:**
- `updateWorkspace()` only updates `name` field (does not touch owner fields) ✅
- No other code paths update `owner_user_id` ✅

### Phase 5: Type Updates

**File:** `Converso-backend/src/api/workspace.ts`

- Updated `Workspace` interface to include:
  - `owner_user_id?: string`
  - `owner_email?: string | null`

## Database Schema Changes

```sql
-- New columns in workspaces table
owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT
owner_email text NULL

-- New index
CREATE INDEX idx_workspaces_owner_user_id ON workspaces(owner_user_id);

-- New trigger
CREATE TRIGGER trg_prevent_owner_change
BEFORE UPDATE ON workspaces
FOR EACH ROW
EXECUTE FUNCTION prevent_owner_change();
```

## Security Model

### Before:
- Any ADMIN could delete workspace
- Role-based access control

### After:
- Only OWNER can delete workspace
- Owner is immutable (cannot be changed)
- Owner is set at workspace creation time
- Owner is backfilled for existing workspaces

## Testing Checklist

### ✅ Database Migration
- [ ] Run migration `20251230000003_add_workspace_owner.sql`
- [ ] Verify all workspaces have `owner_user_id` set (NOT NULL)
- [ ] Verify `owner_email` is populated where available
- [ ] Run migration `20251230000004_block_owner_update.sql`
- [ ] Verify trigger prevents owner updates

### ✅ Workspace Creation
- [ ] New signup creates workspace with owner set
- [ ] Frontend CreateWorkspace page sets owner
- [ ] Backend auto-create sets owner

### ✅ Delete Workspace
- [ ] Owner can delete workspace → ✅ Success
- [ ] Non-owner ADMIN tries to delete → ❌ 403 error
- [ ] SDR tries to delete → ❌ 403 error
- [ ] Error message: "Only the account owner can delete this workspace"

### ✅ Owner Immutability
- [ ] Attempt to update `owner_user_id` via SQL → ❌ Exception raised
- [ ] `updateWorkspace()` only updates name → ✅ No owner change

### ✅ No Regressions
- [ ] Workspace rename (PUT /api/workspace) still works for admins
- [ ] Existing workspace operations unchanged
- [ ] Team member operations unchanged

## SQL Verification Queries

```sql
-- Verify all workspaces have owner
SELECT id, name, owner_user_id, owner_email, created_at
FROM public.workspaces
ORDER BY created_at DESC;

-- Verify owner cannot be updated (should raise exception)
UPDATE workspaces SET owner_user_id = 'some-other-uuid' WHERE id = 'workspace-id';
-- Expected: ERROR: owner_user_id is immutable
```

## Files Changed

### Backend
1. `Converso-backend/src/api/workspace.ts` - Added owner params to createWorkspace
2. `Converso-backend/src/services/workspace.ts` - Pass owner params through
3. `Converso-backend/src/routes/workspace.routes.ts` - Owner check in delete, owner set in auto-create

### Frontend
1. `Converso-frontend/src/hooks/useAuth.tsx` - Set owner on signup workspace creation
2. `Converso-frontend/src/pages/CreateWorkspace.tsx` - Set owner on manual workspace creation

### Migrations
1. `Converso-frontend/supabase/migrations/20251230000003_add_workspace_owner.sql` - Add owner fields + backfill
2. `Converso-frontend/supabase/migrations/20251230000004_block_owner_update.sql` - Prevent owner mutations

## Deployment Steps

1. **Run Database Migrations:**
   ```sql
   -- In Supabase SQL Editor, run:
   -- 1. 20251230000003_add_workspace_owner.sql
   -- 2. 20251230000004_block_owner_update.sql
   ```

2. **Verify Migration:**
   ```sql
   SELECT id, name, owner_user_id, owner_email FROM workspaces;
   -- All rows should have owner_user_id NOT NULL
   ```

3. **Deploy Backend:**
   - Push to main branch
   - Railway will auto-deploy

4. **Deploy Frontend:**
   - Push to main branch
   - Deploy frontend

5. **Test:**
   - Verify owner can delete workspace
   - Verify non-owner cannot delete workspace

## Commit

```
feat: add account owner + enforce owner-only destructive delete
```

## Notes

- **No breaking changes:** Existing functionality remains unchanged
- **Backward compatible:** Existing workspaces are backfilled with owner
- **Immutable owner:** Once set, owner cannot be changed (enforced by trigger)
- **Future-proof:** Ready for account deletion features that require owner verification

