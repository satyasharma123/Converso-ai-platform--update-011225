# Troubleshooting: Pipeline Stages Not Showing in Email Inbox

## Issue
The "Change Stage" dropdown in Email Inbox shows "No stages available" instead of listing pipeline stages.

## Root Causes & Solutions

### 1. Migration Not Run (Most Common)
**Problem**: The database doesn't have any pipeline stages yet.

**Solution**: Run the migration to seed 7 default stages:

1. Go to Supabase Dashboard → SQL Editor
2. Open the migration file: `Converso-frontend/supabase/migrations/20251201000003_seed_default_pipeline_stages.sql`
3. Copy the entire contents
4. Paste into SQL Editor
5. Click "Run"
6. Verify the output shows 7 rows inserted

### 2. PostgREST Schema Cache
**Problem**: PostgREST hasn't reloaded its schema after migration.

**Solution**: Run this command in Supabase SQL Editor:
```sql
SELECT pg_notify('pgrst', 'reload schema');
```

### 3. Backend API Not Running
**Problem**: The Express backend isn't running or not accessible.

**Solution**: 
1. Check if backend is running on port 3001:
   ```bash
   curl http://localhost:3001/health
   ```
2. If not running, start it:
   ```bash
   cd Converso-backend
   npm run dev
   ```

### 4. API Route Not Registered
**Problem**: The pipeline stages route isn't properly registered.

**Solution**: Verify in `Converso-backend/src/routes/index.ts`:
```typescript
router.use('/pipeline-stages', pipelineStagesRoutes);
```

### 5. Check Browser Console
**Problem**: There might be API errors not visible in UI.

**Solution**:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for errors like:
   - `[usePipelineStages] Error fetching stages`
   - `[ConversationList] Error loading stages`
4. Check Network tab for failed requests to `/api/pipeline-stages`

## Quick Verification Steps

### Step 1: Check Database
Run in Supabase SQL Editor:
```sql
SELECT COUNT(*) FROM pipeline_stages;
-- Should return 7 or more
```

### Step 2: Check Backend API
Test the endpoint:
```bash
curl http://localhost:3001/api/pipeline-stages
```
Should return JSON array of stages.

### Step 3: Check Frontend
1. Open browser DevTools Console
2. Type: `localStorage.getItem('sb-wahvinwuyefmkmgmjspo-auth-token')`
3. Verify you're logged in
4. Check for console errors

### Step 4: Verify Hook is Working
In browser console, check React Query DevTools or network requests:
- Look for request to `/api/pipeline-stages`
- Check response status and data

## Code Changes Made

1. ✅ Added error logging to `usePipelineStages` hook
2. ✅ Added debugging console logs to `ConversationList`
3. ✅ Improved error messages in dropdown
4. ✅ Added loading state handling

## Expected Behavior After Fix

1. Stages should appear in:
   - Email Inbox → 3-dot menu → Change Stage
   - Email View → Stage dropdown
   - Lead Profile Panel → Stage selector
   - Sales Pipeline → Kanban columns
   - Bulk Actions → Change Stage

2. Default 7 stages should be:
   - Lead
   - Contacted
   - Qualified
   - Proposal Sent
   - Negotiation
   - Won
   - Lost

## Still Not Working?

1. **Check backend logs** for errors
2. **Verify RLS policies** allow reading pipeline_stages
3. **Check Supabase connection** - ensure backend can connect
4. **Clear browser cache** and refresh
5. **Restart both frontend and backend** servers

