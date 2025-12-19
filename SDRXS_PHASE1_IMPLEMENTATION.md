# SDRXS PHASE 1: SDR Visibility Implementation

## Overview
This document describes the implementation of PHASE 1 of the SDR Experience System (SDRXS), which enforces proper visibility controls for conversations (leads) using Row Level Security (RLS).

## Migration File
**File:** `Converso-frontend/supabase/migrations/20251219000001_sdrxs_phase1_conversations_rls.sql`

## Changes Made

### 1. New Helper Function
**Function:** `public.get_user_workspace_id(UUID)`
- **Purpose:** Returns the workspace_id for a given user
- **Type:** STABLE, SECURITY DEFINER
- **Usage:** Used in RLS policies to enforce workspace isolation

```sql
CREATE OR REPLACE FUNCTION public.get_user_workspace_id(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id
  FROM public.profiles
  WHERE id = _user_id
  LIMIT 1
$$;
```

### 2. RLS Policies Created/Modified

#### Policy 1: "Admins can view workspace conversations"
- **Operation:** SELECT
- **Applies to:** Users with 'admin' role
- **Rule:** Can view ALL conversations within their workspace
- **Logic:**
  ```sql
  public.has_role(auth.uid(), 'admin')
  AND workspace_id = public.get_user_workspace_id(auth.uid())
  ```

#### Policy 2: "SDRs can view assigned conversations only"
- **Operation:** SELECT
- **Applies to:** Users with 'sdr' role
- **Rule:** Can view ONLY conversations where `assigned_to = auth.uid()`
- **Logic:**
  ```sql
  public.has_role(auth.uid(), 'sdr')
  AND assigned_to = auth.uid()
  AND workspace_id = public.get_user_workspace_id(auth.uid())
  ```

### 3. Policies Removed
- ❌ "Admins can view all conversations" (replaced with workspace-scoped version)
- ❌ "SDRs can view assigned conversations" (replaced with workspace-scoped version)

## Behavior Examples

### Example 1: Admin SELECT Query
**User:** Admin (has 'admin' role)
**Workspace:** workspace_123

```sql
SELECT id, sender_name, assigned_to, workspace_id 
FROM conversations;
```

**Result:** Returns ALL conversations where `workspace_id = workspace_123`
- ✅ Assigned conversations
- ✅ Unassigned conversations
- ✅ Conversations assigned to other SDRs

### Example 2: SDR SELECT Query (Assigned)
**User:** SDR (has 'sdr' role, user_id = sdr_456)
**Workspace:** workspace_123
**Assigned conversations:** 5 conversations with `assigned_to = sdr_456`

```sql
SELECT id, sender_name, assigned_to, workspace_id 
FROM conversations;
```

**Result:** Returns ONLY 5 conversations where:
- `assigned_to = sdr_456`
- `workspace_id = workspace_123`

### Example 3: SDR SELECT Query (Unassigned - DENIED)
**User:** SDR (has 'sdr' role, user_id = sdr_456)
**Workspace:** workspace_123

```sql
SELECT id, sender_name, assigned_to, workspace_id 
FROM conversations
WHERE assigned_to IS NULL;
```

**Result:** Returns 0 rows
- ❌ SDRs CANNOT see unassigned conversations
- ❌ RLS policy blocks access to conversations where `assigned_to != auth.uid()`

### Example 4: SDR Trying to View Another SDR's Conversation
**User:** SDR_A (user_id = sdr_456)
**Target:** Conversation assigned to SDR_B (assigned_to = sdr_789)

```sql
SELECT id, sender_name, assigned_to 
FROM conversations
WHERE id = 'conversation_xyz';
```

**Result:** Returns 0 rows
- ❌ SDRs CANNOT see conversations assigned to other users
- ❌ RLS policy enforces `assigned_to = auth.uid()` check

## What Was NOT Changed

### ✅ Preserved Functionality
- ✅ Message sync logic (untouched)
- ✅ Inbox queries (untouched)
- ✅ LinkedIn sync (untouched)
- ✅ Email sync (untouched)
- ✅ UPDATE/INSERT/DELETE policies (not modified in Phase 1)
- ✅ Existing workspace isolation logic (enhanced, not replaced)

### ⏳ Future Phases
- Phase 2: SDR write operations (UPDATE assigned conversations)
- Phase 3: Admin assignment controls
- Phase 4: Audit logging

## Testing Instructions

### Test 1: Admin Visibility
1. Log in as an admin user
2. Run: `SELECT COUNT(*) FROM conversations;`
3. **Expected:** Should return total count of all conversations in workspace

### Test 2: SDR Assigned Visibility
1. Log in as an SDR user
2. Assign 3 conversations to this SDR
3. Run: `SELECT COUNT(*) FROM conversations;`
4. **Expected:** Should return exactly 3

### Test 3: SDR Unassigned Invisibility
1. Log in as an SDR user
2. Run: `SELECT COUNT(*) FROM conversations WHERE assigned_to IS NULL;`
3. **Expected:** Should return 0 (even if unassigned conversations exist)

### Test 4: SDR Cross-User Invisibility
1. Create two SDR users: SDR_A and SDR_B
2. Assign conversation_1 to SDR_A
3. Assign conversation_2 to SDR_B
4. Log in as SDR_A
5. Run: `SELECT COUNT(*) FROM conversations;`
6. **Expected:** Should return 1 (only conversation_1)

## Rollback Instructions

If you need to rollback this migration:

```sql
-- Drop new policies
DROP POLICY IF EXISTS "Admins can view workspace conversations" ON public.conversations;
DROP POLICY IF EXISTS "SDRs can view assigned conversations only" ON public.conversations;

-- Restore original policies
CREATE POLICY "Admins can view all conversations"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "SDRs can view assigned conversations"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (assigned_to = auth.uid());

-- Optionally drop helper function
DROP FUNCTION IF EXISTS public.get_user_workspace_id(UUID);
```

## Security Considerations

### ✅ Security Improvements
1. **Workspace Isolation:** Users can only see conversations in their workspace
2. **Strict SDR Visibility:** SDRs can ONLY see explicitly assigned conversations
3. **No Privilege Escalation:** SDRs cannot bypass assignment checks
4. **Defense in Depth:** RLS enforced at database level (not just application)

### 🔒 Production Safety
- ✅ Works with existing JWT authentication
- ✅ Compatible with production auth middleware (Phase 0)
- ✅ No changes to existing sync jobs or background processes
- ✅ Service role can still manage all data (for sync jobs)

## Notes
- This migration uses `SECURITY DEFINER` for the helper function to ensure consistent workspace lookups
- The `STABLE` function attribute allows query optimization while ensuring correct results
- Workspace isolation is enforced in addition to role-based access control
- Future phases will add write operation controls (UPDATE, INSERT, DELETE)
