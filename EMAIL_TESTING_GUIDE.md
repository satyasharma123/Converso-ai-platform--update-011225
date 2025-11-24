# Email Testing Guide

## ✅ Current Configuration

- **SMTP Provider:** Gmail (smtp.gmail.com)
- **Port:** 465
- **Sender Email:** info@leadnex.co
- **Sender Name:** Converso AI
- **Email Confirmations:** Enabled ✅

---

## 🧪 Test Your Email Flow

### 1. Test Signup Flow

1. **Go to Signup Page:**
   - Navigate to `/signup` in your app
   - Fill in the form:
     - Full Name: Test User
     - Email: Use a real email you can access
     - Password: (your password)
     - Confirm Password: (same password)

2. **Submit Form:**
   - Click "Sign Up"
   - You should see: "Account created! Please check your email to verify your account."

3. **Check Email:**
   - Open your email inbox (check spam folder too)
   - Look for email from "Converso AI" (info@leadnex.co)
   - Subject: "Confirm your signup"
   - Click the verification link

4. **Verify:**
   - You should be redirected to your app
   - Automatically logged in
   - Redirected to `/settings` or dashboard

### 2. Test Password Reset Flow

1. **Go to Forgot Password:**
   - Navigate to `/forgot-password`
   - Enter your email address
   - Click "Send Reset Link"

2. **Check Email:**
   - Look for password reset email
   - Click the reset link
   - Set a new password

3. **Test Login:**
   - Go to `/login`
   - Login with new password
   - Should work successfully

### 3. Test Google OAuth

1. **Go to Login or Signup:**
   - Click "Continue with Google"
   - Complete Google OAuth flow
   - Should redirect back to your app
   - Automatically logged in

---

## ⚠️ Gmail SMTP Warning

**Note:** Supabase is warning that Gmail SMTP is designed for personal emails, not transactional emails.

### Current Setup (Gmail):
- ✅ Works for development and testing
- ✅ Free and easy to set up
- ⚠️ May have deliverability issues
- ⚠️ Rate limits (500 emails/day for free Gmail)
- ⚠️ Not ideal for production at scale

### For Production (Recommended):

Consider switching to a transactional email service:

1. **SendGrid** (Recommended)
   - Free tier: 100 emails/day
   - Paid: $19.95/month for 50,000 emails
   - Better deliverability
   - Analytics and tracking

2. **Mailgun**
   - Free tier: 5,000 emails/month
   - Paid: $35/month for 50,000 emails
   - Great for transactional emails

3. **AWS SES**
   - Very cheap: $0.10 per 1,000 emails
   - Scales well
   - Requires AWS setup

---

## 🔧 Gmail SMTP Setup (If Not Working)

If emails aren't sending, make sure:

1. **Gmail App Password:**
   - Go to: https://myaccount.google.com/apppasswords
   - Generate an app password (not your regular password)
   - Use this in the "Password" field in Supabase

2. **2-Factor Authentication:**
   - Must be enabled on Gmail account
   - Required for app passwords

3. **Username:**
   - Should be your full Gmail address (e.g., info@leadnex.co)
   - Not just the username part

---

## 📧 Email Templates (Optional)

You can customize email templates in Supabase:

1. **Go to:** Authentication → Email Templates
2. **Customize:**
   - Confirmation email
   - Password reset email
   - Magic link email
   - Email change email

**Tips:**
- Add your logo/branding
- Customize colors to match your brand
- Add helpful instructions
- Include support contact info

---

## ✅ Testing Checklist

- [ ] Signup sends verification email
- [ ] Verification link works
- [ ] User is logged in after verification
- [ ] Password reset sends email
- [ ] Password reset link works
- [ ] New password login works
- [ ] Google OAuth works
- [ ] Email sender name shows "Converso AI"
- [ ] Emails arrive in inbox (not spam)

---

## 🚀 Production Recommendations

### For Production:

1. **Switch to Transactional Email Service:**
   - SendGrid or Mailgun recommended
   - Better deliverability
   - Professional reputation
   - Analytics and tracking

2. **Custom Domain:**
   - Use your own domain (leadnex.co)
   - Better sender reputation
   - More professional

3. **Email Templates:**
   - Brand your emails
   - Add your logo
   - Professional design

4. **Monitor Deliverability:**
   - Check spam rates
   - Monitor bounce rates
   - Track open rates (if using SendGrid/Mailgun)

---

## 🎯 Current Status

✅ **SMTP Configured**  
✅ **Email Confirmations Enabled**  
✅ **Ready for Testing**  
⏭️ **Next:** Test signup and password reset flows  

Your authentication system is ready! Test it out and let me know if emails are working properly.

