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
- [ ] WorkspaceSummary type definition
- [ ] WorkspaceContext query string
- [ ] localStorage key format and usage

### Phase 2 - Settings Tab
- [ ] Input state ownership
- [ ] useEffect dependencies
- [ ] Update handler flow

### Phase 3 - Update API
- [ ] Frontend API call endpoint + payload
- [ ] Backend route handler
- [ ] SQL filter used

### Phase 4 - Duplicate Workspaces
- [ ] DB duplicate memberships query result
- [ ] Raw workspace_members rows from frontend
- [ ] Mapped workspaceList
- [ ] Dropdown rendering logic

### Phase 5 - Active Workspace / Cache
- [ ] localStorage current value
- [ ] Active workspace selection logic
- [ ] Refetch triggers

## Root Cause Decision Tree

### CASE 1: Input jumps because useEffect overwrites local state
**Evidence**: _(To be collected)_

### CASE 2: Update updates wrong workspaceId
**Evidence**: _(To be collected)_

### CASE 3: Dropdown duplicates due to DB duplicate rows
**Evidence**: _(To be collected)_

### CASE 4: Dropdown duplicates due to frontend mapping
**Evidence**: _(To be collected)_

## Console Logs Output
_(To be pasted after running with audit logs)_

## Supabase Query Outputs
_(To be pasted after running queries)_

## Backend Log Snippet
_(To be pasted after testing update)_

