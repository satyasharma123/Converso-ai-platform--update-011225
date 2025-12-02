# Fix: Stages Not Showing After SQL Migration

## Quick Fix Steps

Since the SQL migration ran successfully, follow these steps in order:

### Step 1: Reload PostgREST Schema Cache
Run this in Supabase SQL Editor:
```sql
SELECT pg_notify('pgrst', 'reload schema');
```

### Step 2: Verify Stages Exist
Run this to confirm stages were created:
```sql
SELECT id, name, display_order FROM pipeline_stages ORDER BY display_order;
```
You should see 7 rows.

### Step 3: Restart Backend Server
The backend needs to reconnect to get fresh data:
```bash
cd Converso-backend
# Stop the current process (Ctrl+C)
npm run dev
```

### Step 4: Clear Frontend Cache
1. Open browser DevTools (F12)
2. Go to Application tab → Clear Storage
3. Or hard refresh: Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac)

### Step 5: Check Browser Console
Open DevTools Console and look for:
- `[usePipelineStages] Fetched stages: [array]` - Should show 7 stages
- Any error messages

### Step 6: Test API Directly
Open browser console and run:
```javascript
fetch('http://localhost:3001/api/pipeline-stages')
  .then(r => r.json())
  .then(d => console.log('Stages:', d))
  .catch(e => console.error('Error:', e));
```

This should show the stages array.



