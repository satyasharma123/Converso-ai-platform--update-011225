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
// Application (client) ID: d9b650d0-508e-4b1d-9164-6426e2807248
// Secret ID: 431ee4e9-6011-4736-9c7b-c9fcac2651b9
const CLIENT_ID = process.env.OUTLOOK_CLIENT_ID || 'd9b650d0-508e-4b1d-9164-6426e2807248';
const CLIENT_SECRET = process.env.OUTLOOK_CLIENT_SECRET || 'hmu8Q~xQmXP4ZnYvjXi76deTvf~PDyHWtQc89arh';
const REDIRECT_URI = process.env.OUTLOOK_REDIRECT_URI || 'http://localhost:3001/api/integrations/outlook/callback';
const TENANT_ID = process.env.OUTLOOK_TENANT_ID || 'common';
// Use 'common' endpoint for multi-tenant/personal accounts, or specific tenant ID for single tenant
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

// TypeScript interfaces for OAuth responses
interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface UserInfo {
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
}

interface ErrorResponse {
  error: string;
  error_description?: string;
}

/**
 * Generate Microsoft OAuth2 authorization URL
 * @param state - Optional state parameter for CSRF protection
 * @returns Authorization URL
 */
export function generateAuthUrl(state: string | null = null): string {
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
 * @param code - Authorization code from callback
 * @returns Token response with access_token and refresh_token
 */
export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
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
    let error: ErrorResponse = { error: response.statusText };
    try {
      error = await response.json();
    } catch {}
    throw new Error(`Token exchange failed: ${error.error_description || error.error || response.statusText}`);
  }

  return (await response.json()) as TokenResponse;
}

/**
 * Refresh access token using refresh token
 * @param refreshToken - Refresh token
 * @returns New token response
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
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
    let error: ErrorResponse = { error: response.statusText };
    try {
      error = await response.json();
    } catch {}
    throw new Error(`Token refresh failed: ${error.error_description || error.error || response.statusText}`);
  }

  return (await response.json()) as TokenResponse;
}

/**
 * Get user info from access token
 * @param accessToken - Access token
 * @returns User info
 */
export async function getUserInfo(accessToken: string): Promise<UserInfo> {
  const response = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get user info');
  }

  return (await response.json()) as UserInfo;
}

// Export constants for use in other modules
export {
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI,
  SCOPES,
};

