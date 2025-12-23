/**
 * Google OAuth2 for Gmail SMTP Authentication
 * 
 * This utility generates OAuth URLs and handles token exchange
 * for Gmail OAuth2 SMTP authentication in Supabase.
 * 
 * Usage:
 * 1. Generate authorization URL
 * 2. User authorizes and gets redirected with code
 * 3. Exchange code for access token
 * 4. Use access token for SMTP authentication
 */

// Google OAuth2 Credentials
// Use environment variables for security, or set defaults here
const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || '114085075300-hb1bjck7d7n2e0mnf60e94137gm8qoth.apps.googleusercontent.com';
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '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';
const REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:3001/api/integrations/gmail/callback';

// Gmail OAuth2 scopes required for reading and sending emails
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly', // Read emails
  'https://www.googleapis.com/auth/gmail.send', // Send emails
  'https://www.googleapis.com/auth/gmail.modify', // Modify emails (mark as read, etc.)
  'https://www.googleapis.com/auth/userinfo.email', // Get user email
  'https://www.googleapis.com/auth/userinfo.profile', // Get user profile
].join(' ');

/**
 * Generate Google OAuth2 authorization URL
 * @param {string} state - Optional state parameter for CSRF protection
 * @returns {string} Authorization URL
 */
function generateAuthUrl(state: string | null = null): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline', // Required to get refresh token
    prompt: 'consent', // Force consent screen to get refresh token
    ...(state && { state }),
  });

  return `https://accounts.google.com/o/oauth2/auth?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 * @param {string} code - Authorization code from callback
 * @returns {Promise<Object>} Token response with access_token and refresh_token
 */
async function exchangeCodeForToken(code: string): Promise<any> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const error = (await response.json()) as {
      error?: string;
      error_description?: string;
    };

    throw new Error(
      `Token exchange failed: ${error.error_description ?? error.error ?? 'Unknown error'}`
    );
  }

  return await response.json();
}

/**
 * Refresh access token using refresh token
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<Object>} New token response
 */
async function refreshAccessToken(refreshToken: string): Promise<any> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = (await response.json()) as {
      error?: string;
      error_description?: string;
    };

    throw new Error(
      `Token refresh failed: ${error.error_description ?? error.error ?? 'Unknown error'}`
    );
  }

  return await response.json();
}

/**
 * Get user info from access token
 * @param {string} accessToken - Access token
 * @returns {Promise<Object>} User info
 */
async function getUserInfo(accessToken: string): Promise<any> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get user info');
  }

  return await response.json();
}

export {
  generateAuthUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  getUserInfo,
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI,
  SCOPES,
};
