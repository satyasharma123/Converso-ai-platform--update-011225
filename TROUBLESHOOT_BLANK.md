# Troubleshooting Blank Page

## Quick Checks

### 1. Open Browser Console (F12)
Check for errors:
- **Console tab:** Look for red error messages
- **Network tab:** Check if API calls are being made
- **Elements tab:** See if HTML is rendering

### 2. Verify Servers Are Running
```bash
# Check backend
curl http://localhost:3001/health

# Check frontend  
curl http://localhost:8080
```

### 3. Check Authentication
In browser console, run:
```javascript
localStorage.getItem('mock-auth-session')
```

Should return a JSON object with user data.

### 4. Test API Directly
```bash
# Replace with your actual user ID
curl "http://localhost:3001/api/conversations?userId=admin-user-123&userRole=admin"
```

## Common Fixes

### Fix 1: Clear Cache and Reload
1. Press `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
2. Or open DevTools → Network → Check "Disable cache"

### Fix 2: Check for JavaScript Errors
1. Open Console (F12)
2. Look for red errors
3. Share the error message

### Fix 3: Verify User is Logged In
1. Go to `/login`
2. Login with: `admin@converso.ai` / `admin123`
3. Then navigate to inbox pages

### Fix 4: Seed Database
The database is empty. Run `QUICK_SEED.sql` in Supabase SQL Editor.

## What Should Happen

**Before seeding:**
- Page should show: "No conversations found - The database is empty"

**After seeding:**
- Page should show conversation list

**If still blank:**
- There's likely a JavaScript error
- Check browser console
- Check Network tab for failed requests

## Get Help

If still blank, please share:
1. Browser console errors (F12 → Console)
2. Network tab errors (F12 → Network)
3. Any error messages you see

