# 🔍 Debug OAuth Connection Error

## What Error Are You Seeing?

Please check the browser console and share:

1. **What exact error message** appears?
   - Is it still the RLS error?
   - Or a different error?

2. **Where does it appear?**
   - In the browser console?
   - As a toast notification?
   - On the page itself?

3. **When does it happen?**
   - When clicking "Connect Gmail"?
   - After OAuth redirect?
   - When the page loads?

---

## Common Issues & Fixes

### Issue 1: RLS Error (Should be fixed)
**Error:** "new row violates row-level security policy"

**Fix:** Make sure you ran the SQL script `FIX_CONNECTED_ACCOUNTS_RLS.sql` successfully.

### Issue 2: User Not Authenticated
**Error:** "User not authenticated"

**Fix:** 
- Make sure you're logged in
- Check if the user ID is being passed correctly

### Issue 3: Redirect Error
**Error:** Redirects to wrong URL or shows "Route not found"

**Fix:** 
- Backend should redirect to `http://localhost:8080/settings`
- Check if frontend is running on port 8080

### Issue 4: OAuth Callback Error
**Error:** "Authorization code not provided" or OAuth error

**Fix:**
- Check Google Cloud Console redirect URI is correct
- Make sure OAuth consent screen is set to "External"
- Add test users in Google Cloud Console

---

## Quick Checklist

- [ ] SQL script ran successfully (RLS policies updated)
- [ ] Backend server is running (`npm run dev` in Converso-backend)
- [ ] Frontend server is running (`npm run dev` in Converso-frontend)
- [ ] You're logged in to the app
- [ ] Google OAuth consent screen is set to "External"
- [ ] Test users added in Google Cloud Console
- [ ] Redirect URI added in Google Cloud Console

---

## Debug Steps

1. **Open Browser Console** (F12 or Cmd+Option+I)
2. **Go to Network tab**
3. **Click "Connect Gmail"**
4. **Check the network requests:**
   - Look for `/api/integrations/gmail/connect`
   - Look for `/api/integrations/gmail/callback`
   - Check the response/error for each

5. **Check Console tab:**
   - Look for any error messages
   - Share the exact error text

---

## Share This Information

Please share:
1. The exact error message from console
2. Any network request errors
3. What happens when you click "Connect Gmail"

This will help me identify the exact issue! 🔍

