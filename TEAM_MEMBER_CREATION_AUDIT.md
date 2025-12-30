# Team Member Creation Flow - Complete Audit Report

## PHASE A — BACKEND CODE AUDIT

### STEP 1 — Team Member API Location

**Route File:** `Converso-backend/src/routes/teamMembers.routes.ts`  
**Controller Function:** POST handler at lines 66-112  
**Service Function:** `teamMembersService.createMember()` (line 102)  
**API Function:** `teamMembersApi.createTeamMember()` (line 57 in services/teamMembers.ts)  
**Framework:** Express.js with asyncHandler wrapper

**File Paths:**
- Route: `src/routes/teamMembers.routes.ts` (line 66)
- Service: `src/services/teamMembers.ts` (line 45)
- API: `src/api/teamMembers.ts` (line 128)

---

### STEP 2 — Execution Flow (Line-by-Line)

| Step | Operation | Table / API | Condition |
|------|-----------|-------------|-----------|
| 1 | Extract `userId` from request | `req.user?.id` or `req.headers['x-user-id']` | Optional auth |
| 2 | Extract `email`, `full_name`, `role` from body | Request body | Required validation |
| 3 | Validate email and full_name present | - | Returns 400 if missing |
| 4 | Validate role is 'admin' or 'sdr' | - | Returns 400 if invalid |
| 5 | Try to resolve workspace for current user | `resolveActiveWorkspace({ userId })` | Catches error, sets workspaceId to undefined |
| 6 | Fetch admin profile for full_name | `supabaseAdmin.from('profiles').select('full_name').eq('id', userId).single()` | No error handling |
| 7 | Call `teamMembersService.createMember()` | Service layer | Passes all params |
| 8 | Service validates email/fullName | - | Throws Error if missing |
| 9 | Service calls `teamMembersApi.createTeamMember()` | API layer | **THROWS ERROR HERE** |
| 10 | API function throws: "Team member creation not yet implemented" | - | **NO IMPLEMENTATION** |

**CRITICAL FINDING:** Step 9-10 — The `createTeamMember` function in `src/api/teamMembers.ts` line 128-137 is a **STUB** that immediately throws an error:

```typescript
export async function createTeamMember(...): Promise<TeamMember> {
  throw new Error('Team member creation not yet implemented. Please use the profiles API instead.');
}
```

**There is NO actual implementation** that:
- Checks if email exists in auth.users
- Creates user via auth.admin.createUser
- Inserts into profiles table
- Inserts into workspace_members table
- Inserts into user_roles table

---

### STEP 3 — Error Handling Audit

**Error Handling in Route Handler (lines 66-112):**
- Wrapped in `asyncHandler` (catches async errors)
- No try/catch blocks in route handler itself
- Errors from `createMember()` propagate to `asyncHandler`
- `asyncHandler` calls `next(error)` → goes to global error handler

**Error Handling in Service Layer (lines 45-58):**
- Validates email/fullName, throws Error if missing
- No try/catch - errors propagate up
- Calls API function which throws immediately

**Error Handling in API Layer (lines 128-137):**
- Function immediately throws Error
- No database operations attempted
- No error checking needed (always throws)

**Global Error Handler (`src/utils/errorHandler.ts`):**
- Catches all errors via Express error middleware
- Sets statusCode to 500 (default) or err.statusCode
- Logs error with logger
- Returns JSON: `{ error: { message, statusCode } }`
- In development: includes stack trace and code
- In production: masks 500 errors as "Internal server error"

**Error Flow:**
1. `createTeamMember()` throws Error
2. Error propagates through service → route → asyncHandler
3. asyncHandler catches → calls `next(error)`
4. Express error middleware → `errorHandler()`
5. Returns HTTP 500 with message: "Team member creation not yet implemented..."

**Error Message Visibility:**
- ✅ Error message is logged
- ✅ Error message is returned in response (development)
- ✅ Error message is masked in production (500 → "Internal server error")
- ❌ No specific handling for "email already exists" scenario (never reached)

---

## PHASE B — SUPABASE SCHEMA AUDIT (READ ONLY)

**NOTE:** The following SQL queries need to be run in Supabase SQL Editor to get actual results. Providing expected structure based on migrations:

### STEP 4 — workspace_members Constraints

**Expected Constraints (from migration analysis):**
- Primary Key: `id` (UUID)
- Foreign Key: `workspace_id` → `workspaces(id)` ON DELETE CASCADE
- Foreign Key: `user_id` → `auth.users(id)` ON DELETE CASCADE
- Unique Constraint: `unique_workspace_member` on `(workspace_id, user_id)` (if migration applied)

**SQL to Run:**
```sql
SELECT conname, pg_get_constraintdef(c.oid)
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'workspace_members';
```

**Expected Result:**
- `workspace_members_pkey` (PRIMARY KEY on id)
- `workspace_members_workspace_id_fkey` (FOREIGN KEY)
- `workspace_members_user_id_fkey` (FOREIGN KEY)
- `unique_workspace_member` (UNIQUE on workspace_id, user_id) - **IF migration applied**

---

### STEP 5 — profiles Constraints

**Expected Constraints:**
- Primary Key: `id` (UUID, references auth.users)
- Foreign Key: `workspace_id` → `workspaces(id)` ON DELETE SET NULL (if column exists)

**SQL to Run:**
```sql
SELECT conname, pg_get_constraintdef(c.oid)
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'profiles';
```

