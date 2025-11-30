# Fix "Application not found in directory" Error

## Current Error
```
AADSTS700016: Application with identifier 'c7de27fb-d0ad-4877-82a0-ce0e789a2211' 
was not found in the directory 'Bridg Technologies'.
```

## Root Cause
The app is registered in "Default Directory" but you're trying to sign in from "Bridg Technologies" tenant. For multi-tenant apps, you need to either:
1. Support personal accounts (change back to `AzureADandPersonalMicrosoftAccount`)
2. Or ensure the app is properly configured for multi-tenant organizational access

## Solution Options

### Option 1: Support Both Personal and Organizational Accounts (Recommended)

1. Go to **Azure Portal** → **App registrations** → **Converso AI** → **Manifest**
2. Change `"signInAudience"` back to:
   ```json
   "signInAudience": "AzureADandPersonalMicrosoftAccount"
   ```
3. Click **Save**
4. Wait 10-15 minutes for changes to propagate
5. This allows both:
   - Personal Microsoft accounts (@outlook.com, @hotmail.com, etc.)
   - Organizational accounts (work/school emails from any tenant)

### Option 2: Multi-Tenant Organizational Only

If you only want organizational accounts:

1. Keep `"signInAudience": "AzureADMultipleOrgs"`
2. The app needs to be **consented** in each tenant
3. Users from "Bridg Technologies" need to:
   - Have an admin consent to the app in their tenant, OR
   - Be able to consent on their own (if allowed by their org)

### Option 3: Single Tenant (Current Tenant Only)

If you only want accounts from your current tenant:

1. Change `"signInAudience"` to:
   ```json
   "signInAudience": "AzureADMyOrg"
   ```
2. Update `.env`:
   ```env
   OUTLOOK_TENANT_ID=your-tenant-id-here  # Instead of "common"
   ```
3. Only users from your tenant can sign in

## Recommended Fix

Since you want to support multiple users from different organizations, use **Option 1**:

1. **Change manifest back to support personal accounts:**
   - Go to **Manifest**
   - Change to: `"signInAudience": "AzureADandPersonalMicrosoftAccount"`
   - Click **Save**

2. **Verify redirect URI is still configured:**
   - Go to **Authentication**
   - Ensure: `http://localhost:3001/api/integrations/outlook/callback`

3. **Wait 10-15 minutes** for Azure to propagate changes

4. **Test again** - this should work for:
   - Personal accounts (@outlook.com, @hotmail.com)
   - Organizational accounts from any tenant

## Why This Works

`AzureADandPersonalMicrosoftAccount` allows:
- ✅ Personal Microsoft accounts (no tenant required)
- ✅ Organizational accounts from any Azure AD tenant
- ✅ Users can consent on their own (no admin required for most permissions)
- ✅ Works with the `/common` endpoint you're using

## Environment Variables

Your `.env` should have:
```env
OUTLOOK_CLIENT_ID=c7de27fb-d0ad-4877-82a0-ce0e789a2211
OUTLOOK_CLIENT_SECRET=XGk8Q~iTUl1ZHp9xeFeM8TGGyV-FNFQFHIFqhaO4
OUTLOOK_REDIRECT_URI=http://localhost:3001/api/integrations/outlook/callback
OUTLOOK_TENANT_ID=common  # This is correct for multi-tenant
OUTLOOK_AUTH_URL=https://login.microsoftonline.com/common/oauth2/v2.0/authorize
OUTLOOK_TOKEN_URL=https://login.microsoftonline.com/common/oauth2/v2.0/token
```

The `/common` endpoint works with `AzureADandPersonalMicrosoftAccount` to allow sign-ins from any tenant or personal accounts.

