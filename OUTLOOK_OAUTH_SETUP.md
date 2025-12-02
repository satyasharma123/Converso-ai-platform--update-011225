# Outlook OAuth Integration Setup

This document describes the Outlook OAuth integration setup for Converso.

## Environment Variables

Add these to your `.env` file in `Converso-backend`:

```env
OUTLOOK_CLIENT_ID=d9b650d0-508e-4b1d-9164-6426e2807248
OUTLOOK_CLIENT_SECRET=hmu8Q~xQmXP4ZnYvjXi76deTvf~PDyHWtQc89arh
OUTLOOK_REDIRECT_URI=http://localhost:3001/api/integrations/outlook/callback
OUTLOOK_TENANT_ID=common
OUTLOOK_AUTH_URL=https://login.microsoftonline.com/common/oauth2/v2.0/authorize
OUTLOOK_TOKEN_URL=https://login.microsoftonline.com/common/oauth2/v2.0/token
```

## Azure App Registration

1. **Redirect URI**: `http://localhost:3001/api/integrations/outlook/callback`
   - For production: `https://yourdomain.com/api/integrations/outlook/callback`

2. **API Permissions Required**:
   - `Mail.Read` - Read user mail
   - `Mail.Send` - Send mail as the user
   - `Mail.ReadWrite` - Read and write access to user mail
   - `User.Read` - Sign in and read user profile
   - `offline_access` - Maintain access to data (for refresh tokens)

## Implementation Details

### Files Created/Modified

1. **`Converso-backend/src/utils/outlookOAuth.js`**
   - OAuth utility functions for Microsoft Graph API
   - Handles authorization URL generation, token exchange, and refresh

2. **`Converso-backend/src/services/outlookIntegration.ts`**
   - Microsoft Graph API integration
   - Fetches email metadata (last 90 days)
   - Fetches full email body on-demand

3. **`Converso-backend/src/routes/integrations.routes.ts`**
   - Added `/api/integrations/outlook/connect` route
   - Added `/api/integrations/outlook/callback` route
   - Added `/api/integrations/outlook/sync/:accountId` route

4. **`Converso-backend/src/services/emailSync.ts`**
   - Updated to support both Gmail and Outlook
   - Automatically detects provider and uses appropriate integration

## Usage

### Connecting Outlook Account

1. User navigates to Settings > Integrations
2. Clicks "Connect Outlook"
3. Redirected to Microsoft login
4. After authorization, redirected back to app
5. Account is created and email sync starts automatically

### API Endpoints

- **GET** `/api/integrations/outlook/connect` - Start OAuth flow
- **GET** `/api/integrations/outlook/callback` - Handle OAuth callback
- **POST** `/api/integrations/outlook/sync/:accountId` - Manually trigger sync

## Email Sync Behavior

- **Initial Sync**: Fetches last 90 days of emails (metadata only)
- **Default UI Load**: Shows last 30 days
- **Lazy Loading**: Full email body fetched when user opens email
- **Workspace Isolation**: All emails filtered by workspace_id

## Testing

1. Ensure backend server is running on port 3001
2. Ensure environment variables are set
3. Navigate to frontend Settings > Integrations
4. Click "Connect Outlook"
5. Complete Microsoft OAuth flow
6. Verify account appears in connected accounts
7. Check that email sync starts automatically

## Production Deployment

When deploying to production:

1. Update `OUTLOOK_REDIRECT_URI` to production URL
2. Update Azure App Registration redirect URI
3. Ensure all environment variables are set in production environment

