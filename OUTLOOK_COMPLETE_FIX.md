# Complete Fix for Outlook OAuth - Both Personal and Organizational Accounts

## Current Issues

1. **Personal accounts (@outlook.com, @live.in)**: 
   - Error: "unauthorized_client: The client does not exist or is not enabled for consumers"

2. **Organizational accounts (work/school emails)**:
   - Error: "AADSTS700016: Application was not found in the directory"

## Root Cause

The app registration is not properly configured to support both personal and organizational accounts simultaneously.

## Complete Solution

### Step 1: Update Manifest to Support Both Account Types

1. Go to **Azure Portal** → **App registrations** → **Converso AI** → **Manifest**
2. Find `"signInAudience"` (around line 18)
3. **Change it to:**
   ```json
   "signInAudience": "AzureADandPersonalMicrosoftAccount"
   ```
4. **Also check** `"isFallbackPublicClient"` should be:
   ```json
   "isFallbackPublicClient": true
   ```
5. Click **Save**
6. **Wait 15-20 minutes** for Azure to fully propagate changes

### Step 2: Verify Redirect URI Configuration

1. Go to **Authentication** in the left menu
2. Under **Platform configurations** → **Web**
3. Ensure this redirect URI is listed:
   ```
   http://localhost:3001/api/integrations/outlook/callback
   ```
4. If missing, add it and click **Save**

### Step 3: Verify API Permissions

1. Go to **API permissions**
2. Ensure these are added and **granted**:
   - `Mail.Read` (Delegated)
   - `Mail.Send` (Delegated)
   - `Mail.ReadWrite` (Delegated)
   - `User.Read` (Delegated)
   - `offline_access` (Delegated)
3. Click **Grant admin consent for Default Directory** if not already done

### Step 4: Check Publisher Domain (For Consumer Accounts)

1. Go to **Branding & properties**
2. Check if **Publisher domain** is set
3. For consumer accounts, you may need a verified domain
4. If not set, you can use the default: `conversoaioutlook.onmicrosoft.com`

### Step 5: Alternative - Create New App Registration

If the current app registration is stuck, create a fresh one:

1. **Create New App Registration:**
   - Go to **App registrations** → **+ New registration**
   - Name: "Converso AI" (or different name)
   - **Supported account types**: Select **"Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant) and personal Microsoft accounts (e.g. Skype, Xbox)"**
   - Redirect URI: Leave blank for now (add after creation)

2. **Configure Redirect URI:**
   - Go to **Authentication** → **+ Add a platform** → **Web**
   - Add: `http://localhost:3001/api/integrations/outlook/callback`
   - Click **Configure**

3. **Add API Permissions:**
   - Go to **API permissions** → **+ Add a permission** → **Microsoft Graph** → **Delegated permissions**
   - Add: `Mail.Read`, `Mail.Send`, `Mail.ReadWrite`, `User.Read`, `offline_access`
   - Click **Grant admin consent for [Your Organization]**

4. **Update Environment Variables:**
   - Copy the new **Application (client) ID**
   - Create a new **Client secret** in **Certificates & secrets**
   - Update your `.env` file with new values

### Step 6: Test After Changes

1. **Wait 15-20 minutes** after making changes
2. **Clear browser cache** and cookies
3. **Try with personal account** (@outlook.com, @live.in)
4. **Try with organizational account** (work/school email)

## Why This Configuration Works

`AzureADandPersonalMicrosoftAccount` with `/common` endpoint:
- ✅ Supports personal Microsoft accounts (no tenant required)
- ✅ Supports organizational accounts from ANY Azure AD tenant
- ✅ Users can consent on their own (no admin pre-approval needed)
- ✅ Works with the redirect URI you have configured

## Environment Variables (Verify These)

Your `.env` file should have:
```env
OUTLOOK_CLIENT_ID=d9b650d0-508e-4b1d-9164-6426e2807248
OUTLOOK_CLIENT_SECRET=hmu8Q~xQmXP4ZnYvjXi76deTvf~PDyHWtQc89arh
OUTLOOK_REDIRECT_URI=http://localhost:3001/api/integrations/outlook/callback
OUTLOOK_TENANT_ID=common
OUTLOOK_AUTH_URL=https://login.microsoftonline.com/common/oauth2/v2.0/authorize
OUTLOOK_TOKEN_URL=https://login.microsoftonline.com/common/oauth2/v2.0/token
```

## If Still Not Working

1. **Check backend logs** when clicking "Connect Email" → "Outlook"
2. **Check browser console** (F12) for any JavaScript errors
3. **Verify the OAuth URL** being generated includes:
   - `client_id=d9b650d0-508e-4b1d-9164-6426e2807248`
   - `redirect_uri=http://localhost:3001/api/integrations/outlook/callback`
   - Uses `/common` endpoint

4. **Try creating a completely new app registration** as described in Step 5

