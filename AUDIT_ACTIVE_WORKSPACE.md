# Active Workspace Lifecycle Audit

## Executive Summary

This audit traces the complete lifecycle of active workspace management from signup through deletion and re-login. The goal is to identify where `activeWorkspace` can become NULL/STALE and cause "No active workspace found" errors or missing workspace dropdowns.

**Key Finding**: After workspace deletion, user logs out but on next login/signup, the system may fail to properly initialize a new workspace or set it as active, leading to broken UI states.

---

## PHASE 0 — DATA MODEL + STORAGE KEYS

### Storage Format

**localStorage Key:**
- Format: `synq_active_workspace_id:${userId}`
- Example: `synq_active_workspace_id:1c4b5a93-9a3e-4ef9-87cf-2b4b519e4e6f`
- Location: Browser localStorage (client-side only)

**Source of Truth:**
- Database: `workspace_members` table (NOT `profiles.workspace_id`)
- Query: `.from('workspace_members').select('workspace_id, role, workspaces:workspaces(id, name)').eq('user_id', userId)`

### Where Active Workspace is Loaded

**File:** `Converso-frontend/src/context/WorkspaceContext.tsx`

**Function:** `useEffect` hook (lines 115-130)

**Flow:**
1. On `user?.id` change (login/logout)
2. Clears localStorage: `localStorage.removeItem(storageKey)` (line 126)
3. Calls `fetchWorkspaces(user.id)` (line 129)
4. `fetchWorkspaces` reads from `workspace_members` table (line 31)
5. Validates stored workspaceId against fetched list (lines 89-91)
6. Falls back to first workspace if stored ID invalid (lines 96-99)
7. Sets `activeWorkspace` state (line 106)

**What Happens if Missing:**
- If `workspace_members` query returns empty array:
  - `uniqueWorkspaces.length === 0` (line 71)
  - Warning logged: "user has no workspaces — onboarding issue" (line 73)
  - `selectedWorkspace` remains `null` (line 93)
  - `activeWorkspace` state stays `null` (line 106 not executed)
  - **RESULT**: Workspace switcher hidden (Navbar.tsx line 32: `workspaces?.length > 0`)

---

## PHASE 1 — FRONTEND LIFECYCLE TRACE

### A) Signup Flow

**File:** `Converso-frontend/src/hooks/useAuth.tsx`

**Function:** `signUp` (lines 109-266)

**Current Behavior:**

1. **Signup Success** (line 136):
   - `data?.user` exists
   - Log: `[AUTH] signup success` (line 139)

2. **Check Existing Memberships** (lines 139-150):
   - Query: `workspace_members` table for `user_id`
   - Log: `[AUTH] memberships after signup` (line 144)
   - **GUARD**: If memberships exist → skip workspace creation (line 148)

3. **Create Workspace** (lines 155-161):
   - Creates workspace in `workspaces` table
   - Log: `[AUTH] workspace created?` (line 163)

4. **Create Membership** (lines 168-174):
   - Inserts into `workspace_members` table
   - **CRITICAL**: Does NOT set `activeWorkspace` in context
   - Log: `[AUTH] workspace and membership created, but activeWorkspace not set in context yet` (line 179)

5. **Update Profile** (lines 181-184):
   - Updates `profiles.workspace_id` (legacy field, not used for workspace listing)

**Gap Identified:**
- Workspace created but `activeWorkspace` NOT set immediately
- Relies on `WorkspaceContext` to pick it up on next render
- If `WorkspaceContext` hasn't mounted yet or user.id hasn't changed, workspace may not be selected

### B) App Boot / Context Hydration

**File:** `Converso-frontend/src/context/WorkspaceContext.tsx`

**Function:** `useEffect` (lines 115-130) + `fetchWorkspaces` (lines 26-113)

**Current Behavior:**

1. **Boot Start** (line 117):
   - Log: `[WS] boot start` with `userId`
   - If no `user?.id` → clear state and return (lines 116-120)

2. **Clear Cache** (lines 123-126):
   - Reads stored workspaceId: `localStorage.getItem(storageKey)` (line 125)
   - Log: `[WS] stored active workspace id (before clear)` (line 127)
   - **ALWAYS** removes from localStorage (line 126)
   - **RATIONALE**: Forces fresh DB read on every login

