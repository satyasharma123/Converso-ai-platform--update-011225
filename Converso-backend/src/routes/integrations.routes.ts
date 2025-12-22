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
import { initEmailSync } from '../services/emailSync';

// Outlook OAuth utilities
const outlookOAuth = require('../utils/outlookOAuth');

const router = Router();

// Get frontend URL from environment or use default
const FRONTEND_URL = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || 'http://localhost:8082';

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

      // Get user's workspace_id from their profile
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('workspace_id')
        .eq('id', userId)
        .single();
      
      const workspaceId = profile?.workspace_id || null;
      if (!workspaceId) {
        logger.warn(`User ${userId} has no workspace_id - account will be created without workspace_id`);
      }

      // Calculate token expiry
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + (tokens.expires_in || 3600));

      // Check if user wants to reset sync state
      const resetSync = req.query.reset_sync === 'true';

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
        // Update existing account with OAuth tokens and workspace_id
        accountId = existingAccounts[0].id;
        const updatePayload: any = {
          oauth_access_token: tokens.access_token,
          oauth_refresh_token: tokens.refresh_token,
          oauth_token_expires_at: expiresAt.toISOString(),
          oauth_provider: 'google',
          sync_status: 'pending',
          workspace_id: workspaceId, // Update workspace_id if missing
        };
        
        // Only reset last_synced_at if explicitly requested
        if (resetSync) {
          updatePayload.last_synced_at = null;
        }
        
        await supabaseAdmin
          .from('connected_accounts')
          .update(updatePayload)
          .eq('id', accountId);

        logger.info(`Updated existing Gmail account: ${accountId}`);
      } else {
        // Create new connected account with workspace_id
        // Use supabaseAdmin to bypass RLS since users should be able to connect their own accounts
        const newAccount = await connectedAccountsService.createAccount({
          account_name: `Gmail - ${userInfo.email}`,
          account_email: userInfo.email,
          account_type: 'email',
          is_active: true,
          user_id: userId,
          workspace_id: workspaceId, // ✅ Add workspace_id
          oauth_access_token: tokens.access_token,
          oauth_refresh_token: tokens.refresh_token,
          oauth_token_expires_at: expiresAt.toISOString(),
          oauth_provider: 'google',
          sync_status: 'pending',
        }, supabaseAdmin); // Always use admin client to bypass RLS

        accountId = newAccount.id;
        logger.info(`Created new Gmail account: ${accountId} with workspace_id: ${workspaceId}`);
      }

      // Trigger email sync immediately in background (automatic sync on account creation)
      logger.info(`🚀 Starting automatic email sync for Gmail account: ${accountId} (${userInfo.email})`);
      initEmailSync(accountId, userId, 'initial').catch(error => {
        logger.error(`❌ Error initiating automatic email sync for Gmail account ${accountId}:`, error);
      });

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

    // Start sync in background
    initEmailSync(accountId, userId, 'manual-recent').catch(error => {
      logger.error('Error during manual sync:', error);
    });
    
    res.json({ 
      message: 'Gmail sync initiated',
      accountId,
    });
  })
);

/**
 * GET /api/integrations/outlook/connect
 * Start Outlook OAuth flow - redirects to Microsoft
 */
router.get(
  '/outlook/connect',
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
      logger.warn('Outlook OAuth connect: No user ID found');
      return res.redirect(`${FRONTEND_URL}/settings?tab=integrations&error=${encodeURIComponent('Please log in to connect Outlook')}`);
    }

    // Store userId in state for callback
    const state = Buffer.from(JSON.stringify({ userId, provider: 'outlook' })).toString('base64');
    const authUrl = outlookOAuth.generateAuthUrl(state);
    
    logger.info(`Outlook OAuth initiated for user: ${userId}`);
    res.redirect(authUrl);
  })
);

/**
 * GET /api/integrations/outlook/callback
 * Handle Outlook OAuth callback - saves tokens and creates connected account
 */
