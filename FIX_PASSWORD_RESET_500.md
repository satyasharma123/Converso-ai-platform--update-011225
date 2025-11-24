# Fix Password Reset 500 Error - Complete Guide

## 🔍 Error Analysis

The 500 error when sending password reset emails is typically caused by:

1. **SMTP Configuration Issues** (Most Common)
   - Wrong Gmail App Password
   - SMTP credentials incorrect
   - Gmail blocking the connection

2. **Redirect URL Not Configured**
   - URL not added to Supabase allowed redirects
   - URL mismatch

3. **Supabase Email Service Issues**
   - Email service not properly configured
   - Rate limiting

## ✅ Step-by-Step Fix

### Step 1: Verify Supabase Redirect URLs

**Critical:** This is the most common cause of 500 errors.

1. **Go to Supabase Dashboard:**
   - https://supabase.com/dashboard
   - Select your project: `wahvinwuyefmkmgmjspo`

2. **Navigate to URL Configuration:**
   - **Authentication** → **URL Configuration**
   - Or: **Settings** → **Auth** → **URL Configuration**

3. **Configure URLs:**
   - **Site URL:** `http://localhost:8080`
   - **Redirect URLs:** Click "Add URL" and add ALL of these:
     ```
     http://localhost:8080
     http://localhost:8080/**
     http://localhost:8080/*
     http://localhost:8080/#
     ```

4. **Save Changes** (Important!)

### Step 2: Verify SMTP Configuration

1. **Go to:** Authentication → Providers → Email

2. **Check SMTP Settings:**
   - ✅ Custom SMTP enabled
   - ✅ Host: `smtp.gmail.com`
   - ✅ Port: `465` (or `587` for TLS)
   - ✅ Username: **Full Gmail address** (e.g., `info@leadnex.co`)
   - ✅ Password: **Gmail App Password** (NOT regular password)
   - ✅ Sender email: `info@leadnex.co`
   - ✅ Sender name: `Converso AI`

### Step 3: Get/Verify Gmail App Password

If using Gmail SMTP, you MUST use an App Password:

1. **Enable 2-Factor Authentication:**
   - Go to: https://myaccount.google.com/security
   - Enable 2-Step Verification

2. **Generate App Password:**
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Enter "Converso" as name
   - Click "Generate"
   - **Copy the 16-character password** (no spaces)

3. **Update in Supabase:**
   - Go to SMTP settings
   - Paste the App Password in the "Password" field
   - Save

### Step 4: Test SMTP Connection

1. **In Supabase Dashboard:**
   - Go to: **Authentication** → **Email Templates**
   - Try sending a test email
   - If test email fails, SMTP is the issue

2. **Check Supabase Logs:**
   - Go to: **Logs** → **API Logs**
   - Look for SMTP errors
   - Check for authentication failures

### Step 5: Alternative - Use Supabase Default Email

If Gmail SMTP continues to fail:

1. **Disable Custom SMTP:**
   - Go to: Authentication → Providers → Email
   - Turn OFF "Enable custom SMTP"
   - Save

2. **Test Password Reset:**
   - This uses Supabase's default email service
   - Limited to 3 emails/hour (free tier)
   - But more reliable for testing

### Step 6: Test Password Reset Again

1. **Hard Refresh Browser:**
   - `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

2. **Go to:** `/forgot-password`

3. **Enter Email:**
   - Use an email that exists in your Supabase Auth users
   - Or create a test user first via `/signup`

4. **Check Results:**
   - ✅ Success: Email sent message
   - ❌ Still 500: Check Supabase logs

## 🔧 Debugging Tools

### Check Browser Console

Look for specific error messages:
- `500 Internal Server Error` - Server-side issue
- `Invalid redirect URL` - Redirect URL not configured
- `SMTP authentication failed` - Wrong credentials

### Check Supabase Logs

1. **Go to:** Supabase Dashboard → Logs → API Logs
2. **Filter by:** `/auth/v1/recover`
3. **Look for:**
   - SMTP errors
   - Authentication failures
   - Rate limiting

### Test with Backend Route

I've created a test route you can use:

```bash
# Test password reset from backend
curl -X POST http://localhost:3001/api/password-reset/test \
  -H "Content-Type: application/json" \
  -d '{"email": "your@email.com"}'
```

## 🚨 Common Issues & Solutions

### Issue 1: "Invalid redirect URL"
**Solution:** Add redirect URLs in Supabase (Step 1)

### Issue 2: "SMTP authentication failed"
**Solution:** 
- Use Gmail App Password (not regular password)
- Verify 2FA is enabled
- Check username is full email address

### Issue 3: "Rate limit exceeded"
**Solution:**
- Wait a few minutes
- Gmail has rate limits (500 emails/day for free)
- Consider using SendGrid/Mailgun for production

### Issue 4: "Email not received"
**Solution:**
- Check spam folder
- Verify email exists in Supabase Auth
- Check Supabase logs for delivery status

## 📝 Quick Checklist

- [ ] Redirect URLs configured in Supabase
- [ ] SMTP settings verified
- [ ] Gmail App Password used (not regular password)
- [ ] 2FA enabled on Gmail account
- [ ] Test email sent successfully from Supabase
- [ ] Browser cache cleared (hard refresh)
- [ ] Email exists in Supabase Auth users
- [ ] Checked Supabase logs for errors

## 🎯 Expected Behavior After Fix

1. **User enters email** → No console errors
2. **Clicks "Send Reset Link"** → Success message appears
3. **Email received** → Check inbox (and spam)
4. **Click reset link** → Redirected to password reset page
5. **Set new password** → Can login with new password

## 💡 Production Recommendations

For production, consider:

1. **Use Transactional Email Service:**
   - SendGrid (100 emails/day free)
   - Mailgun (5,000 emails/month free)
   - Better deliverability than Gmail

2. **Custom Domain:**
   - Use your own domain for emails
   - Better sender reputation
   - More professional

3. **Monitor Email Delivery:**
   - Track bounce rates
   - Monitor spam complaints
   - Set up email analytics

---

## ✅ After Following These Steps

The password reset should work! If you still get a 500 error:

1. Check Supabase logs for specific error
2. Verify SMTP test email works
3. Try using Supabase default email (disable custom SMTP)
4. Contact Supabase support if issue persists

The most common fix is **Step 1: Configure Redirect URLs** - make sure you've done this!

