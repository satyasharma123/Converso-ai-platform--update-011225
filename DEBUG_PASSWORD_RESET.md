# Debug Password Reset 500 Error

## 🔍 Current Status

✅ Redirect URLs configured: `http://localhost:8080/**`, `http://localhost:8080/`, `http://localhost:8080/*`  
✅ Site URL configured: `http://localhost:8080/`  
✅ SMTP configured: Gmail (smtp.gmail.com:465)  
❌ Still getting 500 error

## 🎯 Next Steps to Debug

### Step 1: Check Supabase Logs for Exact Error

1. **Go to Supabase Dashboard:**
   - https://supabase.com/dashboard
   - Select your project

2. **Navigate to Logs:**
   - Click **Logs** in left sidebar
   - Click **API Logs**

3. **Filter for Password Reset:**
   - Look for requests to `/auth/v1/recover`
   - Check the error message
   - Look for SMTP-related errors

4. **Common Errors to Look For:**
   - `SMTP authentication failed` - Wrong password
   - `Invalid email` - Email doesn't exist
   - `Rate limit exceeded` - Too many requests
   - `Connection timeout` - SMTP server unreachable

### Step 2: Verify Email Exists in Supabase Auth

The email you're testing with MUST exist in Supabase Auth:

1. **Go to:** Authentication → Users
2. **Check if email exists:**
   - If not, create a test user via `/signup` first
   - Or manually create in Supabase Dashboard

3. **Test with existing user:**
   - Use an email that you know exists
   - Try with the email you used to sign up

### Step 3: Test SMTP Connection Directly

1. **Go to:** Authentication → Email Templates
2. **Click "Send test email"** (if available)
3. **Or manually test:**
   - Try sending a confirmation email to a test user
   - If this fails, SMTP is the issue

### Step 4: Verify Gmail App Password

The password in SMTP settings MUST be a Gmail App Password:

1. **Check if you're using App Password:**
   - Go to: https://myaccount.google.com/apppasswords
   - See if you have one generated for "Converso" or "Mail"
   - If not, generate one

2. **Verify in Supabase:**
   - Go to: Authentication → Providers → Email → SMTP Settings
   - The password should be 16 characters (no spaces)
   - It should NOT be your regular Gmail password

3. **Common Mistake:**
   - Using regular Gmail password instead of App Password
   - App Password is required for SMTP

### Step 5: Try Different Redirect URL Format

The redirect URL in code is: `${window.location.origin}/`

Let's try a more explicit format:

```typescript
// In useAuth.tsx, try:
redirectTo: `${window.location.origin}/reset-password`
```

But first, add this URL to Supabase redirect URLs:
- `http://localhost:8080/reset-password`

### Step 6: Test with Supabase Default Email (Temporarily)

To isolate if it's an SMTP issue:

1. **Disable Custom SMTP:**
   - Go to: Authentication → Providers → Email
   - Turn OFF "Enable custom SMTP"
   - Save

2. **Test Password Reset:**
   - If it works, SMTP is the issue
   - If it still fails, it's a different problem

3. **Re-enable Custom SMTP** after testing

### Step 7: Check Browser Console for Detailed Error

1. **Open Browser DevTools:**
   - F12 or Right-click → Inspect
   - Go to **Console** tab

2. **Try Password Reset:**
   - Enter email
   - Click "Send Reset Link"

3. **Check Error Details:**
   - Look for the full error response
   - Check Network tab → Find `/auth/v1/recover` request
   - Click on it → Check "Response" tab
   - Look for detailed error message

### Step 8: Test with Backend Route

I've created a test route. Try this:

```bash
# Make sure backend is running
cd Converso-backend
npm run dev

# In another terminal, test:
curl -X POST http://localhost:3001/api/password-reset/test \
  -H "Content-Type: application/json" \
  -d '{"email": "your@email.com"}'
```

This will show you the exact error from Supabase.

## 🔧 Quick Fixes to Try

### Fix 1: Update Redirect URL in Code

Try using a more specific redirect:

```typescript
// In useAuth.tsx
const resetPassword = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  return { error };
};
```

Then add `http://localhost:8080/reset-password` to Supabase redirect URLs.

### Fix 2: Verify Gmail App Password Format

The App Password should be exactly 16 characters, no spaces, like:
```
abcd efgh ijkl mnop
```
Should be entered as:
```
abcdefghijklmnop
```
(No spaces)

### Fix 3: Check Gmail Account Security

1. **Check Gmail Security:**
   - Go to: https://myaccount.google.com/security
   - Make sure "Less secure app access" is NOT the issue
   - 2FA must be enabled for App Passwords

2. **Check for Security Alerts:**
   - Gmail might have sent a security alert
   - Check your Gmail inbox for "New sign-in" alerts
   - Approve if needed

## 📋 Diagnostic Checklist

Run through this checklist:

- [ ] Email exists in Supabase Auth users
- [ ] Gmail App Password is 16 characters (no spaces)
- [ ] 2FA is enabled on Gmail account
- [ ] SMTP test email works in Supabase
- [ ] Checked Supabase API logs for specific error
- [ ] Tried with Supabase default email (disabled custom SMTP)
- [ ] Checked browser console for detailed error
- [ ] Verified redirect URLs match exactly
- [ ] No Gmail security blocks

## 🚨 Most Likely Issues

Based on your setup, the most likely causes are:

1. **Gmail App Password Issue (80% likely)**
   - Wrong password format
   - Not using App Password (using regular password)
   - App Password expired or revoked

2. **Email Doesn't Exist (15% likely)**
   - Testing with email that's not in Supabase Auth
   - User was deleted

3. **SMTP Connection Issue (5% likely)**
   - Gmail blocking connection
   - Firewall/network issue

## 💡 Next Action

**Please check Supabase Logs** and share the exact error message. That will tell us exactly what's wrong.

Go to: Supabase Dashboard → Logs → API Logs → Filter for `/auth/v1/recover`

The error message there will be the key to fixing this!