router.get(
  '/outlook/callback',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { code, state, error } = req.query;

    if (error) {
      logger.error('Outlook OAuth error:', error);
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
      const tokens = await outlookOAuth.exchangeCodeForToken(code as string);
      
      // Get user info to get their email
      const userInfo = await outlookOAuth.getUserInfo(tokens.access_token);
      
      const userEmail = userInfo.mail || userInfo.userPrincipalName;
      logger.info(`Outlook OAuth successful for user: ${userId}, email: ${userEmail}`);

      // Get user's workspace_id from their profile
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('workspace_id')
        .eq('id', userId)
        .single();
      
      const workspaceId = profile?.workspace_id || null;
      if (!workspaceId) {
        logger.warn(`User ${userId} has no workspace_id - account will be created without workspace_id`);
      }

      // Calculate token expiry
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + (tokens.expires_in || 3600));

      // Check if user wants to reset sync state
      const resetSync = req.query.reset_sync === 'true';

      // Check if account already exists for this user and email
      const { data: existingAccounts } = await supabaseAdmin
        .from('connected_accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('account_email', userEmail)
        .eq('account_type', 'email')
        .limit(1);

      let accountId: string;

      if (existingAccounts && existingAccounts.length > 0) {
        // Update existing account with OAuth tokens and workspace_id
        accountId = existingAccounts[0].id;
        const updatePayload: any = {
          oauth_access_token: tokens.access_token,
          oauth_refresh_token: tokens.refresh_token,
          oauth_token_expires_at: expiresAt.toISOString(),
          oauth_provider: 'microsoft',
          sync_status: 'pending',
          workspace_id: workspaceId, // Update workspace_id if missing
        };
        
        // Only reset last_synced_at if explicitly requested
        if (resetSync) {
          updatePayload.last_synced_at = null;
        }
        
        await supabaseAdmin
          .from('connected_accounts')
          .update(updatePayload)
          .eq('id', accountId);

        logger.info(`Updated existing Outlook account: ${accountId}`);
      } else {
        // Create new connected account with workspace_id
        const newAccount = await connectedAccountsService.createAccount({
          account_name: `Outlook - ${userEmail}`,
          account_email: userEmail,
          account_type: 'email',
          is_active: true,
          user_id: userId,
          workspace_id: workspaceId, // ✅ Add workspace_id
          oauth_access_token: tokens.access_token,
          oauth_refresh_token: tokens.refresh_token,
          oauth_token_expires_at: expiresAt.toISOString(),
          oauth_provider: 'microsoft',
          sync_status: 'pending',
        }, supabaseAdmin);

        accountId = newAccount.id;
        logger.info(`Created new Outlook account: ${accountId} with workspace_id: ${workspaceId}`);
      }

      // Trigger email sync immediately in background (automatic sync on account creation)
      logger.info(`🚀 Starting automatic email sync for Outlook account: ${accountId} (${userEmail})`);
      initEmailSync(accountId, userId, 'initial').catch(error => {
        logger.error(`❌ Error initiating automatic email sync for Outlook account ${accountId}:`, error);
      });

      // Redirect back to frontend settings with success
      res.redirect(`${FRONTEND_URL}/settings?tab=integrations&success=outlook_connected`);
    } catch (error: any) {
      logger.error('Outlook OAuth callback error:', error);
      res.redirect(`${FRONTEND_URL}/settings?tab=integrations&error=${encodeURIComponent(error.message || 'Failed to connect Outlook')}`);
    }
  })
);

/**
 * POST /api/integrations/outlook/sync
 * Manually trigger Outlook sync for a connected account
 */
router.post(
  '/outlook/sync/:accountId',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { accountId } = req.params;
    const userId = req.user?.id || req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Start sync in background
    initEmailSync(accountId, userId, 'manual-recent').catch(error => {
      logger.error('Error during manual sync:', error);
    });
    
    res.json({ 
      message: 'Outlook sync initiated',
      accountId,
    });
  })
);

export default router;

