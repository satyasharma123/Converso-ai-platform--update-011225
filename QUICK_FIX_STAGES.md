# Quick Fix: Stages Not Showing After SQL Migration

## Issue
SQL migration ran successfully, but stages still don't appear in Email Inbox dropdown.

## Solution (Follow in Order)

### 1. Reload PostgREST Schema Cache ⚠️ REQUIRED
In Supabase SQL Editor, run:
```sql
SELECT pg_notify('pgrst', 'reload schema');
```

### 2. Verify Stages Exist
Check that stages were created:
```sql
SELECT id, name, display_order 
FROM pipeline_stages 
ORDER BY display_order;
```
Should show 7 rows.

### 3. Restart Backend Server ⚠️ REQUIRED
The backend needs to reconnect to see the new data:

```bash
cd Converso-backend
# Press Ctrl+C to stop
npm run dev
```

### 4. Hard Refresh Browser
- Windows/Linux: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

### 5. Check Browser Console
Open DevTools (F12) → Console tab

Look for:
- ✅ `[usePipelineStages] Fetched stages: [Array(7)]` - Success!
- ❌ Any error messages

### 6. Test API Endpoint
In browser console, test directly:
```javascript
fetch('http://localhost:3001/api/pipeline-stages')
  .then(r => r.json())
  .then(d => console.log('API Response:', d))
  .catch(e => console.error('Error:', e));
```

Expected response:
```json
{
  "data": [
    { "id": "...", "name": "Lead", ... },
    ...
  ]
}
```

## What I Fixed in Code

1. ✅ Updated backend to use `supabaseAdmin` for reading stages (bypasses RLS)
2. ✅ Added error logging to backend API
3. ✅ Added debugging console logs in frontend hook
4. ✅ Improved error messages in dropdown

## If Still Not Working

1. **Check backend logs** for errors
2. **Verify SUPABASE_SERVICE_ROLE_KEY** is set in backend `.env`
3. **Check network tab** in DevTools for failed API requests
4. **Ensure backend is on port 3001** and accessible

## Expected Result

After following these steps:
- ✅ Stages appear in Email Inbox → 3-dot menu → Change Stage
- ✅ Stages appear in Settings → Pipeline Stages
- ✅ 7 default stages visible everywhere

