/**
 * Email Sync Routes
 * Handles email synchronization endpoints
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../utils/errorHandler';
import { optionalAuth, AuthenticatedRequest } from '../middleware/auth';
import { getSyncStatus, upsertSyncStatus } from '../api/syncStatus';
import { initEmailSync, fetchAndStoreEmailBody } from '../services/emailSync';
import { sendGmailEmail } from '../services/gmailIntegration';
import { sendOutlookEmail } from '../services/outlookIntegration';
import { downloadGmailAttachment } from '../services/gmailIntegration';
import { downloadOutlookAttachment } from '../services/outlookIntegration';
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
 * Get email with full body (lazy loads from provider if not cached)
 * Supports metadata-only sync architecture
 */
router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    // Get conversation (email-only, never LinkedIn)
    const { data: conversation, error: convError } = await supabaseAdmin
      .from('conversations')
      .select(`
        *,
        received_account:connected_accounts(*)
      `)
      .eq('id', id)
      .eq('conversation_type', 'email') // Safety: email-only
      .single();

    if (convError || !conversation) {
      return res.status(404).json({ error: 'Email not found' });
    }

    // If body already fetched (lazy-loaded previously), return from cache
    if (conversation.email_body_fetched_at && conversation.email_body_html) {
      logger.info(`[Cache Hit] Returning cached body for ${id}`);
      return res.json({ 
        data: {
          ...conversation,
          email_body: conversation.email_body_html, // Use new field, fallback to old for compatibility
        }
      });
    }
    
    // Backward compatibility: check old has_full_body field
    if (conversation.has_full_body && conversation.email_body) {
      logger.info(`[Cache Hit - Legacy] Returning legacy cached body for ${id}`);
      return res.json({ 
        data: {
          ...conversation,
          email_body: conversation.email_body,
        }
      });
    }

    // LAZY LOAD: Fetch body from provider (first time opening this email)
    const messageId = conversation.gmail_message_id || (conversation as any).outlook_message_id;
    if (messageId && conversation.received_account) {
      try {
        logger.info(`[Lazy Load] Fetching body for ${id} (messageId: ${messageId})`);
        
        const bodyResult = await fetchAndStoreEmailBody(
          id,
          messageId,
          conversation.received_account as any
        );

        return res.json({ 
          data: {
            ...conversation,
            email_body: bodyResult.html, // Return HTML body
            email_body_html: bodyResult.html,
            email_body_text: bodyResult.text,
            email_attachments: bodyResult.attachments,
            has_full_body: true,
          }
        });
      } catch (error: any) {
        logger.error('[Lazy Load] Error fetching email body:', error);
        
        // Return preview if body fetch fails
        return res.json({
          data: {
            ...conversation,
            email_body: conversation.preview || '',
            body_fetch_error: error.message,
          }
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

/**
 * GET /api/emails/:id/attachments/:attachmentId/download
 * Download an attachment for a specific email
 */
router.get(
  '/:id/attachments/:attachmentId/download',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id, attachmentId } = req.params;

    const { data: conversation, error } = await supabaseAdmin
      .from('conversations')
      .select(`
        id,
        email_attachments,
        gmail_message_id,
        outlook_message_id,
        received_account:connected_accounts(*)
      `)
      .eq('id', id)
      .single();

    if (error || !conversation) {
      return res.status(404).json({ error: 'Email not found' });
    }

    const attachments: any[] = conversation.email_attachments || [];
    const attachment = attachments.find((att) => att.id === attachmentId);

    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const account = conversation.received_account as any;
    if (!account) {
      return res.status(400).json({ error: 'Email account not available for this message' });
    }

    const isGmail = account.oauth_provider === 'google';
    const isOutlook = account.oauth_provider === 'microsoft';

    try {
      let fileBuffer: Buffer;

      if (isGmail) {
        if (!conversation.gmail_message_id) {
          return res.status(400).json({ error: 'Gmail message ID missing for this email' });
        }
        fileBuffer = await downloadGmailAttachment(
          account,
          conversation.gmail_message_id,
          attachmentId
        );
      } else if (isOutlook) {
        if (!conversation.outlook_message_id) {
          return res.status(400).json({ error: 'Outlook message ID missing for this email' });
        }
        fileBuffer = await downloadOutlookAttachment(
          account,
          conversation.outlook_message_id,
          attachmentId
        );
      } else {
        return res.status(400).json({ error: 'Unsupported email provider for attachments' });
      }

      res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(attachment.filename || 'attachment')}"`
      );
      res.send(fileBuffer);
    } catch (downloadError: any) {
      logger.error('Attachment download error:', downloadError);
      res.status(500).json({ error: downloadError.message || 'Failed to download attachment' });
    }
  })
);

