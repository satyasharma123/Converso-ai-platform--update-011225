# Troubleshoot Password Reset 500 Error

## 🔧 Quick Fixes

### Step 1: Clear Browser Cache & Restart Dev Server

The code has been updated, but your browser might be using cached code:

1. **Hard Refresh Browser:**
   - **Chrome/Edge:** `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - **Firefox:** `Ctrl+F5` (Windows) or `Cmd+Shift+R` (Mac)

2. **Or Restart Dev Server:**
   ```bash
   # Stop the current server (Ctrl+C)
   # Then restart:
   cd Converso-frontend
   npm run dev
   ```

### Step 2: Configure Supabase Redirect URLs

The 500 error is likely because redirect URLs aren't configured:

1. **Go to Supabase Dashboard:**
   - https://supabase.com/dashboard
   - Select your project

2. **Navigate to URL Configuration:**
   - **Authentication** → **URL Configuration**
   - Or: **Settings** → **Auth** → **URL Configuration**

3. **Configure URLs:**
   - **Site URL:** `http://localhost:8080`
   - **Redirect URLs:** Click "Add URL" and add:
     - `http://localhost:8080/**`
     - `http://localhost:8080/`
     - `http://localhost:8080/*`

4. **Save Changes**

### Step 3: Verify SMTP Configuration

Check your SMTP settings in Supabase:

1. **Go to:** Authentication → Providers → Email
2. **Verify:**
   - ✅ Custom SMTP is enabled
   - ✅ Host: `smtp.gmail.com`
   - ✅ Port: `465`
   - ✅ Username: Your full Gmail address (e.g., `info@leadnex.co`)
   - ✅ Password: **Gmail App Password** (NOT your regular Gmail password)
   - ✅ Sender email: `info@leadnex.co`
   - ✅ Sender name: `Converso AI`

### Step 4: Get Gmail App Password

If you're using Gmail SMTP, you need an App Password:

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Go to:** https://myaccount.google.com/apppasswords
3. **Generate App Password:**
   - Select "Mail" and "Other (Custom name)"
   - Enter "Converso" as the name
   - Click "Generate"
   - Copy the 16-character password
4. **Use this password** in Supabase SMTP settings (NOT your regular Gmail password)

### Step 5: Test with Valid Email

Make sure the email you're testing with:
- ✅ Exists in your Supabase Auth users
- ✅ Is a valid email address
- ✅ Can receive emails

---

## 🔍 Common Error Causes

### Error: 500 Internal Server Error

**Possible Causes:**
1. **SMTP Authentication Failed**
   - Wrong password (using regular password instead of App Password)
   - Wrong username (not full email address)
   - 2FA not enabled on Gmail

2. **Redirect URL Not Configured**
   - URL not added to Supabase redirect URLs list
   - URL mismatch

3. **SMTP Server Issues**
   - Gmail blocking the connection
   - Port 465 blocked by firewall
   - Rate limiting

### Error: 404 on app_settings

**This is now fixed** - the code handles missing table gracefully. If you still see errors:
- Hard refresh browser (Ctrl+Shift+R)
- Restart dev server

---

## ✅ Verification Checklist

After fixing:

- [ ] Browser cache cleared (hard refresh)
- [ ] Dev server restarted
- [ ] Redirect URLs configured in Supabase
- [ ] SMTP settings verified
- [ ] Gmail App Password used (not regular password)
- [ ] Email exists in Supabase Auth
- [ ] Test password reset again

---

## 🧪 Test Steps

1. **Clear browser cache** (Ctrl+Shift+R)
2. **Go to** `/forgot-password`
3. **Enter email** that exists in your system
4. **Click "Send Reset Link"**
5. **Check console** - should see no errors
6. **Check email inbox** - should receive reset email

---

## 🚨 If Still Not Working

### Check Supabase Logs:

1. **Go to:** Supabase Dashboard → Logs → API Logs
2. **Look for errors** related to password reset
3. **Check for SMTP errors**

### Alternative: Test SMTP Directly

1. **Go to:** Supabase Dashboard → Authentication → Email Templates
2. **Send test email** to verify SMTP is working
3. **If test email fails**, SMTP configuration is the issue

### Switch to Transactional Email Service

If Gmail continues to cause issues, consider:
- **SendGrid** (free tier: 100 emails/day)
- **Mailgun** (free tier: 5,000 emails/month)

These are more reliable for transactional emails.

---

## 📝 Code Changes Made

✅ **Fixed app_settings error handling** - Now silently handles missing table  
✅ **Improved password reset error messages** - More helpful error messages  
✅ **Updated redirect URL** - Changed to root URL (`/`)  

**Next:** Clear cache and configure Supabase redirect URLs!