3. **Fetch Workspaces** (line 129):
   - Query `workspace_members` table (line 31)
   - Log: `[WS-CTX] raw workspace_members rows` (line 42)
   - Map to `WorkspaceSummary[]` (lines 44-54)
   - Deduplicate (lines 59-66)
   - Log: `[WS] memberships loaded` (line 72)

4. **Select Active Workspace** (lines 77-107):
   - Read from localStorage: `localStorage.getItem(storageKey)` (line 79)
   - Log: `[WS-CTX] selecting active workspace` (line 82)
   - Validate against fetched list (lines 89-91)
   - Fallback to first workspace if invalid (lines 96-99)
   - Log: `[WS] resolved active workspace` (line 95)
   - Set state: `setActiveWorkspace(selectedWorkspace)` (line 106)

**Gap Identified:**
- If `workspace_members` returns empty array:
  - `uniqueWorkspaces.length === 0` (line 71)
  - `selectedWorkspace` stays `null` (line 93)
  - `activeWorkspace` remains `null` (line 106 not executed)
  - **NO FALLBACK** to create workspace or route to onboarding

### C) Workspace Switcher UI

**File:** `Converso-frontend/src/components/Layout/Navbar.tsx`

**Function:** `Navbar` component (lines 17-76)

**Current Behavior:**

1. **Render Check** (line 32):
   - Condition: `{!loading && workspaces?.length > 0 && (`
   - **HIDDEN** if:
     - `loading === true`
     - `workspaces.length === 0`
   - Log: `[WS-SWITCHER] render` (line 28)

2. **Display Active Workspace** (line 41):
   - Shows: `activeWorkspace?.name || "Select workspace"`
   - If `activeWorkspace` is null → shows "Select workspace" but dropdown still hidden

**Gap Identified:**
- No UI indication when user has no workspaces
- No route to create workspace
- User stuck in broken state

---

## PHASE 2 — DELETE WORKSPACE FLOW

### Frontend Delete Handler

**File:** `Converso-frontend/src/pages/Settings.tsx`

**Function:** `handleDeleteWorkspace` (lines 221-261)

**Current Behavior:**

1. **Validation** (lines 222-235):
   - Checks `deleteConfirmText === "DELETE"`
   - Checks `activeWorkspace?.id` exists
   - Checks `userRole === "admin"`

2. **API Call** (line 239):
   - Calls: `apiClient.delete('/api/workspace')`
   - Sends `X-Workspace-Id` header (from api-client.ts line 70)
   - Log: `[WS-DELETE] start` (line 237)

3. **Clear localStorage** (lines 242-245):
   - Removes: `synq_active_workspace_id:${user.id}`
   - Log: `[WS-DELETE] localStorage key removed` (line 247)

4. **Sign Out** (line 254):
   - Calls: `signOut()`
   - Navigates: `navigate('/login')`
   - Log: `[WS-DELETE] signing out` (line 252)

**What Happens on Next Login:**

- User logs in with same email
- `WorkspaceContext` mounts
- `useEffect` clears localStorage (already cleared, but safe)
- `fetchWorkspaces(user.id)` queries `workspace_members`
- **IF workspace_members is empty** (workspace deleted):
  - Returns empty array
  - `uniqueWorkspaces.length === 0`
  - `activeWorkspace` stays `null`
  - Workspace switcher hidden
  - **USER STUCK**: No way to create new workspace

### Backend Delete Handler

**File:** `Converso-backend/src/api/workspace.ts`

**Function:** `deleteWorkspace` (lines 68-90)

**Current Behavior:**

1. **Delete workspace_members** (lines 72-75):
   - Deletes ALL rows where `workspace_id = workspaceId`
   - **RESULT**: User has no `workspace_members` rows

2. **Delete workspace** (lines 82-85):
   - Deletes workspace from `workspaces` table

**Database State After Delete:**
- `workspace_members` table: No rows for user
- `workspaces` table: Workspace deleted
- `profiles.workspace_id`: May still contain deleted workspace_id (legacy field, not cleaned)

---

## PHASE 3 — STALE STATE POSSIBILITIES

### A) profiles.workspace_id Usage

**Found:** `Converso-frontend/src/pages/LinkedInInbox.tsx` line 334

```typescript
const workspaceId = (userProfile as any)?.workspace_id || (user as any)?.workspace_id;
```

