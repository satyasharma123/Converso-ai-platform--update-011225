# Fix Outlook OAuth Redirect URI Configuration

## Current Issue
Even though the manifest shows `"signInAudience": "AzureADandPersonalMicrosoftAccount"` is correct, the OAuth flow is still failing.

## Critical Steps to Fix

### Step 1: Verify Redirect URI in Azure Portal

1. Go to **Azure Portal** → **App registrations** → **Converso AI**
2. Click **Authentication** in the left menu
3. Under **Platform configurations**, look for **Web** platform
4. **IMPORTANT**: The redirect URI must be **EXACTLY**:
   ```
   http://localhost:3001/api/integrations/outlook/callback
   ```
5. Check:
   - ✅ No trailing slash
   - ✅ Exact match (case-sensitive)
   - ✅ Must be `http://` (not `https://`) for localhost
   - ✅ Port number is `3001` (not `3000` or `8080`)

### Step 2: Add Redirect URI if Missing

If you don't see the redirect URI:

1. Click **+ Add a platform**
2. Select **Web**
3. Enter redirect URI: `http://localhost:3001/api/integrations/outlook/callback`
4. Click **Configure**

### Step 3: Verify API Permissions

1. Go to **API permissions** in the left menu
2. Ensure these permissions are added:
   - ✅ `Mail.Read` (Delegated) - Microsoft Graph
   - ✅ `Mail.Send` (Delegated) - Microsoft Graph
   - ✅ `Mail.ReadWrite` (Delegated) - Microsoft Graph
   - ✅ `User.Read` (Delegated) - Microsoft Graph
   - ✅ `offline_access` (Delegated) - Microsoft Graph
3. Click **Grant admin consent for [Your Organization]** if available
4. Click **Save**

### Step 4: Check App ID and Secret

1. Go to **Overview** in the left menu
2. Verify:
   - **Application (client) ID**: Should be `d9b650d0-508e-4b1d-9164-6426e2807248`
3. Go to **Certificates & secrets**
4. Verify you have a client secret (if expired, create a new one)
5. Update `OUTLOOK_CLIENT_SECRET` in your `.env` file if you created a new secret

### Step 5: Save All Changes

1. After making any changes, click **Save** on each page
2. Wait 5-10 minutes for Azure to propagate changes

### Step 6: Test the Connection

1. Restart your backend server
2. Try connecting Outlook again
3. Check browser console and backend logs for any errors

## Common Issues

### Issue: "Redirect URI mismatch"
- **Fix**: Ensure the redirect URI in Azure **exactly** matches what's in your code
- Check for trailing slashes, http vs https, port numbers

### Issue: "Invalid client secret"
- **Fix**: Create a new client secret in Azure and update your `.env` file

### Issue: "Permissions not granted"
- **Fix**: Grant admin consent in API permissions page

### Issue: "App not found"
- **Fix**: Verify the Client ID in Azure matches your `.env` file

## Environment Variables

Make sure your `.env` file in `Converso-backend` has:

```env
OUTLOOK_CLIENT_ID=d9b650d0-508e-4b1d-9164-6426e2807248
OUTLOOK_CLIENT_SECRET=hmu8Q~xQmXP4ZnYvjXi76deTvf~PDyHWtQc89arh
OUTLOOK_REDIRECT_URI=http://localhost:3001/api/integrations/outlook/callback
OUTLOOK_TENANT_ID=common
OUTLOOK_AUTH_URL=https://login.microsoftonline.com/common/oauth2/v2.0/authorize
OUTLOOK_TOKEN_URL=https://login.microsoftonline.com/common/oauth2/v2.0/token
```

## Still Not Working?

If it's still not working after following all steps:

1. **Check backend logs** when you try to connect:
   ```bash
   cd Converso-backend
   npm run dev
   ```
   Look for any error messages when clicking "Connect Email" → "Outlook"

2. **Check browser console** (F12) for any JavaScript errors

3. **Verify the OAuth URL** being generated:
   - The URL should start with: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`
   - It should include: `client_id=d9b650d0-508e-4b1d-9164-6426e2807248`
   - It should include: `redirect_uri=http://localhost:3001/api/integrations/outlook/callback`

4. **Try creating a new app registration** in Azure as a last resort

