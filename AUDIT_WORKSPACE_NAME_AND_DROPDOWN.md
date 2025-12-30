# Workspace Name "Jumping" + Duplicate Workspace Dropdown - Audit Report

## Symptoms
1. **Workspace name input repopulates after deleting text** - User types/deletes workspace name, but it jumps back to original value
2. **Workspace dropdown shows duplicate workspaces** - Same workspace appears multiple times in the switcher dropdown

## Repro Steps
1. Login as Admin user
2. Navigate to Settings → Workspace tab
3. Try to rename workspace → Observe name "jumping"
4. Open workspace dropdown → Observe duplicate entries

## Observations
_(To be filled during audit)_

## Data Sources

### Frontend
- **WorkspaceContext**: `src/context/WorkspaceContext.tsx`
  - Uses: `workspace_members` join with `workspaces` table
  - Query: `.select('workspace_id, role, workspaces:workspaces(id, name)')`
  - Supports multi-workspace users
- **Settings Page**: `src/pages/Settings.tsx`
  - Uses: `useWorkspace()` hook from `src/hooks/useWorkspace.tsx`
  - Calls: `/api/workspace` endpoint
  - Local state: `workspaceName` synced via `useEffect` on `workspace?.id`
- **Navbar Switcher**: `src/components/Layout/Navbar.tsx`
  - Uses: `useWorkspace()` from `WorkspaceContext`
  - Renders: `workspaces.map((ws) => ...)` with `key={ws.id}`
- **API Client**: `src/lib/api-client.ts`
  - Adds `X-Workspace-Id` header from localStorage

### Backend
- **Workspace Update Route**: `src/routes/workspace.routes.ts`
  - Route: `PUT /api/workspace`
  - Handler: Calls `workspaceService.updateWorkspace(name, client)`
  - **CRITICAL**: Does NOT use `X-Workspace-Id` header or `resolveActiveWorkspace()`
- **Workspace Service**: `src/services/workspace.ts`
  - Calls: `workspaceApi.updateWorkspace(name, client)`
- **Workspace API**: `src/api/workspace.ts`
  - `getWorkspace()`: Uses `.limit(1).single()` - gets FIRST workspace in table!
  - `updateWorkspace()`: Calls `getWorkspace()` first, then updates that workspace
  - **CRITICAL**: Does NOT respect active workspace or `X-Workspace-Id` header

### Database
- **workspaces** table: `id`, `name`, `created_at`, `updated_at`
- **workspace_members** table: `user_id`, `workspace_id`, `role`

## Hypotheses

### HYPOTHESIS 1: Input jumps due to useEffect overwriting local state
- **Evidence needed**: Console logs showing useEffect firing when workspace object reference changes
- **Likely cause**: `useEffect` dependency on `workspace?.id` may still fire if `workspace` object reference changes

### HYPOTHESIS 2: Update API updates wrong workspace
- **Evidence needed**: Backend logs showing which workspace ID is being updated
- **Likely cause**: Backend `getWorkspace()` uses `.limit(1).single()` which gets FIRST workspace, not active workspace
- **CRITICAL FINDING**: Backend `/api/workspace` does NOT use `X-Workspace-Id` header or `resolveActiveWorkspace()`

### HYPOTHESIS 3: Duplicate workspaces in dropdown
- **Evidence needed**: DB query for duplicate memberships + frontend raw data logs
- **Likely cause**: Either DB has duplicate `workspace_members` rows OR frontend mapping creates duplicates

## Evidence

### Phase 1 - Data Flow
- [x] WorkspaceSummary type definition
  ```typescript
  export interface WorkspaceSummary {
    id: string;
    name: string;
    role: string;
  }
  ```
- [x] WorkspaceContext query string
  - Query: `.from('workspace_members').select('workspace_id, role, workspaces:workspaces(id, name)').eq('user_id', userId)`
  - Source of truth: `workspaces.name` via join
