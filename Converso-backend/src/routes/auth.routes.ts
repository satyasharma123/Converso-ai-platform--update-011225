/**
 * OAuth Routes for Google OAuth2 Authentication
 * 
 * These routes handle the OAuth flow for Gmail SMTP authentication
 */

import { Router, Request, Response } from 'express';
import { generateAuthUrl, exchangeCodeForToken, getUserInfo } from '../utils/oauth';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /auth/google
 * Redirects user to Google OAuth consent screen
 */
router.get('/google', (req: Request, res: Response) => {
  try {
    const state = req.query.state as string || null;
    const authUrl = generateAuthUrl(state);
    
    logger.info('Redirecting to Google OAuth');
    res.redirect(authUrl);
  } catch (error: any) {
    logger.error('Error generating auth URL:', error);
    res.status(500).json({ error: 'Failed to generate authorization URL' });
  }
});

/**
 * GET /auth/google/callback
 * Handles OAuth callback and exchanges code for token
 */
router.get('/google/callback', async (req: Request, res: Response) => {
  try {
    const { code, error, state } = req.query;

    if (error) {
      logger.error('OAuth error:', error);
      return res.status(400).json({ 
        error: 'OAuth authorization failed',
        details: error 
      });
    }

    if (!code) {
      return res.status(400).json({ error: 'Authorization code not provided' });
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForToken(code as string);
    
    logger.info('Successfully exchanged code for tokens');

    // Get user info
    const userInfo = await getUserInfo(tokens.access_token);

    // Return tokens and user info
    // In production, store these securely and don't expose to client
    res.json({
      success: true,
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        token_type: tokens.token_type,
      },
      user: {
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
      },
      message: 'OAuth authentication successful. Use these tokens for SMTP configuration.',
      note: 'Store refresh_token securely. Use it to refresh access_token when it expires.',
    });

  } catch (error: any) {
    logger.error('OAuth callback error:', error);
    res.status(500).json({ 
      error: 'Failed to complete OAuth flow',
      details: error.message 
    });
  }
});

/**
 * GET /auth/google/url
 * Returns the authorization URL (for testing)
 */
router.get('/google/url', (req: Request, res: Response) => {
  try {
    const state = req.query.state as string || null;
    const authUrl = generateAuthUrl(state);
    
    res.json({
      auth_url: authUrl,
      instructions: [
        '1. Copy the auth_url above',
        '2. Open it in your browser',
        '3. Authorize the application',
        '4. You will be redirected to /auth/google/callback with a code',
        '5. Exchange the code for tokens using the callback endpoint',
      ],
    });
  } catch (error: any) {
    logger.error('Error generating auth URL:', error);
    res.status(500).json({ error: 'Failed to generate authorization URL' });
  }
});

export default router;

