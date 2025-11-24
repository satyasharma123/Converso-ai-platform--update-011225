# Google OAuth2 Setup for Gmail SMTP

## 📋 Overview

This setup allows you to use Google OAuth2 for Gmail SMTP authentication instead of App Passwords. This is more secure and recommended for production.

## 🔧 Files Created

1. **`src/utils/oauth.js`** - OAuth utility functions
2. **`src/routes/auth.routes.ts`** - OAuth routes
3. **`.env.example`** - Environment variable template

## ⚙️ Setup Instructions

### Step 1: Configure Environment Variables

Add to your `.env` file in `Converso-backend/`:

```env
GOOGLE_OAUTH_CLIENT_ID=114085075300-hb1bjck7d7n2e0mnf60e94137gm8qoth.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=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
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3001/api/auth/google/callback
```

### Step 2: Configure Google OAuth Consent Screen

1. **Go to Google Cloud Console:**
   - https://console.cloud.google.com/
   - Select project: `converso-ai-479211`

2. **Configure OAuth Consent Screen:**
   - Go to **APIs & Services** → **OAuth consent screen**
   - Fill in required information
   - Add scopes:
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/gmail.compose`
     - `https://www.googleapis.com/auth/userinfo.email`

3. **Add Authorized Redirect URIs:**
   - Go to **APIs & Services** → **Credentials**
   - Click on your OAuth 2.0 Client ID
   - Under **Authorized redirect URIs**, add:
     - `http://localhost:3001/api/auth/google/callback`
     - (For production, add your production URL)

### Step 3: Test OAuth Flow

1. **Start Backend Server:**
   ```bash
   cd Converso-backend
   npm run dev
   ```

2. **Get Authorization URL:**
   ```bash
   # Option 1: Visit in browser
   http://localhost:3001/api/auth/google/url
   
   # Option 2: Direct redirect
   http://localhost:3001/api/auth/google
   ```

3. **Complete OAuth Flow:**
   - You'll be redirected to Google
   - Authorize the application
   - You'll be redirected back with tokens

4. **Get Tokens:**
   - After authorization, visit: `http://localhost:3001/api/auth/google/callback?code=YOUR_CODE`
   - Or the callback will automatically handle it
   - You'll receive `access_token` and `refresh_token`

## 🔐 Using Tokens for SMTP

### Option 1: Use in Supabase SMTP Settings

1. **Go to Supabase Dashboard:**
   - Authentication → Providers → Email → SMTP Settings

2. **Configure OAuth2:**
   - Some SMTP providers support OAuth2
   - Use the `access_token` as the password
   - Note: You'll need to refresh tokens periodically

### Option 2: Use Refresh Token

The `refresh_token` can be used to get new `access_token` when it expires:

```javascript
const { refreshAccessToken } = require('./src/utils/oauth');

// Refresh token (tokens expire after 1 hour)
const newTokens = await refreshAccessToken(refreshToken);
```

## 📝 API Endpoints

### GET `/api/auth/google`
Redirects to Google OAuth consent screen.

### GET `/api/auth/google/callback`
Handles OAuth callback and returns tokens.

**Response:**
```json
{
  "success": true,
  "tokens": {
    "access_token": "...",
    "refresh_token": "...",
    "expires_in": 3600,
    "token_type": "Bearer"
  },
  "user": {
    "email": "user@example.com",
    "name": "User Name",
    "picture": "https://..."
  }
}
```

### GET `/api/auth/google/url`
Returns the authorization URL (for testing).

**Response:**
```json
{
  "auth_url": "https://accounts.google.com/o/oauth2/auth?...",
  "instructions": [...]
}
```

## 🔄 Token Refresh

Access tokens expire after 1 hour. Use the refresh token to get a new one:

```javascript
const { refreshAccessToken } = require('./src/utils/oauth');

async function getValidToken(refreshToken) {
  try {
    const tokens = await refreshAccessToken(refreshToken);
    return tokens.access_token;
  } catch (error) {
    console.error('Token refresh failed:', error);
    // Re-authenticate user
    throw error;
  }
}
```

## 🔒 Security Notes

1. **Never expose `CLIENT_SECRET`** in client-side code
2. **Store `refresh_token` securely** (encrypted database)
3. **Rotate tokens** periodically
4. **Use HTTPS** in production
5. **Validate redirect URIs** to prevent redirect attacks

## 🧪 Testing

1. **Test Authorization URL:**
   ```bash
   curl http://localhost:3001/api/auth/google/url
   ```

2. **Test OAuth Flow:**
   - Visit: `http://localhost:3001/api/auth/google`
   - Complete authorization
   - Check callback response

3. **Test Token Refresh:**
   ```javascript
   const { refreshAccessToken } = require('./src/utils/oauth');
   const newTokens = await refreshAccessToken('your_refresh_token');
   ```

## 📚 Additional Resources

- [Google OAuth2 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Gmail API Scopes](https://developers.google.com/gmail/api/auth/scopes)
- [OAuth2 Best Practices](https://oauth.net/2/)

## ✅ Checklist

- [ ] Environment variables configured
- [ ] Google OAuth consent screen configured
- [ ] Redirect URIs added in Google Cloud Console
- [ ] Backend server running
- [ ] OAuth flow tested
- [ ] Tokens received successfully
- [ ] Token refresh tested

---

**Note:** For production, use environment variables and never commit credentials to git!

