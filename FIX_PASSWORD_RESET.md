# Fix Password Reset 500 Error

## 🔧 Issue
Password reset is returning 500 error. This is likely due to:
1. Redirect URL not configured in Supabase
2. SMTP configuration issue
3. Redirect URL mismatch

## ✅ Solution

### Step 1: Configure Redirect URL in Supabase

1. **Go to Supabase Dashboard:**
   - https://supabase.com/dashboard
   - Select your project

2. **Navigate to URL Configuration:**
   - Click **Authentication** (left sidebar)
   - Click **URL Configuration** (or **Settings** → **Auth** → **URL Configuration**)

3. **Add Redirect URLs:**
   - **Site URL:** `http://localhost:8080` (for development)
   - **Redirect URLs:** Add these:
     - `http://localhost:8080/**`
     - `http://localhost:8080/`
     - (For production, add your production URL)

4. **Save Changes**

### Step 2: Verify SMTP Configuration

Make sure SMTP is properly configured:
- ✅ Custom SMTP enabled
- ✅ Host: smtp.gmail.com
- ✅ Port: 465
- ✅ Username: Your Gmail address
- ✅ Password: Gmail App Password (not regular password)
- ✅ Sender email: info@leadnex.co
- ✅ Sender name: Converso AI

### Step 3: Test Again

1. Go to `/forgot-password`
2. Enter your email
3. Check for errors in console
4. Check email inbox

## 🔍 Common Issues

### Issue 1: Redirect URL Not Allowed
**Error:** "Invalid redirect URL"

**Fix:** Add the redirect URL to Supabase URL Configuration (see Step 1)

### Issue 2: SMTP Authentication Failed
**Error:** 500 Internal Server Error

**Fix:** 
- Make sure you're using Gmail App Password (not regular password)
- Enable 2FA on Gmail account
- Verify SMTP credentials in Supabase

### Issue 3: Email Not Sending
**Error:** No error, but email not received

**Fix:**
- Check spam folder
- Verify SMTP settings
- Check Gmail account for security alerts
- Try a different email address

## 📝 Code Changes Made

1. **Updated redirect URL** in `useAuth.tsx`:
   - Changed from `/reset-password` to `/` (root)
   - Supabase will handle the password reset flow

2. **Fixed app_settings error handling**:
   - Now gracefully handles missing table
   - Returns default logo paths if table doesn't exist

## 🧪 Testing

After fixing:

1. **Test Password Reset:**
   - Go to `/forgot-password`
   - Enter email
   - Should see success message
   - Check email for reset link

2. **Check Console:**
   - No 404 errors for app_settings
   - No 500 errors for password reset

## ✅ Expected Behavior

- ✅ No console errors
- ✅ Password reset email sent successfully
- ✅ Email received in inbox
- ✅ Reset link works when clicked