**Impact:** 
- This is a fallback for LinkedIn inbox, not used for active workspace selection
- **SAFE**: Not used in WorkspaceContext or active workspace logic

**Verdict:** Not a source of stale state for active workspace.

### B) Backend Endpoint `/api/workspace` Behavior

**File:** `Converso-backend/src/routes/workspace.routes.ts`

**Route:** `GET /api/workspace` (lines 13-87)

**Current Behavior:**

1. **If X-Workspace-Id header provided** (lines 22-45):
   - Verifies membership via `resolveActiveWorkspace()`
   - Returns workspace if valid
   - Returns 403 if invalid

2. **If no header, user authenticated** (lines 52-74):
   - Checks `workspace_members` for user
   - If memberships exist → returns first workspace
   - If no memberships → continues to fallback

3. **Fallback** (lines 77-85):
   - Calls `workspaceService.getWorkspace()` → uses `.limit(1).single()` (legacy)
   - **IF no workspace AND userId exists** → auto-creates workspace (line 82)
   - **PROBLEM**: Auto-creates workspace but does NOT create `workspace_members` row
   - **RESULT**: Workspace exists but user has no membership → frontend can't see it

**Gap Identified:**
- Backend auto-creates workspace without membership
- Frontend queries `workspace_members` → empty → no workspace shown
- **MISMATCH**: Backend has workspace, frontend can't see it

### C) "No active workspace found" Error Source

**Found:** `Converso-frontend/src/pages/Settings.tsx` line 228

**Context:** `handleDeleteWorkspace` function

**Trigger:** When `activeWorkspace?.id` is null/undefined

**Other Sources:**
- Backend: `Converso-backend/src/services/teamMembers.ts` line 58
- Backend: `Converso-backend/src/routes/teamMembers.routes.ts` lines 91, 118, 167

**Frontend Error:** Only in Settings delete handler (not blocking)

**Backend Errors:** Thrown when creating/deleting team members without workspace context

---

## PHASE 4 — REPRODUCTION PATHS

### Scenario 1: New Signup, No Memberships

**Steps:**
1. User signs up → `signUp()` called
2. `data?.user` exists → workspace creation block executes
3. Check `workspace_members` → empty (new user)
4. Create workspace → success
5. Create `workspace_members` row → success
6. Update `profiles.workspace_id` → success
7. **GAP**: `activeWorkspace` NOT set in context
8. User redirected (if session exists) or stays on signup page
9. `WorkspaceContext` mounts → `useEffect` runs
10. `fetchWorkspaces()` queries `workspace_members` → finds 1 workspace
11. `selectedWorkspace` = first workspace (line 97)
12. `setActiveWorkspace(selectedWorkspace)` → **SUCCESS**

**Expected Result:** ✅ Workspace should be active

**Potential Issue:** Race condition if redirect happens before WorkspaceContext mounts

### Scenario 2: Delete Workspace, Then Login Again

**Steps:**
1. User deletes workspace → `handleDeleteWorkspace()` called
2. Backend deletes `workspace_members` rows → success
3. Backend deletes workspace → success
4. Frontend clears localStorage → success
5. Frontend signs out → success
6. User redirected to `/login`
7. **User logs in again** (same email)
8. `WorkspaceContext` mounts → `useEffect` runs
9. Clears localStorage (already empty, safe)
10. `fetchWorkspaces(user.id)` queries `workspace_members` → **EMPTY ARRAY**
11. `uniqueWorkspaces.length === 0` → warning logged
12. `selectedWorkspace` stays `null`
13. `activeWorkspace` remains `null`
14. Workspace switcher hidden (`workspaces.length === 0`)
15. **USER STUCK**: No workspace, no UI to create one

**Expected Result:** ❌ User should be able to create new workspace

**Root Cause:** No fallback to create workspace when `workspace_members` is empty

### Scenario 3: User Exists (Auth), But No workspace_members Rows

**Steps:**
1. User logs in → `WorkspaceContext` mounts
2. `fetchWorkspaces(user.id)` queries `workspace_members` → **EMPTY ARRAY**
3. `uniqueWorkspaces.length === 0`
4. `selectedWorkspace` stays `null`
5. `activeWorkspace` remains `null`
6. Workspace switcher hidden
7. **USER STUCK**: No way to create workspace

