# 🔧 Fix: Error 403: org_internal

## ❌ Error
**Error 403: org_internal**

**"Converso can only be used within its organization"**

This happens when your OAuth app is set to **"Internal"** (organization-only) instead of **"External"** (public).

---

## ✅ Solution

### Step 1: Go to OAuth Consent Screen

1. **Open Google Cloud Console:**
   - https://console.cloud.google.com/
   - Select your project: `converso-ai-479211`

2. **Navigate to OAuth Consent Screen:**
   - Go to **APIs & Services** → **OAuth consent screen**
   - (Or direct link: https://console.cloud.google.com/apis/credentials/consent)

### Step 2: Change User Type to External

1. **Check Current Setting:**
   - Look at the top of the page
   - You'll see **"User Type: Internal"** or similar

2. **Change to External:**
   - Click **"EDIT APP"** button (top right)
   - Or if you see a warning, click on it
   - Look for **"User Type"** section
   - Change from **"Internal"** to **"External"**
   - Click **"SAVE AND CONTINUE"**

### Step 3: Complete OAuth Consent Screen Setup

You'll need to fill out the OAuth consent screen form:

1. **App Information:**
   - **App name:** Converso (or your app name)
   - **User support email:** Your email
   - **App logo:** (Optional - can skip)
   - **Application home page:** (Optional - can use your domain or localhost)
   - **Application privacy policy link:** (Optional for testing)
   - **Application terms of service link:** (Optional for testing)
   - **Authorized domains:** (Optional - can skip for testing)
   - **Developer contact information:** Your email

2. **Scopes:**
   - Click **"ADD OR REMOVE SCOPES"**
   - Add these scopes:
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/gmail.modify`
     - `https://www.googleapis.com/auth/userinfo.email`
     - `https://www.googleapis.com/auth/userinfo.profile`
   - Click **"UPDATE"**
   - Click **"SAVE AND CONTINUE"**

3. **Test Users (Important for External Apps):**
   - Since it's External, Google requires you to add test users
   - Click **"ADD USERS"**
   - Add your email: `satya@hectorai.live`
   - Add any other emails that will test the app
   - Click **"ADD"**
   - Click **"SAVE AND CONTINUE"**

4. **Summary:**
   - Review everything
   - Click **"BACK TO DASHBOARD"**

### Step 4: Publish App (If Needed)

If you see a warning about "App is in testing mode":
- For testing, you can keep it in testing mode (test users only)
- For production, you'll need to submit for verification (takes time)
- For now, **testing mode is fine** - just make sure test users are added

### Step 5: Wait and Test

1. **Wait 1-2 minutes** for changes to propagate
2. **Test again:**
   - Go to Settings → Integrations
   - Click "Connect Gmail"
   - Should work now! ✅

---

## 📝 Important Notes

### Testing Mode vs Production

- **Testing Mode:** Only test users (emails you add) can use the app
- **Production:** Anyone with a Google account can use it (requires verification)

**For now, use Testing Mode and add test users.**

### Adding More Test Users

If you need to add more test users later:
1. Go to **OAuth consent screen**
2. Scroll to **"Test users"** section
3. Click **"ADD USERS"**
4. Add email addresses
5. Click **"ADD"**

---

## ✅ Quick Checklist

- [ ] Opened Google Cloud Console
- [ ] Went to APIs & Services → OAuth consent screen
- [ ] Changed User Type from "Internal" to "External"
- [ ] Filled out App Information
- [ ] Added required scopes
- [ ] Added test users (including satya@hectorai.live)
- [ ] Saved all changes
- [ ] Waited 1-2 minutes
- [ ] Tested "Connect Gmail" again

---

## 🔍 Visual Guide

```
Google Cloud Console
  → APIs & Services
    → OAuth consent screen
      → EDIT APP (or click on warning)
        → User Type: Change "Internal" to "External"
          → SAVE AND CONTINUE
            → Fill App Information
              → SAVE AND CONTINUE
                → Add Scopes
                  → SAVE AND CONTINUE
                    → Add Test Users (satya@hectorai.live)
                      → SAVE AND CONTINUE
                        → BACK TO DASHBOARD
```

---

**After changing to External and adding test users, try again!** 🚀