- [x] localStorage key format and usage
  - Key: `synq_active_workspace_id:${userId}`
  - Written: When active workspace is selected
  - Cleared: On login (user.id changes)

### Phase 2 - Settings Tab
- [x] Input state ownership
  - Local state: `const [workspaceName, setWorkspaceName] = useState("")`
  - Synced via: `useEffect(() => { setWorkspaceName(workspace.name) }, [workspace?.id])`
  - Input value: `value={workspaceName}` (local state only)
- [x] useEffect dependencies
  - Dependency: `[workspace?.id]` - syncs only when workspace ID changes
  - **POTENTIAL ISSUE**: If `workspace` object reference changes but ID stays same, may not trigger
- [x] Update handler flow
  - Handler: `handleUpdateWorkspace()` calls `updateWorkspace.mutateAsync(workspaceName)`
  - Hook: `useUpdateWorkspace()` calls `apiClient.put('/api/workspace', { name })`
  - On success: Invalidates `['workspace']` query, shows toast
  - **CRITICAL**: Uses `/api/workspace` which does NOT respect `X-Workspace-Id` header

### Phase 3 - Update API
- [x] Frontend API call endpoint + payload
  - Endpoint: `PUT /api/workspace`
  - Payload: `{ name: string }`
  - Headers: Includes `X-Workspace-Id` (from api-client.ts) but backend ignores it
- [x] Backend route handler
  - Route: `src/routes/workspace.routes.ts` - `PUT /api/workspace`
  - Handler: Calls `workspaceService.updateWorkspace(name, client)`
  - **CRITICAL**: Does NOT read `X-Workspace-Id` header or use `resolveActiveWorkspace()`
- [x] SQL filter used
  - Backend `getWorkspace()`: `.limit(1).single()` - gets FIRST workspace in table
  - Backend `updateWorkspace()`: `.eq('id', workspace.id)` - updates the workspace from `getWorkspace()`
  - **ROOT CAUSE**: Updates wrong workspace if user has multiple workspaces!

### Phase 4 - Duplicate Workspaces
- [ ] DB duplicate memberships query result
  - **TODO**: Run SQL query in Supabase to check for duplicate `workspace_members` rows
- [x] Raw workspace_members rows from frontend
  - Logged: `[WS-CTX] raw workspace_members rows` in `fetchWorkspaces()`
- [x] Mapped workspaceList
  - Logged: `[WS-CTX] mapped workspaceList` before deduplication
  - Deduplication: Uses `Map` by `workspace.id` to prevent duplicates
- [x] Dropdown rendering logic
  - Source: `workspaces` from `WorkspaceContext` (already deduplicated)
  - Key: `key={ws.id}` (correct)
  - Logged: `[WS-NAV] dropdown item` for each rendered item

### Phase 5 - Active Workspace / Cache
- [ ] localStorage current value
  - **TODO**: Check browser devtools → Application → Local Storage
- [x] Active workspace selection logic
  - Logged: `[WS-CTX] selecting active workspace` with savedWorkspaceId and uniqueWorkspaces
  - Logic: Validates savedWorkspaceId against fetched list, defaults to first if invalid
- [x] Refetch triggers
  - On login: `useEffect` clears localStorage and calls `fetchWorkspaces(user.id)`
  - On workspace update: `useUpdateWorkspace()` invalidates `['workspace']` query
  - **ISSUE**: Query invalidation may cause `useWorkspace()` hook to refetch, triggering useEffect sync

## Root Cause Decision Tree

### CASE 1: Input jumps because useEffect overwrites local state
**Status**: LIKELY
**Evidence**: 
- useEffect dependency is `[workspace?.id]` which should only fire on ID change
- However, if `workspace` object reference changes (from query refetch), React may re-render
- When query invalidates after update, `useWorkspace()` hook refetches, causing `workspace` object to change
- This may trigger useEffect sync even if ID is same
**Fix needed**: Ensure useEffect only syncs when ID actually changes, or use ref to track previous ID