**Expected Result:** ❌ Should route to workspace creation or auto-create

**Root Cause:** No fallback when no memberships exist

---

## PHASE 5 — BACKEND CHECKS

### resolveActiveWorkspace()

**File:** `Converso-backend/src/utils/resolveWorkspace.ts`

**Behavior:**
- If `workspaceId` provided → verifies membership in `workspace_members`
- If no `workspaceId` → gets FIRST workspace from `workspace_members` (line 30-36)
- **Throws error** if no memberships: "User does not belong to any workspace" (line 39)

**Verdict:** ✅ Correctly uses `workspace_members` as source of truth

### GET /api/workspace Behavior

**File:** `Converso-backend/src/routes/workspace.routes.ts` lines 13-87

**Current Behavior:**

1. **If X-Workspace-Id header:**
   - Verifies membership → returns workspace or 403

2. **If no header, user authenticated:**
   - Checks `workspace_members` → returns first workspace if exists
   - **If no memberships** → falls through to legacy `getWorkspace()`

3. **Legacy fallback:**
   - `getWorkspace()` uses `.limit(1).single()` → gets ANY workspace (not user-specific)
   - **IF no workspace AND userId exists** → auto-creates workspace (line 82)
   - **PROBLEM**: Creates workspace but NOT `workspace_members` row
   - Returns workspace to frontend

**Gap Identified:**
- Backend auto-creates workspace without membership
- Frontend queries `workspace_members` → empty → can't see workspace
- **MISMATCH**: Backend returns workspace, frontend ignores it

---

## PHASE 6 — AUDIT FINDINGS + RECOMMENDED FIXES

### Critical Issues Found

#### Issue 1: No Fallback When workspace_members is Empty

**Location:** `Converso-frontend/src/context/WorkspaceContext.tsx` lines 71-107

**Problem:**
- When `workspace_members` returns empty array, `activeWorkspace` stays `null`
- No UI to create workspace
- User stuck in broken state

**Recommended Fix:**
- Add fallback in `fetchWorkspaces()`:
  - If `uniqueWorkspaces.length === 0` AND user is authenticated:
    - Option A: Auto-create workspace + membership (like signup flow)
    - Option B: Route to `/create-workspace` page
    - Option C: Show "Create Workspace" button in UI

#### Issue 2: Backend Auto-Creates Workspace Without Membership

**Location:** `Converso-backend/src/routes/workspace.routes.ts` line 82

**Problem:**
- `workspaceService.createWorkspace()` creates workspace but NOT `workspace_members` row
- Frontend queries `workspace_members` → empty → can't see workspace
- Backend returns workspace, frontend ignores it

**Recommended Fix:**
- Remove auto-creation from GET `/api/workspace` route
- Return `null` if no memberships exist
- Let frontend handle workspace creation

#### Issue 3: Signup Creates Workspace But Doesn't Set Active Immediately

**Location:** `Converso-frontend/src/hooks/useAuth.tsx` lines 155-190

**Problem:**
- Workspace created but `activeWorkspace` not set in context
- Relies on `WorkspaceContext` to pick it up
- Race condition possible

**Recommended Fix:**
- After creating workspace + membership, explicitly set active workspace:
  - Call `WorkspaceContext.setActiveWorkspaceId(workspace.id)` if context available
  - OR set localStorage immediately: `localStorage.setItem(storageKey, workspace.id)`
  - OR trigger `WorkspaceContext` refetch

#### Issue 4: No UI Indication When No Workspaces

**Location:** `Converso-frontend/src/components/Layout/Navbar.tsx` line 32

**Problem:**
- Workspace switcher hidden when `workspaces.length === 0`
- No alternative UI shown
- User doesn't know they need to create workspace

**Recommended Fix:**
- Show "Create Workspace" button when `workspaces.length === 0`
- OR route to `/create-workspace` page
- OR show onboarding modal

### Recommended Minimal Fix Set

**Priority 1: Fix Empty Workspace State**

**File:** `Converso-frontend/src/context/WorkspaceContext.tsx`

**Change:** Add fallback in `fetchWorkspaces()` when `uniqueWorkspaces.length === 0`