/**
 * POST /api/emails/send
 * Send an email (reply, reply all, or forward)
 */
router.post(
  '/send',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const {
      conversationId,
      to,
      cc,
      bcc,
      subject,
      body,
      replyType, // 'reply' | 'replyAll' | 'forward'
    } = req.body;

    const userId = req.user?.id || req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!conversationId) {
      return res.status(400).json({ error: 'conversationId is required' });
    }

    if (!to || !subject || !body) {
      return res.status(400).json({ error: 'to, subject, and body are required' });
    }

    try {
      // Get conversation to find the account it was received on
      const { data: conversation, error: convError } = await supabaseAdmin
        .from('conversations')
        .select(`
          id,
          gmail_message_id,
          outlook_message_id,
          gmail_thread_id,
          outlook_conversation_id,
          received_account:connected_accounts(*)
        `)
        .eq('id', conversationId)
        .single();

      if (convError || !conversation || !conversation.received_account) {
        return res.status(404).json({ error: 'Conversation or email account not found' });
      }

      const account = conversation.received_account as any;
      const isGmail = account.oauth_provider === 'google';
      const isOutlook = account.oauth_provider === 'microsoft';

      if (!isGmail && !isOutlook) {
        return res.status(400).json({ error: 'Unsupported email provider' });
      }

      // Parse recipients (can be comma-separated strings or arrays)
      const parseRecipients = (recipients: string | string[] | undefined): string[] => {
        if (!recipients) return [];
        if (Array.isArray(recipients)) return recipients;
        return recipients.split(',').map(r => r.trim()).filter(Boolean);
      };

      const toRecipients = parseRecipients(to);
      const ccRecipients = parseRecipients(cc);
      const bccRecipients = parseRecipients(bcc);

      // Prepare email parameters
      const emailParams = {
        to: toRecipients,
        cc: ccRecipients.length > 0 ? ccRecipients : undefined,
        bcc: bccRecipients.length > 0 ? bccRecipients : undefined,
        subject,
        body,
      };

      let result: { messageId: string; threadId?: string; conversationId?: string };

      try {
        if (isGmail) {
          // Add threading information for replies
          const threadId = replyType !== 'forward' ? conversation.gmail_thread_id : undefined;
          const inReplyTo = replyType !== 'forward' ? conversation.gmail_message_id : undefined;

          result = await sendGmailEmail(account, {
            ...emailParams,
            threadId,
            inReplyTo,
            references: inReplyTo, // For proper email threading
          });
        } else {
          // Outlook
          const conversationIdOutlook = replyType !== 'forward' ? conversation.outlook_conversation_id : undefined;
          const inReplyTo = replyType !== 'forward' ? conversation.outlook_message_id : undefined;

          result = await sendOutlookEmail(account, {
            ...emailParams,
            conversationId: conversationIdOutlook,
            inReplyTo,
          });
        }
      } catch (sendError: any) {
        // Check if it's an authentication error
        const isAuthError = sendError.message?.includes('401') || 
                           sendError.message?.includes('invalid authentication') ||
                           sendError.message?.includes('token') ||
                           sendError.message?.includes('credentials');

        if (isAuthError && account.oauth_refresh_token) {
          logger.info(`[Email Send] Token expired, attempting refresh for ${account.account_email}`);
          
          try {
            // Attempt to refresh token
            let newTokens: any;
            if (isGmail) {
              const { refreshGmailToken } = await import('../services/gmailIntegration');
              newTokens = await refreshGmailToken(account.oauth_refresh_token);
            } else {
              const { refreshOutlookToken } = await import('../services/outlookIntegration');
              newTokens = await refreshOutlookToken(account.oauth_refresh_token);
            }

            // Update account with new tokens
            const expiresAt = new Date();
            expiresAt.setSeconds(expiresAt.getSeconds() + (newTokens.expires_in || 3600));

            await supabaseAdmin
              .from('connected_accounts')
              .update({
                oauth_access_token: newTokens.access_token,
                oauth_refresh_token: newTokens.refresh_token || account.oauth_refresh_token,
                oauth_token_expires_at: expiresAt.toISOString(),
              })
              .eq('id', account.id);

            logger.info(`[Email Send] Token refreshed successfully, retrying send`);

            // Retry sending with new token
            const updatedAccount = {
              ...account,
              oauth_access_token: newTokens.access_token,
            };

            if (isGmail) {
              const threadId = replyType !== 'forward' ? conversation.gmail_thread_id : undefined;
              const inReplyTo = replyType !== 'forward' ? conversation.gmail_message_id : undefined;

              result = await sendGmailEmail(updatedAccount, {
                ...emailParams,
                threadId,
                inReplyTo,
                references: inReplyTo,
              });
            } else {
              const conversationIdOutlook = replyType !== 'forward' ? conversation.outlook_conversation_id : undefined;
              const inReplyTo = replyType !== 'forward' ? conversation.outlook_message_id : undefined;

              result = await sendOutlookEmail(updatedAccount, {
                ...emailParams,
                conversationId: conversationIdOutlook,
                inReplyTo,
              });
            }
          } catch (refreshError: any) {
            logger.error('[Email Send] Token refresh failed:', refreshError);
            throw new Error(`Authentication expired. Please reconnect your ${isGmail ? 'Gmail' : 'Outlook'} account in Settings.`);
          }
        } else {
          // Not an auth error, or no refresh token available
          throw sendError;
        }
      }

      // Store the sent message in the messages table for history
      // NOTE: For emails, we do NOT update last_message_at or is_read
      // Emails work differently from LinkedIn chat:
      // - Inbox stays sorted by email_timestamp (when received)
      // - Sent emails go to "Sent" folder in email provider
      // - Original email conversation remains unchanged in inbox
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('full_name, workspace_id')
        .eq('id', userId)
        .single();

      await supabaseAdmin
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: userId,
          sender_name: profile?.full_name || 'You',
          content: body,
          is_from_lead: false,
          email_body: body,
        });

      // Create a "Sent" folder conversation entry (EMAIL ONLY - not LinkedIn)
      // This makes the sent email appear in the Sent folder view
      const sentTimestamp = new Date().toISOString();
      const sentConversationData: any = {
        conversation_type: 'email', // ← CRITICAL: Only for emails
        sender_name: profile?.full_name || 'You',
        sender_email: account.account_email || 'unknown',
        subject: replyType === "forward" 
          ? `Fwd: ${conversation.subject || "No Subject"}`
          : `Re: ${conversation.subject || "No Subject"}`,
        preview: body.replace(/<[^>]+>/g, '').substring(0, 200), // Strip HTML for preview
        email_timestamp: sentTimestamp,
        last_message_at: sentTimestamp,
        received_on_account_id: account.id,
        workspace_id: profile?.workspace_id || conversation.workspace_id,
        email_folder: 'sent', // ← KEY: Makes it appear in Sent folder
        is_read: true, // Sent emails are always "read"
        status: 'new',
        email_body_html: body,
        email_body_text: body.replace(/<[^>]+>/g, ''),
        email_body_fetched_at: sentTimestamp,
        // ⚠️ IMPORTANT: Do NOT add gmail_message_id, gmail_thread_id, outlook_message_id, etc.
        // Sent folder conversations are LOCAL COPIES only - they don't need provider IDs
        // Adding provider IDs can cause conflicts with received emails that have the same IDs
      };

      // Store sent email in conversations table (for Sent folder)
      // This is a LOCAL COPY for display - completely independent from inbox conversations
      await supabaseAdmin
        .from('conversations')
        .insert(sentConversationData);

      // ⚠️ IMPORTANT: DO NOT update last_message_at for emails!
      // This is email behavior (not LinkedIn chat):
      // - Inbox remains sorted by received time (email_timestamp)
      // - Sent emails don't move the conversation to top
      // - The sent email lives in the email provider's "Sent" folder

      logger.info(`[Email Send] Successfully sent ${replyType} via ${isGmail ? 'Gmail' : 'Outlook'} and stored in Sent folder`);

      res.json({
        success: true,
        messageId: result.messageId,
        threadId: result.threadId || result.conversationId,
      });
    } catch (error: any) {
      logger.error('[Email Send] Error:', error);
      res.status(500).json({
        error: `Failed to send email: ${error.message}`,
      });
    }
  })
);

export default router;

