# Workspace Members RLS Policy Fix

## Issue
SDR users cannot see all workspaces they belong to in the workspace switcher because they don't have permission to read from `workspace_members` table.

## Root Cause
Missing RLS (Row Level Security) SELECT policy on `workspace_members` table for authenticated users.

## Solution

### SQL to Run in Supabase SQL Editor

**File:** `ADD_WORKSPACE_MEMBERS_READ_POLICY.sql`

Run this SQL in Supabase → SQL Editor:

```sql
-- Check existing policies first
SELECT policyname, cmd, roles, qual
FROM pg_policies
WHERE tablename = 'workspace_members';

-- Drop policy if it exists (idempotent)
DROP POLICY IF EXISTS "Users can read their workspace memberships" ON public.workspace_members;

-- Create the SELECT policy
CREATE POLICY "Users can read their workspace memberships"
ON public.workspace_members
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
);

-- Verify policy was created
SELECT policyname, cmd, roles, qual
FROM pg_policies
WHERE tablename = 'workspace_members';
```

### Expected Result
After running the SQL, you should see:
- Policy name: "Users can read their workspace memberships"
- Command: SELECT
- Roles: authenticated
- Qual: `user_id = auth.uid()`

## Why This Works

- `auth.uid()` = logged-in Supabase user ID
- Allows users to read ONLY their own `workspace_members` rows
- Secure: Users cannot see other users' workspace memberships
- Industry-standard Supabase SaaS pattern
- Supports multi-workspace users (SDR can belong to multiple workspaces)

## Verification Steps

1. **Run SQL in Supabase SQL Editor**
   - Copy SQL from `ADD_WORKSPACE_MEMBERS_READ_POLICY.sql`
   - Run in Supabase → SQL Editor
   - Verify policy appears in results

2. **Hard Refresh Frontend**
   - Logout SDR user
   - Clear localStorage (optional)
   - Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
   - Login again as SDR

3. **Check Workspace Switcher**
   - Click workspace dropdown (top-right navbar)
   - Should see ALL assigned workspaces:
     - Hector AI
     - Converso
     - Any other workspaces
   - Switching should work instantly

4. **Check Browser Console**
   - Open DevTools → Console
   - Look for: `workspace_members raw: [...]`
   - Should show array with multiple workspace objects

## Files Created

1. **Migration File:** `Converso-frontend/supabase/migrations/20251230000002_add_workspace_members_read_policy.sql`
   - For future deployments
   - Idempotent (safe to run multiple times)

2. **Quick Fix SQL:** `ADD_WORKSPACE_MEMBERS_READ_POLICY.sql`
   - For immediate fix in Supabase SQL Editor
   - Includes verification queries

3. **Debug Log Added:** `Converso-frontend/src/context/WorkspaceContext.tsx`
   - Console.log for troubleshooting
   - Shows raw workspace_members data

## Status: ✅ READY TO APPLY

**Next Steps:**
1. Run SQL in Supabase SQL Editor
2. Hard refresh frontend
3. Verify workspace switcher shows all workspaces

**No backend or frontend code changes needed** - this is a database-only fix.