```typescript
// After line 75 (after deduplication)
if (uniqueWorkspaces.length === 0) {
  console.warn("[WS] No workspaces found - user needs to create workspace");
  // Option: Auto-create workspace here OR route to creation page
  // For now, just log and leave activeWorkspace as null
  setActiveWorkspace(null);
  setWorkspaces([]);
  return; // Early return, don't try to select workspace
}
```

**Priority 2: Remove Backend Auto-Creation**

**File:** `Converso-backend/src/routes/workspace.routes.ts`

**Change:** Remove auto-creation from GET route (line 81-83)

```typescript
// Remove these lines:
// if (!workspace && userId) {
//   workspace = await workspaceService.createWorkspace('Default Workspace', client);
// }
```

**Priority 3: Set Active Workspace After Signup**

**File:** `Converso-frontend/src/hooks/useAuth.tsx`

**Change:** Set localStorage immediately after workspace creation (after line 178)

```typescript
// After workspace_members insert succeeds:
if (!memberError && workspace) {
  // Set active workspace in localStorage immediately
  const storageKey = `synq_active_workspace_id:${data.user.id}`;
  localStorage.setItem(storageKey, workspace.id);
  console.log('[AUTH] active workspace set in localStorage', { workspaceId: workspace.id });
}
```

**Priority 4: Add UI for No Workspaces State**

**File:** `Converso-frontend/src/components/Layout/Navbar.tsx`

**Change:** Show "Create Workspace" when no workspaces (after line 32)

```typescript
{!loading && workspaces?.length === 0 && (
  <Button onClick={() => navigate('/create-workspace')}>
    Create Workspace
  </Button>
)}
```

---

## Code Path Reference

### Where State Can Become NULL/STALE

| Location | File | Function | Line Range | Condition |
|----------|------|----------|------------|-----------|
| WorkspaceContext | `WorkspaceContext.tsx` | `fetchWorkspaces` | 71-107 | `workspace_members` empty |
| Signup | `useAuth.tsx` | `signUp` | 155-190 | Workspace created but not set active |
| Delete | `Settings.tsx` | `handleDeleteWorkspace` | 221-261 | Clears localStorage, signs out |
| Backend GET | `workspace.routes.ts` | GET `/api/workspace` | 77-85 | Auto-creates without membership |

### Where Active Workspace is Set

| Location | File | Function | Line Range | Trigger |
|----------|------|----------|------------|---------|
| Context Fetch | `WorkspaceContext.tsx` | `fetchWorkspaces` | 106 | After validating stored ID |
| Context Switch | `WorkspaceContext.tsx` | `setActiveWorkspaceId` | 138 | User clicks workspace in dropdown |
| Signup | `useAuth.tsx` | `signUp` | **NOT SET** | Workspace created but not set |

---

## Test Scenarios

### Test 1: New Signup
1. Sign up with new email
2. Check console logs: `[AUTH] signup success`, `[AUTH] workspace created?`
3. Check `[WS] boot start` → `[WS] resolved active workspace`
4. **Expected**: Active workspace set, switcher visible

### Test 2: Delete Then Login
1. Delete workspace as admin
2. Check logs: `[WS-DELETE] signing out`
3. Login again
4. Check logs: `[WS] boot start` → `[WS] memberships loaded` → should show empty
5. **Expected**: Should show "Create Workspace" UI or auto-create

### Test 3: User With No Memberships
1. Manually delete `workspace_members` row in DB
2. Login
3. Check logs: `[WS] memberships loaded` → `{ memberships: 0 }`
4. **Expected**: Should handle gracefully, not break UI

---

## Summary

**Root Causes:**
1. No fallback when `workspace_members` is empty
2. Backend auto-creates workspace without membership (mismatch)
3. Signup doesn't set active workspace immediately
4. No UI indication when user has no workspaces

**Recommended Fix Priority:**
1. Add fallback in `WorkspaceContext.fetchWorkspaces()` for empty state
2. Remove backend auto-creation from GET route
3. Set localStorage after signup workspace creation
4. Add "Create Workspace" UI when no workspaces

**Files to Modify:**
- `Converso-frontend/src/context/WorkspaceContext.tsx` (fallback logic)
- `Converso-backend/src/routes/workspace.routes.ts` (remove auto-create)
- `Converso-frontend/src/hooks/useAuth.tsx` (set localStorage after creation)
- `Converso-frontend/src/components/Layout/Navbar.tsx` (no workspaces UI)

