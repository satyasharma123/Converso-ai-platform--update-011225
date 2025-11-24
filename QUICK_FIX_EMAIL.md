# Quick Fix: Email Verification Issue

## 🎯 Immediate Solution (2 Minutes)

### Disable Email Confirmation in Supabase

1. **Go to Supabase Dashboard:**
   - https://supabase.com/dashboard
   - Select your project

2. **Navigate to Email Settings:**
   - Click **Authentication** in left sidebar
   - Click **Settings** (or **Providers**)
   - Find **Email** section

3. **Disable Email Confirmation:**
   - Look for **"Enable email confirmations"** or **"Confirm email"**
   - **Turn it OFF** (toggle to disabled)
   - Click **Save**

4. **Test Signup:**
   - Go to `/signup` in your app
   - Create a new account
   - You should be able to login immediately!

---

## ✅ What This Does

- Users can sign up without email verification
- Accounts are immediately active
- Perfect for development and testing
- Can be re-enabled later for production

---

## 🔄 Re-enable for Production

When ready for production:
1. Go back to same settings
2. Turn email confirmation **ON**
3. Configure SMTP (see EMAIL_SETUP_GUIDE.md)

---

## 📧 Alternative: Configure SMTP Now

If you want real emails now, see `EMAIL_SETUP_GUIDE.md` for SMTP configuration.

**Recommendation:** Disable for now, configure SMTP later when ready for production.

