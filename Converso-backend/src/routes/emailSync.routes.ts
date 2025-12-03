/**
 * Email Sync Routes
 * Handles email synchronization endpoints
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../utils/errorHandler';
import { optionalAuth, AuthenticatedRequest } from '../middleware/auth';
import { getSyncStatus, upsertSyncStatus } from '../api/syncStatus';
import { initEmailSync, fetchAndStoreEmailBody } from '../services/emailSync';
import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../utils/logger';
import { workspaceService } from '../services/workspace';

const router = Router();

/**
 * GET /api/emails/sync-status
 * Get sync status for a workspace and inbox
 */
router.get(
  '/sync-status',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { workspace_id, account_id, inbox_id } = req.query;

    // Support both account_id and inbox_id (inbox_id is the column name, account_id is the value)
    const accountId = (account_id || inbox_id) as string;

    if (!workspace_id || !accountId) {
      return res.status(400).json({ 
        error: 'workspace_id and account_id (or inbox_id) are required' 
      });
    }

    const status = await getSyncStatus(
      workspace_id as string,
      accountId
    );

    // Parse progress from sync_error if status is in_progress
    let progress: { synced: number; total?: number } | null = null;
    if (status && status.status === 'in_progress' && status.sync_error) {
      try {
        const parsed = JSON.parse(status.sync_error);
        if (parsed.synced !== undefined) {
          progress = {
            synced: parsed.synced,
            total: parsed.total || undefined,
          };
        }
      } catch {
        // If parsing fails, sync_error is likely an actual error message
        progress = null;
      }
    }

    res.json({ 
      data: status ? {
        ...status,
        progress,
      } : {
        status: 'pending', // Default to pending if no status found (so sync can be triggered)
        last_synced_at: null,
        progress: null,
      }
    });
  })
);

/**
 * GET /api/emails/init-sync
 * Initialize email sync for a connected account
 */
router.post(
  '/init-sync',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { account_id } = req.body;
    const userId = req.user?.id || req.headers['x-user-id'] as string;

    if (!account_id) {
      return res.status(400).json({ error: 'account_id is required' });
    }

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Start sync in background (don't wait for completion)
    initEmailSync(account_id, userId).catch(error => {
      logger.error('Background sync error:', error);
    });

    res.json({ 
      message: 'Email sync initiated',
      account_id,
    });
  })
);

/**
 * GET /api/emails
 * Get emails for a workspace (default: last 30 days)
 */
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { workspace_id, days = 30, limit = 50 } = req.query;
    const userId = req.user?.id || req.headers['x-user-id'] as string;

    if (!workspace_id) {
      return res.status(400).json({ error: 'workspace_id is required' });
    }

    // Calculate date threshold
    const daysBack = parseInt(days as string);
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - daysBack);

    // Query conversations with workspace filter
    const { data: conversations, error } = await supabaseAdmin
      .from('conversations')
      .select(`
        *,
        received_account:connected_accounts(
          account_name,
          account_email,
          account_type
        )
      `)
      .eq('workspace_id', workspace_id as string)
      .eq('conversation_type', 'email')
      .gte('email_timestamp', dateThreshold.toISOString())
      .order('email_timestamp', { ascending: false })
      .limit(parseInt(limit as string));

    if (error) {
      logger.error('Error fetching emails:', error);
      return res.status(500).json({ error: 'Failed to fetch emails' });
    }

    res.json({ data: conversations || [] });
  })
);

/**
 * GET /api/emails/load-more
 * Load older emails (infinite scroll)
 */
router.get(
  '/load-more',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { workspace_id, before, limit = 50 } = req.query;

    if (!workspace_id || !before) {
      return res.status(400).json({ 
        error: 'workspace_id and before (timestamp) are required' 
      });
    }

    // Query conversations before the given timestamp
    const { data: conversations, error } = await supabaseAdmin
      .from('conversations')
      .select(`
        *,
        received_account:connected_accounts(
          account_name,
          account_email,
          account_type
        )
      `)
      .eq('workspace_id', workspace_id as string)
      .eq('conversation_type', 'email')
      .lt('email_timestamp', before as string)
      .order('email_timestamp', { ascending: false })
      .limit(parseInt(limit as string));

    if (error) {
      logger.error('Error loading more emails:', error);
      return res.status(500).json({ error: 'Failed to load emails' });
    }

    res.json({ data: conversations || [] });
  })
);

