# How to Get Your New Client ID

## Steps to Get Application (Client) ID

1. Go to **Azure Portal** → **App registrations**
2. Find your **new app registration** (the one you just created)
3. Click on it to open
4. Go to **Overview** (should be the default page)
5. Look for **Application (client) ID**
6. Copy that ID - it will look like: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

## Once You Have It

Share the Client ID and I'll update your `.env` file with:
- New Client ID
- New Client Secret (already updated)
- Restart the backend server

## Quick Check

Your new app registration should have:
- ✅ **Supported account types**: "Accounts in any organizational directory... and personal Microsoft accounts"
- ✅ **Redirect URI**: `http://localhost:3001/api/integrations/outlook/callback`
- ✅ **API Permissions**: Mail.Read, Mail.Send, Mail.ReadWrite, User.Read, offline_access (all granted)
- ✅ **Client Secret**: Already created (the one you shared)

