# 🔧 Fix: redirect_uri_mismatch Error

## ❌ Error
**Error 400: redirect_uri_mismatch**

This happens when the redirect URI in your OAuth request doesn't match what's configured in Google Cloud Console.

---

## ✅ Solution

### Step 1: Check Current Redirect URI in Code

The code is using: `http://localhost:3001/api/integrations/gmail/callback`

### Step 2: Add Redirect URI to Google Cloud Console

1. **Go to Google Cloud Console:**
   - https://console.cloud.google.com/
   - Select your project: `converso-ai-479211`

2. **Navigate to OAuth Credentials:**
   - Go to **APIs & Services** → **Credentials**
   - Click on your OAuth 2.0 Client ID: `114085075300-hb1bjck7d7n2e0mnf60e94137gm8qoth.apps.googleusercontent.com`

3. **Add Authorized Redirect URIs:**
   - Scroll down to **Authorized redirect URIs**
   - Click **+ ADD URI**
   - Add these URIs (one at a time):
     - `http://localhost:3001/api/integrations/gmail/callback`
     - `http://localhost:3001/api/auth/google/callback` (if you still have the old route)
   - Click **SAVE**

### Step 3: Wait a Few Minutes

Google sometimes takes 1-2 minutes to propagate the changes.

### Step 4: Test Again

1. Go to Settings → Integrations
2. Click "Connect Gmail"
3. Should work now! ✅

---

## 🔍 Verify Redirect URI in Code

The redirect URI is set in:
- **File:** `Converso-backend/src/utils/oauth.js`
- **Line 18:** `const REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:3001/api/integrations/gmail/callback';`

**Make sure this matches exactly** what you add in Google Cloud Console (including `http://` vs `https://` and trailing slashes).

---

## 📝 For Production

When deploying to production, you'll need to:
1. Add your production redirect URI to Google Cloud Console
2. Set environment variable: `GOOGLE_OAUTH_REDIRECT_URI=https://yourdomain.com/api/integrations/gmail/callback`

---

## ✅ Quick Checklist

- [ ] Opened Google Cloud Console
- [ ] Went to APIs & Services → Credentials
- [ ] Clicked on OAuth 2.0 Client ID
- [ ] Added `http://localhost:3001/api/integrations/gmail/callback` to Authorized redirect URIs
- [ ] Clicked SAVE
- [ ] Waited 1-2 minutes
- [ ] Tested "Connect Gmail" again

---

**After adding the redirect URI, try again!** 🚀

