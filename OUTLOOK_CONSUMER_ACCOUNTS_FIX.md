# Fix "unauthorized_client: not enabled for consumers" Error

## Problem
Even though admin consent is granted and the manifest shows `"signInAudience": "AzureADandPersonalMicrosoftAccount"`, you're still getting:
```
unauthorized_client: The client does not exist or is not enabled for consumers.
```

## Root Cause
The app registration needs to be explicitly enabled for consumer accounts through the manifest, and sometimes Azure needs the manifest to be re-saved.

## Solution Steps

### Step 1: Edit and Re-save the Manifest

1. Go to **Azure Portal** → **App registrations** → **Converso AI**
2. Click **Manifest** in the left menu
3. Find the `"signInAudience"` property (should be around line 20-25)
4. Ensure it's set to:
   ```json
   "signInAudience": "AzureADandPersonalMicrosoftAccount"
   ```
5. **IMPORTANT**: Even if it's already correct, click **Save** to force Azure to refresh the configuration
6. Wait 5-10 minutes for changes to propagate

### Step 2: Verify Publisher Domain

1. Go to **Branding & properties** in the left menu
2. Check if **Publisher domain** is set
3. If not set, you may need to verify a domain (this can take time)
4. For testing, you can skip this, but it might be required for consumer accounts

### Step 3: Check App Registration Status

1. Go to **Overview** in the left menu
2. Verify the app is in **Active** status
3. Check the **Application (client) ID** matches your `.env` file

### Step 4: Alternative - Use Organizational Accounts Only

If you only need work/school email accounts (not personal @outlook.com, @hotmail.com, etc.):

1. Go to **Manifest**
2. Change `"signInAudience"` to:
   ```json
   "signInAudience": "AzureADMultipleOrgs"
   ```
3. Update your `.env` file:
   ```env
   OUTLOOK_TENANT_ID=your-tenant-id-here  # Instead of "common"
   ```
4. Click **Save**

### Step 5: Clear Browser Cache and Try Again

1. Clear browser cache and cookies for `login.microsoftonline.com` and `login.live.com`
2. Try connecting Outlook again
3. Use an **incognito/private window** to test

### Step 6: Check if App Needs Publisher Verification

For consumer accounts, Microsoft may require publisher verification:

1. Go to **Branding & properties**
2. Check if there's a warning about publisher verification
3. If required, you'll need to:
   - Add a verified domain
   - Complete the publisher verification process
   - This can take several days

## Quick Test: Try with Work/School Account First

To verify the OAuth flow works:

1. Temporarily change the manifest to:
   ```json
   "signInAudience": "AzureADMultipleOrgs"
   ```
2. Try connecting with a work/school email (not @outlook.com or @hotmail.com)
3. If this works, the issue is specifically with consumer account support

## If Still Not Working

The error suggests Microsoft's backend hasn't recognized the consumer account enablement. Try:

1. **Create a new app registration** in Azure
2. Configure it from the start with consumer account support
3. Use the new Client ID and Secret
4. This ensures all settings are properly initialized

## Environment Variables Check

Ensure your `.env` has:
```env
OUTLOOK_CLIENT_ID=c7de27fb-d0ad-4877-82a0-ce0e789a2211
OUTLOOK_CLIENT_SECRET=XGk8Q~iTUl1ZHp9xeFeM8TGGyV-FNFQFHIFqhaO4
OUTLOOK_REDIRECT_URI=http://localhost:3001/api/integrations/outlook/callback
OUTLOOK_TENANT_ID=common
OUTLOOK_AUTH_URL=https://login.microsoftonline.com/common/oauth2/v2.0/authorize
OUTLOOK_TOKEN_URL=https://login.microsoftonline.com/common/oauth2/v2.0/token
```