**Expected Result:**
- `profiles_pkey` (PRIMARY KEY on id)
- `profiles_id_fkey` (FOREIGN KEY to auth.users)
- `profiles_workspace_id_fkey` (FOREIGN KEY, if workspace_id column exists)

---

### STEP 6 — user_roles Constraints

**Expected Constraints:**
- Primary Key: `id` (UUID)
- Unique Constraint: `(user_id, role)` - allows multiple roles per user

**SQL to Run:**
```sql
SELECT conname, pg_get_constraintdef(c.oid)
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'user_roles';
```

**Expected Result:**
- `user_roles_pkey` (PRIMARY KEY on id)
- `user_roles_user_id_role_key` (UNIQUE on user_id, role)

---

### STEP 7 — RLS Policies (workspace_members)

**SQL to Run:**
```sql
SELECT policyname, cmd, roles, qual
FROM pg_policies
WHERE tablename = 'workspace_members';
```

**Expected:** Policies may exist for SELECT/INSERT/UPDATE based on workspace membership. Need actual results.

---

### STEP 8 — RLS Policies (profiles)

**SQL to Run:**
```sql
SELECT policyname, cmd, roles, qual
FROM pg_policies
WHERE tablename = 'profiles';
```

**Expected:** Policies likely exist for users to view/update their own profile and workspace members. Need actual results.

---

## PHASE C — DATA SCENARIO VERIFICATION

### STEP 9 — Existing User Check Logic

**Answer: NO**

The backend does NOT check if email already exists because:
- The `createTeamMember()` function is a stub that throws immediately
- No code path reaches database operations
- No `supabaseAdmin.auth.admin.listUsers()` call
- No `supabaseAdmin.from('profiles').select().eq('email', email)` check

**Code Proof:**
```typescript
// src/api/teamMembers.ts:128-137
export async function createTeamMember(...): Promise<TeamMember> {
  throw new Error('Team member creation not yet implemented. Please use the profiles API instead.');
  // ↑ Function exits here, never reaches any database operations
}
```

---

### STEP 10 — Workspace Membership Logic

**Answer: N/A (Not Implemented)**

No workspace membership logic exists because the function throws before any database operations.

**Expected Logic (if implemented):**
- Would need to check: `SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?`
- Would need to use: `INSERT ... ON CONFLICT (workspace_id, user_id) DO NOTHING` or check first
- Currently: **NO CODE EXISTS**

---

## FINAL AUDIT SUMMARY

### 1. EXACT Operation That Throws the 500 Error

**Location:** `Converso-backend/src/api/teamMembers.ts`, line 136  
**Operation:** `throw new Error('Team member creation not yet implemented...')`  
**When:** Immediately upon calling `createTeamMember()` function  
**HTTP Status:** 500 (Internal Server Error)  
**Error Message:** "Team member creation not yet implemented. Please use the profiles API instead."

---

### 2. WHY It Fails Specifically When Email Already Exists

**Answer:** It does NOT fail because email already exists. It fails because **the function is not implemented at all**.

The error occurs **before** any database operations:
- Before checking if email exists
- Before creating auth user
- Before inserting into profiles
- Before inserting into workspace_members
- Before inserting into user_roles

**The failure is identical for:**
- New emails (never seen before)
- Existing emails (already in auth.users)
- Invalid emails
- Any input whatsoever

**Root Cause:** The function is a placeholder stub that always throws.

---

### 3. Which Assumption in Backend Logic is Invalid

**Invalid Assumption:** That `createTeamMember()` function is implemented and performs database operations.

**Reality:**
- Route handler assumes service will create team member
- Service assumes API function will create team member
- API function is empty stub that throws error
- No implementation exists anywhere in codebase

**Additional Invalid Assumptions (if function were implemented):**
- Would assume email doesn't exist (no check)
- Would assume user creation always succeeds (no duplicate handling)
- Would assume profile insert succeeds (no conflict handling)
- Would assume workspace_members insert succeeds (no duplicate handling)

---

### 4. Failure Category Analysis

**Primary Failure:** **Missing Implementation / Stub Function**

**Secondary Failures (if function were implemented):**
- ❌ **Missing Branching:** No check for existing email/user
- ❌ **Missing Conflict Handling:** No ON CONFLICT or existence checks
- ❌ **Silent Error Masking:** Would mask database errors as generic 500s
- ⚠️ **RLS Policy:** Unknown if policies would block admin operations (needs SQL results)
- ⚠️ **Unique Constraint:** Would fail on duplicate (workspace_id, user_id) if constraint exists

**Current State:**
- ✅ Error is NOT masked (message is clear: "not yet implemented")
- ✅ Error is logged properly
- ❌ Error occurs before any database operations
- ❌ No branching logic exists (function always throws)

---

## CONCLUSION

**The 500 error occurs because the `createTeamMember()` function is a stub that throws an error immediately, before any database operations are attempted.**

**The failure has nothing to do with:**
- Email already existing
- Database constraints
- RLS policies
- Workspace membership logic

**The failure is due to:**
- **Missing implementation** - function is placeholder
- **No code path** that performs actual team member creation
- **No error handling** needed (function always throws same error)

**To fix:** The `createTeamMember()` function in `src/api/teamMembers.ts` needs to be fully implemented with:
1. Check if email exists in auth.users
2. Create user if new, or fetch existing user_id
3. Create/update profile
4. Create workspace_members row (with conflict handling)
5. Create user_roles row (with conflict handling)
6. Return TeamMember object

**Current Status:** Function throws error → 500 response → "Team member creation not yet implemented"

