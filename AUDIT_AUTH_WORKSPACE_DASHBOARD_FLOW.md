# Audit Report: Auth → Workspace → Dashboard Flow

## Executive Summary

This audit identifies **5 root causes** causing the auth → workspace → dashboard flow to break. All issues are **frontend state management and timing problems**, not database or backend issues.

---

## STEP 1 — WorkspaceContext Audit

### Initial State Values
- `activeWorkspace`: `null` (initialized as `null`)
- `workspaces`: `[]` (empty array)
- `loading`: `true` (starts as `true`)
- `hasNoWorkspaceMembership`: `false`

### How activeWorkspace is Managed

**localStorage Key:** `synq_active_workspace_id:${userId}`

**Initialization Flow:**
1. On `user?.id` change (line 144-167):
   - **CRITICAL BUG #1:** Line 163 clears localStorage: `localStorage.removeItem(storageKey)`
   - This happens on EVERY login, even if workspace was just created
   - Then calls `fetchWorkspaces(user.id)` which is async

2. `fetchWorkspaces()` (line 28-142):
   - Queries `workspace_members` table (async)
   - Maps to `WorkspaceSummary[]`
   - Reads from localStorage (line 97): `localStorage.getItem(storageKey)`
   - **PROBLEM:** localStorage was just cleared on line 163, so `savedWorkspaceId` is `null`
   - Validates against fetched workspaces (line 107-109)
   - If no saved ID, uses first workspace (line 114-117)
   - Sets `activeWorkspace` state (line 132)

**When activeWorkspace Becomes Null:**
- Line 86: If `uniqueWorkspaces.length === 0` → sets `activeWorkspace = null`
- Line 150: If `!user?.id` → sets `activeWorkspace = null`
- Line 131-136: If `selectedWorkspace` is `null` → `activeWorkspace` stays `null` (no explicit set)

**Critical Issue:**
- Line 163: **localStorage is cleared on EVERY login**
- This means even if workspace was just created and localStorage was set, it gets wiped
- Then `fetchWorkspaces()` runs async, and during that time `activeWorkspace` is `null`
- If navigation happens before `fetchWorkspaces()` completes, context has no workspace

**setActiveWorkspaceId Implementation (line 169-181):**
```typescript
const setActiveWorkspaceId = useCallback(
  (id: string) => {
    if (!user?.id) return;
    const workspace = workspaces.find((w) => w.id === id);
    if (workspace) {
      setActiveWorkspace(workspace);
      localStorage.setItem(storageKey, id);
    }
  },
  [user?.id, workspaces]
);
```

**CRITICAL BUG #2:** `setActiveWorkspaceId` only works if workspace exists in `workspaces` array
- If `workspaces` array is empty (not yet fetched), `workspaces.find()` returns `undefined`
- Function silently fails (no error, no state update)
- This explains why `setActiveWorkspaceId(workspace.id)` in CreateWorkspace.tsx doesn't work

**Lifecycle:**
- `fetchWorkspaces()` runs on `user?.id` change (line 144-167)
- It's async, takes time to complete
- Context renders BEFORE data arrives
- During this window, `activeWorkspace` is `null` and `loading` is `true`

---

## STEP 2 — Route Guards / Navigation Logic Audit

### ProtectedRoute Component Analysis

**Location:** `src/components/ProtectedRoute.tsx`

**Guards in Order:**
1. **Loading Check (line 16):**
   - Condition: `if (loading || wsLoading)`
   - Shows loading spinner
   - **PROBLEM:** Blocks navigation while WorkspaceContext is fetching

2. **Auth Check (line 28):**
   - Condition: `if (!user)`
   - Redirects to `/login`

3. **No Workspace Check (line 34):**
   - Condition: `if (hasNoWorkspaceMembership && location.pathname !== '/create-workspace')`
   - Redirects to `/create-workspace`
   - **CRITICAL BUG #3:** This check runs BEFORE `fetchWorkspaces()` completes
   - If `fetchWorkspaces()` is still loading, `hasNoWorkspaceMembership` might be `false` (initial state)
   - But if fetch completes and finds no workspaces, `hasNoWorkspaceMembership` becomes `true`
   - This creates a race condition

**What Happens if:**
- User exists ✅
- Workspace exists in DB ✅
- BUT `activeWorkspace` is `null` in context:
  - ProtectedRoute waits for `wsLoading` to finish (line 16)
  - If `hasNoWorkspaceMembership` is `false` (initial state), allows navigation
  - But `activeWorkspace` is still `null` because fetch hasn't completed
  - Dashboard renders but has no workspace context

---

## STEP 3 — Login Flow Audit

### Login.tsx Analysis

**Location:** `src/pages/Login.tsx`