/**
 * GET /api/emails/folder-counts
 * Get email counts for different folders (inbox, unread, etc.)
 */
router.get(
  '/folder-counts',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { workspace_id } = req.query;

    if (!workspace_id) {
      return res.status(400).json({ error: 'workspace_id is required' });
    }

    try {
      // Get all connected email accounts for this workspace
      const { data: connectedAccounts } = await supabaseAdmin
        .from('connected_accounts')
        .select('account_email, workspace_id')
        .eq('account_type', 'email');

      // Filter accounts by workspace_id if available, or get all email accounts
      let accountEmails: string[] = [];
      if (connectedAccounts) {
        // If accounts have workspace_id, filter by it
        const workspaceAccounts = connectedAccounts.filter(acc => 
          !acc.workspace_id || acc.workspace_id === workspace_id
        );
        accountEmails = workspaceAccounts.map(acc => acc.account_email).filter(Boolean);
        
        // If no workspace-specific accounts, use all email accounts as fallback
        if (accountEmails.length === 0) {
          accountEmails = connectedAccounts.map(acc => acc.account_email).filter(Boolean);
        }
      }

      // Get all email conversations for this workspace with folder information
      const { data: conversations, error } = await supabaseAdmin
        .from('conversations')
        .select('id, is_read, email_folder')
        .eq('workspace_id', workspace_id as string)
        .eq('conversation_type', 'email');

      if (error) {
        logger.error('Error fetching conversations for folder counts:', error);
        return res.status(500).json({ error: 'Failed to fetch folder counts' });
      }

      const emails = conversations || [];

      // Calculate counts based on email_folder field
      const counts = {
        inbox: emails.filter(e => e.email_folder === 'inbox' || !e.email_folder).length,
        unread: emails.filter(e => !e.is_read).length,
        sent: emails.filter(e => e.email_folder === 'sent').length,
        important: emails.filter(e => e.email_folder === 'important').length,
        drafts: emails.filter(e => e.email_folder === 'drafts').length,
        archive: emails.filter(e => e.email_folder === 'archive').length,
        deleted: emails.filter(e => e.email_folder === 'deleted').length,
      };

      res.json({ data: counts });
    } catch (error: any) {
      logger.error('Error calculating folder counts:', error);
      res.status(500).json({ error: 'Failed to calculate folder counts' });
    }
  })
);

/**
 * GET /api/emails/:id
 * Get email with full body (fetches from Gmail if not stored)
 */
router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    // Get conversation
    const { data: conversation, error: convError } = await supabaseAdmin
      .from('conversations')
      .select(`
        *,
        received_account:connected_accounts(*)
      `)
      .eq('id', id)
      .single();

    if (convError || !conversation) {
      return res.status(404).json({ error: 'Email not found' });
    }

    // If body is already stored in conversation, return it
    if (conversation.has_full_body && conversation.email_body) {
      return res.json({ 
        data: {
          ...conversation,
          email_body: conversation.email_body, // Return email_body from conversation
        }
      });
    }
    
    // Fallback to preview if email_body not available but has_full_body is true
    if (conversation.has_full_body && !conversation.email_body) {
      return res.json({ 
        data: {
          ...conversation,
          email_body: conversation.preview || '',
        }
      });
    }

    // Fetch body from email API if not stored (supports both Gmail and Outlook)
    const messageId = conversation.gmail_message_id || (conversation as any).outlook_message_id;
    if (messageId && conversation.received_account) {
      try {
        const body = await fetchAndStoreEmailBody(
          id,
          messageId,
          conversation.received_account as any
        );

        return res.json({ 
          data: {
            ...conversation,
            email_body: body, // Return as email_body (not body)
            has_full_body: true,
          }
        });
      } catch (error: any) {
        logger.error('Error fetching email body:', error);
        return res.status(500).json({ 
          error: 'Failed to fetch email body',
          details: error.message 
        });
      }
    }

    // Fallback to preview if no message ID or can't fetch body
    res.json({ 
      data: {
        ...conversation,
        email_body: conversation.preview || conversation.email_body || '',
      }
    });
  })
);

export default router;