### CASE 2: Update updates wrong workspaceId
**Status**: CONFIRMED - ROOT CAUSE IDENTIFIED
**Evidence**: 
- Backend `/api/workspace` route does NOT use `X-Workspace-Id` header
- Backend `getWorkspace()` uses `.limit(1).single()` - gets FIRST workspace in table
- Backend `updateWorkspace()` calls `getWorkspace()` first, then updates that workspace
- If user has multiple workspaces, it updates the FIRST one (by created_at?), not the active one
**Fix needed**: Backend must use `X-Workspace-Id` header or `resolveActiveWorkspace()` to get correct workspace

### CASE 3: Dropdown duplicates due to DB duplicate rows
**Status**: PENDING - Need SQL query results
**Evidence needed**: Run `SQL_AUDIT_QUERIES.sql` to check for duplicate `workspace_members` rows
**Fix needed**: If duplicates exist, add unique constraint and clean data

### CASE 4: Dropdown duplicates due to frontend mapping
**Status**: UNLIKELY - Already deduplicated
**Evidence**: 
- Frontend already has deduplication logic using `Map` by `workspace.id`
- Dropdown uses `key={ws.id}` correctly
- If duplicates still appear, likely DB issue (CASE 3)
**Fix needed**: None if deduplication is working correctly

## Summary of Findings

### CRITICAL ISSUE IDENTIFIED: Backend Updates Wrong Workspace
**Root Cause**: Backend `/api/workspace` endpoint does NOT respect the active workspace.

**Evidence**:
1. Frontend sends `X-Workspace-Id` header via `api-client.ts`
2. Backend route handler (`workspace.routes.ts`) receives header but ignores it
3. Backend `getWorkspace()` uses `.limit(1).single()` - gets FIRST workspace in table
4. Backend `updateWorkspace()` updates whatever `getWorkspace()` returns
5. If user has multiple workspaces, it updates the FIRST one (by created_at?), not the active one

**Impact**:
- User updates workspace name in Settings
- Backend updates wrong workspace (first workspace, not active workspace)
- Frontend refetches workspace data
- `useWorkspace()` hook returns updated workspace (wrong one)
- `useEffect` syncs local state with wrong workspace name
- Input "jumps" back to wrong workspace name

### POTENTIAL ISSUE: Input Repopulation
**Likely Cause**: Query invalidation after update causes refetch, triggering useEffect sync

**Evidence**:
- `useUpdateWorkspace()` invalidates `['workspace']` query on success
- `useWorkspace()` hook refetches, causing `workspace` object reference to change
- `useEffect` dependency `[workspace?.id]` may still fire if React sees object change
- Local state gets overwritten with context value

### DUPLICATE WORKSPACES: Status Unknown
**Need**: Run SQL queries to check for duplicate `workspace_members` rows
**Frontend**: Already has deduplication logic, so if duplicates appear, likely DB issue

## Next Steps

1. **Run SQL Audit Queries**: Execute `SQL_AUDIT_QUERIES.sql` in Supabase SQL Editor
   - Check for duplicate `workspace_members` rows
   - Check for workspaces with same name
   - Verify unique constraint exists

2. **Test with Audit Logs**: 
   - Start frontend dev server
   - Start backend dev server
   - Login as Admin user
   - Navigate to Settings → Workspace tab
   - Try to rename workspace
   - Check browser console for `[WS-SETTINGS]` and `[WS-CTX]` logs
   - Check backend terminal for `[WS-BACKEND]` logs

3. **Collect Evidence**:
   - Copy console logs from browser
   - Copy backend logs from terminal
   - Paste SQL query results
   - Update this document with findings

## Console Logs Output
_(To be pasted after running with audit logs)_

## Supabase Query Outputs
_(To be pasted after running queries)_

## Backend Log Snippet
_(To be pasted after testing update)_

