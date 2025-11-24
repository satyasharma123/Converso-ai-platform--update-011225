# Development Authentication Setup

## 🎯 Problem
Signup sends verification email, but emails aren't being received during development.

## ✅ Solution: Disable Email Confirmation (Recommended for Development)

### Step 1: Disable Email Confirmation in Supabase

1. Go to **Supabase Dashboard**: https://supabase.com/dashboard
2. Select your project
3. Navigate to: **Authentication** → **Settings** → **Providers** → **Email**
4. Find **"Confirm email"** or **"Enable email confirmations"**
5. **Turn it OFF** (disable)
6. Click **Save**

**Result:** Users can sign up and immediately use the app without email verification.

### Step 2: (Optional) Enable Auto-Confirm in Frontend

Add to `.env` file in `Converso-frontend/`:

```env
VITE_AUTO_CONFIRM_EMAIL=true
```

This tells the frontend to auto-sign-in users after signup.

---

## 🔧 Alternative: Use Supabase Development Email

If you want to see emails during development:

1. Go to Supabase Dashboard → **Authentication** → **Settings**
2. Look for **"Development Mode"** or **"Email Logs"**
3. Enable development email logging
4. Check **Authentication** → **Logs** to see email content

**Note:** Emails won't actually be sent, but you can see the content in the dashboard.

---

## 📧 Production Setup: Configure SMTP

When ready for production, configure real email:

### Option A: SendGrid (Easiest)

1. Sign up at https://sendgrid.com (free tier: 100 emails/day)
2. Create API key
3. In Supabase Dashboard → **Authentication** → **Settings** → **SMTP Settings**:
   - **Host:** `smtp.sendgrid.net`
   - **Port:** `587`
   - **Username:** `apikey`
   - **Password:** Your SendGrid API key
   - **Sender email:** Your verified sender email
   - **Sender name:** Converso AI

### Option B: Gmail SMTP (Free, Limited)

1. Enable 2-factor authentication on Gmail
2. Generate App Password: https://myaccount.google.com/apppasswords
3. In Supabase SMTP Settings:
   - **Host:** `smtp.gmail.com`
   - **Port:** `587`
   - **Username:** Your Gmail address
   - **Password:** Your App Password
   - **Sender email:** Your Gmail address

### Option C: AWS SES (Cheapest for Scale)

1. Set up AWS SES
2. Verify domain/email
3. Get SMTP credentials
4. Configure in Supabase

---

## 🧪 Testing Without Email

### Method 1: Disable Confirmation (Easiest)
- Turn off email confirmation in Supabase
- Users can sign up and use immediately
- **Best for development**

### Method 2: Manual User Creation
- Create users directly in Supabase Dashboard
- Go to **Authentication** → **Users** → **Add User**
- Set password and email
- User can login immediately

### Method 3: Test with Existing Users
- Use the users you already created
- They should work without email verification if confirmation is disabled

---

## 🚀 Recommended Development Workflow

1. **Disable email confirmation** in Supabase (one-time setup)
2. **Test signup/login** - should work immediately
3. **Develop features** without email delays
4. **Before production:** Enable email confirmation and configure SMTP

---

## ✅ Quick Checklist

- [ ] Disable email confirmation in Supabase Dashboard
- [ ] Test signup - should work immediately
- [ ] Test login - should work immediately
- [ ] (Optional) Add `VITE_AUTO_CONFIRM_EMAIL=true` to `.env`
- [ ] (For production) Configure SMTP provider

---

## 📝 Current Status

After disabling email confirmation:
- ✅ Signup works immediately
- ✅ Users can login right away
- ✅ No email delays during development
- ✅ Can enable email verification later for production

**Recommendation:** Disable email confirmation now for development, configure SMTP later for production.