**After Successful Login:**
1. Line 44: Calls `signIn(email, password)`
2. Line 50: Shows toast "Signed in successfully"
3. Line 51: Comment says "Navigation will happen automatically via the useEffect above"
4. Line 21-25: `useEffect` checks:
   ```typescript
   if (!authLoading && user && userRole) {
     navigate('/');
   }
   ```

**CRITICAL BUG #4:** Navigation depends on `userRole`
- `userRole` is fetched asynchronously in `useAuth.tsx` (line 25-68)
- `fetchUserRole()` queries `user_roles` table (line 38-42)
- If `user_roles` table is empty, `userRole` stays `null`
- Navigation never happens because condition `user && userRole` fails

**What Happens:**
- Login succeeds ✅
- User exists ✅
- `userRole` is `null` (because `user_roles` table is empty)
- `useEffect` condition fails: `user && userRole` → `true && null` → `false`
- Navigation never triggers
- User stays on login page

**useAuth.tsx fetchUserRole (line 25-68):**
- First checks `user.user_metadata?.role` (line 30-35)
- Falls back to `user_roles` table query (line 38-42)
- If query fails with `PGRST116` (no rows), sets `userRole = null` (line 47)
- **PROBLEM:** If `user_roles` table is empty, `userRole` is `null`
- This blocks navigation in Login.tsx

---

## STEP 4 — CreateWorkspace Flow Audit

### CreateWorkspace.tsx Analysis

**Location:** `src/pages/CreateWorkspace.tsx`

**What is Written:**
1. **workspaces table (line 43-51):**
   - Inserts workspace with `owner_user_id` and `owner_email` ✅

2. **workspace_members table (line 73-78):**
   - Inserts row with `role: 'admin'` ✅
   - **ISSUE:** Role is 'admin', not 'owner' (but this is by design per requirements)

3. **profiles table (line 98-101):**
   - Updates `workspace_id` (legacy field) ✅

4. **user_roles table (line 104-110):**
   - Inserts row with `role: 'admin'` ✅
   - **ISSUE:** No error handling if insert fails
   - If insert fails silently, `userRole` stays `null`

**Role Assignment:**
- Line 78: `role: 'admin'` in `workspace_members`
- Line 108: `role: 'admin'` in `user_roles`
- **This is correct per design** (admin is the role, owner is a database field)

**Navigation Trigger:**
- Line 119: `navigate('/dashboard', { replace: true })`
- **CRITICAL BUG #5:** Navigation happens BEFORE WorkspaceContext refreshes
- Line 116: `setActiveWorkspaceId(workspace.id)` is called
- But `setActiveWorkspaceId` fails silently if `workspaces` array is empty (Bug #2)
- Navigation happens immediately
- When Dashboard mounts, WorkspaceContext is still fetching
- `activeWorkspace` is `null` during this window

**Assumptions:**
- CreateWorkspace assumes WorkspaceContext will auto-refresh
- But refresh happens AFTER navigation
- During the gap, `activeWorkspace` is `null`

---

## STEP 5 — user_roles Design Audit

### user_roles Table Structure

**From migration:** `20251122145622_c7db1f22-8f46-479d-9938-bcfe1c7bb29a.sql`

**Structure:**
- `id` (primary key)
- `user_id` (uuid, references auth.users)
- `role` (text: 'admin' | 'sdr')
- Unique constraint on `(user_id, role)`

**Is user_roles REQUIRED?**
- **YES** - `useAuth.tsx` line 38-42 queries it
- **YES** - `Login.tsx` line 22 checks `userRole` for navigation
- **YES** - `ProtectedRoute.tsx` line 40 checks `userRole` for admin pages

**Is there a trigger inserting into it?**
- **NO** - No database trigger found
- Frontend is responsible for inserting roles

**What breaks if table is empty?**
- `userRole` stays `null` in AuthContext
- Login navigation fails (Bug #4)
- Admin-only pages inaccessible
- Role-based UI features don't work

---

## STEP 6 — Timeline Reconstruction

### Timeline: Signup → Create Workspace → Dashboard

**A) Signup:**
- User signs up → `signUp()` creates auth user ✅
- Returns user data
- Redirects to `/create-workspace` ✅

**B) Create Workspace:**
- User enters workspace name
- Clicks "Create Workspace"
- Workspace created in DB ✅
- `workspace_members` row created ✅
- `user_roles` row created (may fail silently)
- localStorage set: `synq_active_workspace_id:${userId}` ✅
- `setActiveWorkspaceId(workspace.id)` called
- **BUG:** `setActiveWorkspaceId` fails silently because `workspaces` array is empty
- `navigate('/dashboard')` called immediately

**C) Redirect to Dashboard:**
- Navigation happens
- Dashboard route mounts
- `ProtectedRoute` component renders

**D) Dashboard Mount:**
- `ProtectedRoute` checks `loading || wsLoading`
- If WorkspaceContext is still fetching → shows loading spinner
- If fetch completes → checks `hasNoWorkspaceMembership`

