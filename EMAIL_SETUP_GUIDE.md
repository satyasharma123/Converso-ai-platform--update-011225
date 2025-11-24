# Email Setup Guide - Development vs Production

## 🎯 Recommended Approach: Disable Email Confirmation for Development

For **testing and development**, the easiest solution is to **disable email confirmation** in Supabase. This allows immediate signup without waiting for emails.

### Option 1: Disable Email Confirmation (Recommended for Development)

1. Go to Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **Authentication** → **Settings** → **Email Auth**
4. Find **"Enable email confirmations"**
5. **Turn it OFF** (disable)
6. Save changes

**Result:** Users can sign up and immediately log in without email verification.

### Option 2: Use Development Email (Supabase Built-in)

Supabase provides a development email service that doesn't require SMTP setup:

1. Go to Supabase Dashboard → **Authentication** → **Settings** → **Email Templates**
2. Check **"Use Supabase development email"** (if available)
3. Emails will be logged in the dashboard instead of being sent

**Note:** This is only for development. Check the Supabase logs for email content.

### Option 3: Configure SMTP (For Production)

If you want real emails, configure SMTP:

1. Go to Supabase Dashboard → **Authentication** → **Settings** → **SMTP Settings**
2. Configure your SMTP provider (Gmail, SendGrid, AWS SES, etc.)
3. Test email sending

**Popular SMTP Providers:**
- **SendGrid** (Free tier: 100 emails/day)
- **Mailgun** (Free tier: 5,000 emails/month)
- **AWS SES** (Very cheap, $0.10 per 1,000 emails)
- **Gmail SMTP** (Free, but limited)

---

## 🚀 Quick Fix: Update Signup to Auto-Confirm

I'll update the signup function to auto-confirm users in development mode, so you can test immediately without email setup.

