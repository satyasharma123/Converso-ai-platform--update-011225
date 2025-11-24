# Debugging Blank Page Issue

## Current Status

✅ **Fixed Issues:**
1. Field name transformation (snake_case → camelCase)
2. API client authentication
3. Empty state handling added
4. Loading states added

⚠️ **Remaining Issue:**
- Database is empty (no conversations, no data)
- Pages will show "No conversations found" message instead of blank

## Quick Fix Steps

### 1. Check Browser Console
Open DevTools (F12) and check for errors:
- Network tab: Are API calls being made?
- Console tab: Any JavaScript errors?
- Check if user is logged in

### 2. Verify API is Working
```bash
# Test API directly
curl "http://localhost:3001/api/conversations?userId=admin-user-123&userRole=admin"
```

Should return: `{"data":[]}` (empty but valid)

### 3. Seed the Database
**Option A: SQL Editor (Recommended)**
1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `QUICK_SEED.sql`
3. Paste and run
4. Refresh browser

**Option B: Check if user exists**
```sql
SELECT id, email FROM auth.users;
```

### 4. Check Authentication
Make sure you're logged in:
- Check localStorage for `mock-auth-session`
- User should have `id` and `email`

### 5. Test API with User ID
```bash
# Get your actual user ID from Supabase
# Then test:
curl "http://localhost:3001/api/conversations?userId=YOUR_USER_ID&userRole=admin"
```

## Expected Behavior After Fix

- **Before seeding:** Pages show "No conversations found" message
- **After seeding:** Pages show conversation list
- **Loading:** Shows "Loading conversations..." while fetching

## Common Issues

### Issue: Still seeing blank page
**Solution:** 
1. Check browser console for errors
2. Verify both servers are running (frontend: 8080, backend: 3001)
3. Check Network tab - are API calls failing?

### Issue: "User ID is required" error
**Solution:**
1. Make sure you're logged in
2. Check localStorage has `mock-auth-session`
3. User ID should be in the session

### Issue: API returns 401/403
**Solution:**
1. Check authentication headers are being sent
2. Verify user exists in database
3. Check user role is set correctly

## Next Steps

1. **Seed database** using `QUICK_SEED.sql`
2. **Refresh browser** after seeding
3. **Check console** for any remaining errors
4. **Verify data** appears in the UI

The page should now show a message instead of being completely blank!