**E) WorkspaceContext Initialization:**
- `useEffect` runs on `user?.id` change (line 144)
- **BUG:** Clears localStorage (line 163) ← **This wipes the workspace ID we just set**
- Calls `fetchWorkspaces(user.id)` (async)
- During fetch, `activeWorkspace` is `null`
- After fetch completes, reads localStorage (which was just cleared)
- Finds no saved workspace ID
- Uses first workspace from fetched list (if any)
- Sets `activeWorkspace` state

**F) Route Guard Evaluation:**
- `ProtectedRoute` checks `hasNoWorkspaceMembership`
- If fetch found workspaces → `hasNoWorkspaceMembership = false` ✅
- Allows Dashboard to render
- But `activeWorkspace` might still be `null` if fetch hasn't completed

**Root Cause:**
- **Timing issue:** Navigation happens before WorkspaceContext finishes fetching
- **State clearing:** localStorage is cleared on every login, wiping newly set workspace ID
- **Silent failure:** `setActiveWorkspaceId` fails if `workspaces` array is empty

---

## ROOT CAUSES

### 1. **localStorage Cleared on Every Login** (Frontend)
**Location:** `WorkspaceContext.tsx` line 163
**Impact:** Workspace ID set during creation is immediately wiped
**Severity:** HIGH

### 2. **setActiveWorkspaceId Silent Failure** (Frontend)
**Location:** `WorkspaceContext.tsx` line 169-181
**Impact:** Cannot set active workspace if `workspaces` array is empty
**Severity:** HIGH

### 3. **Race Condition in ProtectedRoute** (Frontend)
**Location:** `ProtectedRoute.tsx` line 16, 34
**Impact:** Navigation allowed before workspace fetch completes
**Severity:** MEDIUM

### 4. **Login Navigation Depends on userRole** (Frontend)
**Location:** `Login.tsx` line 22
**Impact:** If `user_roles` table is empty, navigation never happens
**Severity:** HIGH

### 5. **user_roles Insert May Fail Silently** (Frontend)
**Location:** `CreateWorkspace.tsx` line 104-110
**Impact:** No error handling, `userRole` stays `null`
**Severity:** MEDIUM

---

## ISSUE CLASSIFICATION

### Frontend Issues:
- ✅ Bug #1: localStorage cleared on login
- ✅ Bug #2: setActiveWorkspaceId silent failure
- ✅ Bug #3: Race condition in ProtectedRoute
- ✅ Bug #4: Login navigation depends on userRole
- ✅ Bug #5: user_roles insert may fail silently

### Backend Issues:
- ❌ None identified

### Design Gaps:
- ⚠️ No mechanism to wait for WorkspaceContext to finish before navigation
- ⚠️ No fallback if `setActiveWorkspaceId` fails
- ⚠️ No error handling for `user_roles` insert

---

## Minimum Required Fixes (No Refactor)

### Fix #1: Don't Clear localStorage on Login
**File:** `WorkspaceContext.tsx` line 163
**Change:** Remove `localStorage.removeItem(storageKey)` OR only clear if workspace doesn't exist in fetched list
**Impact:** Preserves workspace ID set during creation

### Fix #2: Make setActiveWorkspaceId Work Without workspaces Array
**File:** `WorkspaceContext.tsx` line 169-181
**Change:** If workspace not found in array, set localStorage anyway and trigger fetchWorkspaces refresh
**Impact:** Allows setting workspace ID even before fetch completes

### Fix #3: Wait for WorkspaceContext Before Navigation
**File:** `CreateWorkspace.tsx` line 119
**Change:** Wait for `loading` to become `false` before navigating, OR use `window.location.href` to force full reload
**Impact:** Ensures context is ready before Dashboard mounts

### Fix #4: Remove userRole Dependency from Login Navigation
**File:** `Login.tsx` line 22
**Change:** Navigate based on `user` only, not `userRole`
**Impact:** Allows navigation even if `user_roles` table is empty

### Fix #5: Add Error Handling for user_roles Insert
**File:** `CreateWorkspace.tsx` line 104-110
**Change:** Wrap insert in try/catch, log errors, don't block navigation
**Impact:** Prevents silent failures

---

## Additional Observations

### Why It Works After Cache Clear / Incognito:
- Fresh browser = no stale state
- WorkspaceContext starts fresh
- `fetchWorkspaces()` completes before any navigation
- Timing works out correctly

### Why First Member is Admin, Not Owner:
- This is **by design** per codebase
- `workspace_members.role` = 'admin' (correct)
- `workspaces.owner_user_id` = user ID (correct)
- Owner is a database field, admin is a role
- **Not a bug**

---

## Conclusion

All 5 root causes are **frontend state management and timing issues**. The database is correct, backend is correct, but frontend state synchronization is broken. The fixes are minimal and targeted, requiring no refactoring.

