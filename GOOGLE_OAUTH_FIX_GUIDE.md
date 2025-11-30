# Google OAuth "App is Blocked" - Fix Guide

## Problem
When trying to connect Gmail, you see: **"This app is blocked"** or **"This app tried to access sensitive info in your Google Account. To keep your account safe, Google blocked this access."**

This happens because the Google OAuth app is in **Testing mode** and your email is not added as a test user.

## Solution Options

### Option 1: Add Your Email as Test User (Quick Fix - Recommended)

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Sign in with the Google account that created the OAuth app

2. **Navigate to OAuth Consent Screen**
   - Go to: **APIs & Services** → **OAuth consent screen**
   - Or direct link: https://console.cloud.google.com/apis/credentials/consent

3. **Add Test Users**
   - Scroll down to **"Test users"** section
   - Click **"+ ADD USERS"**
   - Add your email address (the one you're trying to connect)
   - Click **"ADD"**

4. **Save and Try Again**
   - The changes take effect immediately
   - Go back to your app and try connecting Gmail again

### Option 2: Publish the App (For Production)

If you want anyone to be able to connect without being added as a test user:

1. **Go to OAuth Consent Screen** (same as above)
2. **Click "PUBLISH APP"** button
3. **Note**: This requires:
   - App verification by Google (can take days/weeks)
   - Privacy policy URL
   - Terms of service URL
   - App logo
   - Support email

### Option 3: Use Your Own Google OAuth Credentials

If you want to use your own Google OAuth app:

1. **Create OAuth Credentials**
   - Go to: https://console.cloud.google.com/apis/credentials
   - Click **"CREATE CREDENTIALS"** → **"OAuth client ID"**
   - Application type: **Web application**
   - Name: **Converso Gmail Integration**
   - Authorized redirect URIs: 
     - `http://localhost:3001/api/integrations/gmail/callback` (for development)
     - `https://yourdomain.com/api/integrations/gmail/callback` (for production)

2. **Update Environment Variables**
   - Add to `Converso-backend/.env`:
     ```
     GOOGLE_OAUTH_CLIENT_ID=your_client_id_here
     GOOGLE_OAUTH_CLIENT_SECRET=your_client_secret_here
     GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3001/api/integrations/gmail/callback
     ```

3. **Restart Backend Server**
   - The backend will pick up the new credentials

## Current OAuth App Details

**Client ID**: `114085075300-hb1bjck7d7n2e0mnf60e94137gm8qoth.apps.googleusercontent.com`

**Redirect URI**: `http://localhost:3001/api/integrations/gmail/callback`

**Scopes Requested**:
- Gmail Read
- Gmail Send
- Gmail Modify
- User Email
- User Profile

## Quick Steps (Recommended)

1. Visit: https://console.cloud.google.com/apis/credentials/consent
2. Scroll to **"Test users"** section
3. Click **"+ ADD USERS"**
4. Add your email: `satya@leadnex.co` (or the email you're using)
5. Click **"ADD"**
6. Try connecting Gmail again in the app

## Verification

After adding yourself as a test user, you should be able to:
- See the consent screen (instead of "app is blocked")
- Grant permissions
- Successfully connect your Gmail account

## Troubleshooting

- **Still blocked?** Make sure you're using the exact email you added as a test user
- **Can't find OAuth consent screen?** Make sure you're signed in with the Google account that owns the project
- **Need to find the project?** Look for project ID or name containing "114085075300"

