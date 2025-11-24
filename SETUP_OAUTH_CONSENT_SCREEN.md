# 🔧 Setup OAuth Consent Screen (Step-by-Step)

## 📍 Where to Find It

The OAuth consent screen is in a **different location** than the Credentials page.

### Step 1: Navigate to OAuth Consent Screen

1. **Go to Google Cloud Console:**
   - https://console.cloud.google.com/
   - Make sure you're in project: `converso-ai-479211`

2. **Navigate to OAuth Consent Screen:**
   - Click on **"APIs & Services"** in the left sidebar
   - Click on **"OAuth consent screen"** (it's in the same menu as "Credentials")
   - **OR** use this direct link: https://console.cloud.google.com/apis/credentials/consent

### Step 2: If You See "Configure Consent Screen" Button

If the OAuth consent screen hasn't been set up yet, you'll see:
- A button that says **"CONFIGURE CONSENT SCREEN"** or **"CREATE"**
- Click on it to start the setup

### Step 3: Choose User Type

1. **You'll be asked: "What user type do you want to support?"**
2. **Select: "External"** (NOT "Internal")
   - This allows any Google account to use your app
   - Internal is only for Google Workspace organizations
3. **Click "CREATE"**

### Step 4: Fill Out App Information

Fill in the required fields:

1. **App name:** `Converso` (or your app name)
2. **User support email:** Your email (e.g., `satya@hectorai.live`)
3. **App logo:** (Optional - can skip for now)
4. **Application home page:** 
   - For testing: `http://localhost:3000` or `http://localhost:5173`
   - For production: Your actual domain
5. **Application privacy policy link:** (Optional for testing - can skip)
6. **Application terms of service link:** (Optional for testing - can skip)
7. **Authorized domains:** (Optional - can skip for testing)
8. **Developer contact information:** Your email (e.g., `satya@hectorai.live`)

**Click "SAVE AND CONTINUE"**

### Step 5: Add Scopes

1. **Click "ADD OR REMOVE SCOPES"**
2. **In the filter/search box**, type: `gmail`
3. **Select these scopes:**
   - ✅ `https://www.googleapis.com/auth/gmail.readonly`
   - ✅ `https://www.googleapis.com/auth/gmail.send`
   - ✅ `https://www.googleapis.com/auth/gmail.modify`
4. **Also add:**
   - ✅ `https://www.googleapis.com/auth/userinfo.email`
   - ✅ `https://www.googleapis.com/auth/userinfo.profile`
5. **Click "UPDATE"**
6. **Click "SAVE AND CONTINUE"**

### Step 6: Add Test Users (IMPORTANT!)

Since your app is "External" (in testing mode), you MUST add test users:

1. **In the "Test users" section**, click **"ADD USERS"**
2. **Enter email addresses** (one per line):
   - `satya@hectorai.live`
   - Add any other emails that will test the app
3. **Click "ADD"**
4. **Click "SAVE AND CONTINUE"**

### Step 7: Summary

1. **Review all the information**
2. **Click "BACK TO DASHBOARD"**

---

## ✅ Quick Checklist

- [ ] Went to APIs & Services → OAuth consent screen
- [ ] Clicked "CONFIGURE CONSENT SCREEN" or "CREATE"
- [ ] Selected "External" as user type
- [ ] Filled out App Information (name, email, etc.)
- [ ] Added Gmail scopes (readonly, send, modify)
- [ ] Added userinfo scopes (email, profile)
- [ ] Added test users (satya@hectorai.live)
- [ ] Saved all changes
- [ ] Waited 1-2 minutes
- [ ] Tested "Connect Gmail" again

---

## 🔍 Alternative: Direct Link

If you can't find it in the menu, use this direct link:
**https://console.cloud.google.com/apis/credentials/consent**

Make sure you're in the correct project (`converso-ai-479211`).

---

## 📝 What If It's Already Configured?

If the OAuth consent screen already exists but shows "Internal":

1. **Click "EDIT APP"** (top right)
2. **Look for "User Type"** section
3. **Change from "Internal" to "External"**
4. **Follow steps 4-7 above** to complete the setup

---

## ⚠️ Important Notes

- **External apps in testing mode** can only be used by test users you add
- **Add all email addresses** that will test the app as test users
- **Changes take 1-2 minutes** to propagate
- **For production**, you'll need to submit for verification (takes time)

---

**After setting up the OAuth consent screen, try "Connect Gmail" again!** 🚀

