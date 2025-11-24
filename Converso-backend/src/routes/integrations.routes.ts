/**
 * Integration Routes - Handle OAuth flows for Gmail, Outlook, LinkedIn
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../utils/errorHandler';
import { optionalAuth, AuthenticatedRequest } from '../middleware/auth';
import { generateAuthUrl, exchangeCodeForToken, getUserInfo } from '../utils/oauth';
import { connectedAccountsService } from '../services/connectedAccounts';
import { logger } from '../utils/logger';
import { supabaseAdmin, supabase } from '../lib/supabase';

const router = Router();

// Get frontend URL from environment or use default
const FRONTEND_URL = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || 'http://localhost:8080';

/**
 * GET /api/integrations/gmail/connect
 * Start Gmail OAuth flow - redirects to Google
 */
router.get(
  '/gmail/connect',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Try to get userId from multiple sources
    let userId: string | null = null;
    
    // 1. From authenticated user (if JWT token is present)
    if (req.user?.id) {
      userId = req.user.id;
    }
    
    // 2. From x-user-id header (if sent from frontend)
    if (!userId && req.headers['x-user-id']) {
      userId = req.headers['x-user-id'] as string;
    }
    
    // 3. From query parameter (fallback for direct browser redirects)
    if (!userId && req.query.userId) {
      userId = req.query.userId as string;
    }
    
    // If still no userId, redirect to frontend with error
    if (!userId) {
      logger.warn('Gmail OAuth connect: No user ID found');
      return res.redirect(`${FRONTEND_URL}/settings?tab=integrations&error=${encodeURIComponent('Please log in to connect Gmail')}`);
    }

    // Store userId in state for callback
    const state = Buffer.from(JSON.stringify({ userId, provider: 'gmail' })).toString('base64');
    const authUrl = generateAuthUrl(state);
    
    logger.info(`Gmail OAuth initiated for user: ${userId}`);
    res.redirect(authUrl);
  })
);

/**
 * GET /api/integrations/gmail/callback
 * Handle Gmail OAuth callback - saves tokens and creates connected account
 */
router.get(
  '/gmail/callback',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { code, state, error } = req.query;

    if (error) {
      logger.error('Gmail OAuth error:', error);
      return res.redirect(`${FRONTEND_URL}/settings?tab=integrations&error=${encodeURIComponent('OAuth authorization failed')}`);
    }

    if (!code) {
      return res.redirect(`${FRONTEND_URL}/settings?tab=integrations&error=${encodeURIComponent('Authorization code not provided')}`);
    }

    try {
      // Decode state to get userId
      let userId: string | null = null;
      let provider: string | null = null;
      
      if (state) {
        try {
          const decoded = JSON.parse(Buffer.from(state as string, 'base64').toString());
          userId = decoded.userId;
          provider = decoded.provider;
        } catch {
          // State might not be in expected format
        }
      }

      // If no userId in state, try to get from auth
      if (!userId) {
        userId = req.user?.id || req.headers['x-user-id'] as string || null;
      }

      if (!userId) {
        return res.redirect(`${FRONTEND_URL}/settings?tab=integrations&error=${encodeURIComponent('User not authenticated')}`);
      }

      // Exchange code for tokens
      const tokens = await exchangeCodeForToken(code as string);
      
      // Get user info to get their email
      const userInfo = await getUserInfo(tokens.access_token);
      
      logger.info(`Gmail OAuth successful for user: ${userId}, email: ${userInfo.email}`);

      // Calculate token expiry
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + (tokens.expires_in || 3600));

      // Check if account already exists for this user and email
      const { data: existingAccounts } = await supabaseAdmin
        .from('connected_accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('account_email', userInfo.email)
        .eq('account_type', 'email')
        .limit(1);

      let accountId: string;

      if (existingAccounts && existingAccounts.length > 0) {
        // Update existing account with OAuth tokens
        accountId = existingAccounts[0].id;
        await supabaseAdmin
          .from('connected_accounts')
          .update({
            oauth_access_token: tokens.access_token,
            oauth_refresh_token: tokens.refresh_token,
            oauth_token_expires_at: expiresAt.toISOString(),
            oauth_provider: 'google',
            sync_status: 'pending',
            last_synced_at: null,
          })
          .eq('id', accountId);

        logger.info(`Updated existing Gmail account: ${accountId}`);
      } else {
        // Create new connected account
        // Use supabaseAdmin to bypass RLS since users should be able to connect their own accounts
        const newAccount = await connectedAccountsService.createAccount({
          account_name: `Gmail - ${userInfo.email}`,
          account_email: userInfo.email,
          account_type: 'email',
          is_active: true,
          user_id: userId,
          oauth_access_token: tokens.access_token,
          oauth_refresh_token: tokens.refresh_token,
          oauth_token_expires_at: expiresAt.toISOString(),
          oauth_provider: 'google',
          sync_status: 'pending',
        }, supabaseAdmin); // Always use admin client to bypass RLS

        accountId = newAccount.id;
        logger.info(`Created new Gmail account: ${accountId}`);
      }

      // Redirect back to frontend settings with success
      res.redirect(`${FRONTEND_URL}/settings?tab=integrations&success=gmail_connected`);
    } catch (error: any) {
      logger.error('Gmail OAuth callback error:', error);
      res.redirect(`${FRONTEND_URL}/settings?tab=integrations&error=${encodeURIComponent(error.message || 'Failed to connect Gmail')}`);
    }
  })
);

/**
 * POST /api/integrations/gmail/sync
 * Manually trigger Gmail sync for a connected account
 */
router.post(
  '/gmail/sync/:accountId',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { accountId } = req.params;
    const userId = req.user?.id || req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // TODO: Implement Gmail sync logic
    // This will fetch emails and store them in conversations/messages tables
    
    res.json({ 
      message: 'Gmail sync initiated',
      accountId,
      note: 'Sync functionality will be implemented next'
    });
  })
);

export default router;

