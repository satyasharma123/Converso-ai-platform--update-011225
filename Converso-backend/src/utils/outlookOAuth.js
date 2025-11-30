/**
 * Microsoft Outlook OAuth2 for Email Authentication
 * 
 * This utility generates OAuth URLs and handles token exchange
 * for Microsoft Outlook OAuth2 authentication.
 * 
 * Usage:
 * 1. Generate authorization URL
 * 2. User authorizes and gets redirected with code
 * 3. Exchange code for access token
 * 4. Use access token for email API access
 */

// Microsoft Outlook OAuth2 Credentials
const CLIENT_ID = process.env.OUTLOOK_CLIENT_ID || 'c7de27fb-d0ad-4877-82a0-ce0e789a2211';
const CLIENT_SECRET = process.env.OUTLOOK_CLIENT_SECRET || 'XGk8Q~iTUl1ZHp9xeFeM8TGGyV-FNFQFHIFqhaO4';
const REDIRECT_URI = process.env.OUTLOOK_REDIRECT_URI || 'http://localhost:3001/api/integrations/outlook/callback';
const TENANT_ID = process.env.OUTLOOK_TENANT_ID || 'common';
const AUTH_URL = process.env.OUTLOOK_AUTH_URL || 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const TOKEN_URL = process.env.OUTLOOK_TOKEN_URL || 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

// Microsoft Graph API scopes required for reading and sending emails
const SCOPES = [
  'https://graph.microsoft.com/Mail.Read', // Read emails
  'https://graph.microsoft.com/Mail.Send', // Send emails
  'https://graph.microsoft.com/Mail.ReadWrite', // Modify emails
  'https://graph.microsoft.com/User.Read', // Get user info
  'offline_access', // Get refresh token
].join(' ');

/**
 * Generate Microsoft OAuth2 authorization URL
 * @param {string} state - Optional state parameter for CSRF protection
 * @returns {string} Authorization URL
 */
function generateAuthUrl(state = null) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    response_mode: 'query',
    prompt: 'consent', // Force consent screen to ensure refresh token
    ...(state && { state }),
  });

  return `${AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 * @param {string} code - Authorization code from callback
 * @returns {Promise<Object>} Token response with access_token and refresh_token
 */
async function exchangeCodeForToken(code) {
  const response = await fetch(TOKEN_URL, {
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
      scope: SCOPES,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(`Token exchange failed: ${error.error_description || error.error || response.statusText}`);
  }

  return await response.json();
}

/**
 * Refresh access token using refresh token
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<Object>} New token response
 */
async function refreshAccessToken(refreshToken) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      redirect_uri: REDIRECT_URI,
      scope: SCOPES,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(`Token refresh failed: ${error.error_description || error.error || response.statusText}`);
  }

  return await response.json();
}

/**
 * Get user info from access token
 * @param {string} accessToken - Access token
 * @returns {Promise<Object>} User info
 */
async function getUserInfo(accessToken) {
  const response = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get user info');
  }

  return await response.json();
}

module.exports = {
  generateAuthUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  getUserInfo,
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI,
  SCOPES,
};

