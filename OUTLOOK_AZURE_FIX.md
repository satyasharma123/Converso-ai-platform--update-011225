# Fix Outlook OAuth "unauthorized_client" Error

## Error Message
```
unauthorized_client: The client does not exist or is not enabled for consumers.
```

## Root Cause
This error occurs when the Azure app registration is not properly configured to allow personal Microsoft accounts (consumer accounts), even if the setting appears to be enabled.

## Solution Steps

### 1. Verify Redirect URI in Azure Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** > **App registrations** > **Converso AI**
3. Click on **Authentication** in the left menu
4. Under **Platform configurations**, find **Web** platform
5. Ensure the redirect URI is **exactly**:
   ```
   http://localhost:3001/api/integrations/outlook/callback
   ```
6. For production, also add:
   ```
   https://yourdomain.com/api/integrations/outlook/callback
   ```
7. Click **Save**

### 2. Verify Supported Account Types

1. In the same **Authentication** page
2. Under **Supported account types**, ensure:
   - ✅ **"Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant) and personal Microsoft accounts (e.g. Skype, Xbox)"** is selected
3. Click **Save** if you made changes

### 3. Enable Live SDK Support (Already Done)

- ✅ "Enable Live SDK support" should be **Enabled** (which it is in your screenshot)

### 4. Check API Permissions

1. Go to **API permissions** in the left menu
2. Ensure these permissions are added:
   - `Mail.Read` (Delegated)
   - `Mail.Send` (Delegated)
   - `Mail.ReadWrite` (Delegated)
   - `User.Read` (Delegated)
   - `offline_access` (Delegated)
3. Click **Grant admin consent** if you're an admin

### 5. Verify App Registration Details

1. Go to **Overview** in the left menu
2. Verify:
   - **Application (client) ID**: Should match `OUTLOOK_CLIENT_ID` in your `.env`
   - **Directory (tenant) ID**: Should be set (can be "common" for multi-tenant)

### 6. Check Manifest (If Still Not Working)

If the above doesn't work, you may need to edit the manifest:

1. Go to **Manifest** in the left menu
2. Find the `signInAudience` property
3. Ensure it's set to:
   ```json
   "signInAudience": "AzureADandPersonalMicrosoftAccount"
   ```
4. Click **Save**

### 7. Alternative: Use Organizational Accounts Only

If you only need organizational accounts (work/school emails), you can:

1. Change **Supported account types** to:
   - **"Accounts in this organizational directory only (Default Directory only - Single tenant)"**
2. Update `OUTLOOK_TENANT_ID` in `.env` to your specific tenant ID instead of "common"

## Testing

After making these changes:

1. **Wait 5-10 minutes** for Azure changes to propagate
2. Clear browser cache and cookies
3. Try connecting Outlook again
4. If still failing, check browser console and backend logs for detailed error messages

## Common Issues

### Issue: Redirect URI Mismatch
- **Symptom**: Error mentions redirect_uri
- **Fix**: Ensure redirect URI in Azure exactly matches `OUTLOOK_REDIRECT_URI` in `.env` (including http vs https, trailing slashes, etc.)

### Issue: App Not Published
- **Symptom**: "app not verified" warnings
- **Fix**: For personal accounts, you may need to verify your publisher. Go to **Branding** > **Publisher domain**

### Issue: Permissions Not Granted
- **Symptom**: Consent screen shows errors
- **Fix**: Grant admin consent in **API permissions** page

## Environment Variables Check

Ensure your `.env` file has:
```env
OUTLOOK_CLIENT_ID=d9b650d0-508e-4b1d-9164-6426e2807248
OUTLOOK_CLIENT_SECRET=hmu8Q~xQmXP4ZnYvjXi76deTvf~PDyHWtQc89arh
OUTLOOK_REDIRECT_URI=http://localhost:3001/api/integrations/outlook/callback
OUTLOOK_TENANT_ID=common
OUTLOOK_AUTH_URL=https://login.microsoftonline.com/common/oauth2/v2.0/authorize
OUTLOOK_TOKEN_URL=https://login.microsoftonline.com/common/oauth2/v2.0/token
```

## Still Not Working?

If you're still getting the error after following all steps:

1. Try creating a **new app registration** in Azure
2. Use the new Client ID and Secret
3. Ensure all settings are configured from the start
4. Wait for Azure to fully propagate the changes (can take up to 15 minutes)

