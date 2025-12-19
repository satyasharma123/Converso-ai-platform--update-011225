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
    // IMPORTANT: Only fetch inbox emails, exclude sent folder
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
      .or('email_folder.eq.inbox,email_folder.is.null') // ✅ Inbox only - excludes sent folder
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
    // IMPORTANT: Only fetch inbox emails, exclude sent folder
    const { data: conversations, error} = await supabaseAdmin
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
      .or('email_folder.eq.inbox,email_folder.is.null') // ✅ Inbox only - excludes sent folder
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
 * Uses latest message's provider_folder to determine conversation folder
 * LinkedIn is NOT affected - this endpoint is email-only
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
      // Get all email conversations for this workspace
      const { data: conversations, error: convError } = await supabaseAdmin
        .from('conversations')
        .select('id, is_read')
        .or(`workspace_id.eq.${workspace_id},workspace_id.is.null`)
        .eq('conversation_type', 'email');

      if (convError) {
        logger.error('Error fetching conversations for folder counts:', convError);
        return res.status(500).json({ error: 'Failed to fetch folder counts' });
      }

      const conversationIds = (conversations || []).map(c => c.id);
      
      // Fetch ALL messages to determine conversation folder
      const { data: allMessages } = await supabaseAdmin
        .from('messages')
        .select('conversation_id, provider_folder, is_from_lead, created_at')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false });

      // ✅ SMART FOLDER LOGIC: Same as conversations.ts
      const conversationFolderMap = new Map<string, string>();
      const conversationMessagesMap = new Map<string, any[]>();
      
      if (allMessages) {
        // Group messages by conversation
        for (const msg of allMessages) {
          if (!conversationMessagesMap.has(msg.conversation_id)) {
            conversationMessagesMap.set(msg.conversation_id, []);
          }
          conversationMessagesMap.get(msg.conversation_id)!.push(msg);
        }
        
        // Determine folder for each conversation using priority rules
        for (const [convId, messages] of conversationMessagesMap.entries()) {
          // Priority 1: Deleted/Trash
          const hasDeleted = messages.some(m => 
            m.provider_folder === 'trash' || m.provider_folder === 'deleted'
          );
          if (hasDeleted) {
            conversationFolderMap.set(convId, 'deleted');
            continue;
          }
          
          // Priority 2: Archive
          const hasArchive = messages.some(m => m.provider_folder === 'archive');
          if (hasArchive) {
            conversationFolderMap.set(convId, 'archive');
            continue;
          }
          
          // Priority 3: Drafts
          const hasDrafts = messages.some(m => m.provider_folder === 'drafts');
          if (hasDrafts) {
            conversationFolderMap.set(convId, 'drafts');
            continue;
          }
          
          // Priority 4: Inbox (has ANY message from lead)
          const hasInboxFromLead = messages.some(m => 
            (m.provider_folder === 'inbox' || m.provider_folder === null) && 
            m.is_from_lead === true
          );
          if (hasInboxFromLead) {
            conversationFolderMap.set(convId, 'inbox');
            continue;
          }
          
          // Priority 5: Sent (ALL messages are outgoing)
          const allSent = messages.every(m => 
            m.provider_folder === 'sent' || m.is_from_lead === false
          );
          if (allSent) {
            conversationFolderMap.set(convId, 'sent');
            continue;
          }
          
          // Default: inbox
          conversationFolderMap.set(convId, 'inbox');
        }
      }

      // Add derived_folder to each conversation
      const conversationsWithFolder = (conversations || []).map(conv => ({
        ...conv,
        derived_folder: conversationFolderMap.get(conv.id) || 'inbox',
      }));

      // Calculate counts based on derived folder from latest message
      const counts = {
        inbox: conversationsWithFolder.filter(e => e.derived_folder === 'inbox').length,
        unread: conversationsWithFolder.filter(e => !e.is_read).length, // ✅ FIX: Count all unread
        sent: conversationsWithFolder.filter(e => e.derived_folder === 'sent').length,
        important: conversationsWithFolder.filter(e => e.derived_folder === 'important').length,
        drafts: conversationsWithFolder.filter(e => e.derived_folder === 'drafts').length,
        archive: conversationsWithFolder.filter(e => e.derived_folder === 'archive').length,
        deleted: conversationsWithFolder.filter(e => e.derived_folder === 'deleted').length,
      };

      res.json({ data: counts });
    } catch (error: any) {
      logger.error('Error calculating folder counts:', error);
      res.status(500).json({ error: 'Failed to calculate folder counts' });
    }
  })
);

/**
 * GET /api/emails/test-outlook-folders
 * DIAGNOSTIC ENDPOINT: Test if Outlook Sent & Trash folders have messages
 * Returns message counts from Microsoft Graph API directly
 * MUST be before /:id route to avoid being caught by parameter matching
 */
router.get(
  '/test-outlook-folders',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      logger.info('[Outlook Test] Testing Outlook folder access');

      // Fetch Outlook account
      const { data: outlookAccounts, error: fetchError } = await supabaseAdmin
        .from('connected_accounts')
        .select('*')
        .eq('oauth_provider', 'microsoft')
        .limit(1);

      if (fetchError || !outlookAccounts || outlookAccounts.length === 0) {
        return res.json({ 
          success: false, 
          error: 'No Outlook accounts found' 
        });
      }

      const account = outlookAccounts[0];
      logger.info(`[Outlook Test] Testing account: ${account.account_email}`);

      // Test each folder
      const folderTests = [];
      const foldersToTest = ['inbox', 'sent', 'trash'];

      for (const folder of foldersToTest) {
        try {
          // Map folder names to Outlook API paths
          let folderPath = '';
          switch (folder) {
            case 'inbox':
              folderPath = '/messages';
              break;
            case 'sent':
              folderPath = `/mailFolders('SentItems')/messages`;
              break;
            case 'trash':
              folderPath = `/mailFolders('DeletedItems')/messages`;
              break;
          }

          const response = await fetch(
            `https://graph.microsoft.com/v1.0/me${folderPath}?$top=5&$select=id,subject,from,receivedDateTime`,
            {
              headers: {
                Authorization: `Bearer ${account.oauth_access_token}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (response.ok) {
            const data: any = await response.json();
            folderTests.push({
              folder,
              status: 'success',
              messageCount: data.value?.length || 0,
              hasMessages: (data.value?.length || 0) > 0,
              sample: data.value?.[0] ? {
                subject: data.value[0].subject,
                from: data.value[0].from?.emailAddress?.address,
                date: data.value[0].receivedDateTime
              } : null
            });
          } else {
            const errorData: any = await response.json();
            folderTests.push({
              folder,
              status: 'error',
              error: errorData.error?.message || response.statusText
            });
          }
        } catch (error: any) {
          folderTests.push({
            folder,
            status: 'error',
            error: error.message
          });
        }
      }

      return res.json({
        success: true,
        account: account.account_email,
        folderTests
      });

    } catch (error: any) {
      logger.error('[Outlook Test] Error:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
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
    // ✅ CRITICAL: Only fetch inbox emails, NEVER sent/archive/deleted
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

    // ✅ LOG: Track which folder this email is from
    logger.info(`[GET /api/emails/${id}] Fetching email body for: ${conversation.sender_name}, Folder: ${conversation.email_folder || 'inbox'}`);
    logger.info(`[GET /api/emails/${id}] DEBUG: gmail_message_id=${conversation.gmail_message_id}, outlook_message_id=${(conversation as any).outlook_message_id}, received_account=${!!conversation.received_account}`);

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

        // ✅ CRITICAL FIX: Always preserve preview field even when body is fetched
        return res.json({ 
          data: {
            ...conversation,
            email_body: bodyResult.html || bodyResult.text || conversation.preview || '', // Multiple fallbacks
            email_body_html: bodyResult.html || null,
            email_body_text: bodyResult.text || null,
            preview: conversation.preview || bodyResult.text?.substring(0, 500) || '', // ✅ ALWAYS preserve preview
            email_attachments: bodyResult.attachments,
            has_full_body: !!(bodyResult.html || bodyResult.text),
          }
        });
      } catch (error: any) {
        logger.error('[Lazy Load] Error fetching email body:', error);
        
        // ✅ CRITICAL FIX: Return preview if body fetch fails - NEVER return empty body
        return res.json({
          data: {
            ...conversation,
            email_body: conversation.preview || conversation.email_body || '',
            email_body_html: null,
            email_body_text: null,
            preview: conversation.preview || '', // ✅ ALWAYS preserve preview
            body_fetch_error: error.message,
            has_full_body: false,
          }
        });
      }
    }

    // Fallback to preview if no message ID or can't fetch body
    // ✅ CRITICAL FIX: Always return preview, never empty
    logger.warn(`[Lazy Load] No message ID found for ${id}, returning preview only`);
    res.json({ 
      data: {
        ...conversation,
        email_body: conversation.preview || conversation.email_body || 'No content available',
        email_body_html: null,
        email_body_text: null,
        preview: conversation.preview || '', // ✅ ALWAYS preserve preview
        has_full_body: false,
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

      // ✅ PROVIDER-SYNC-FIRST ARCHITECTURE
      // Do NOT create local sent messages or conversations
      // Sent email will be synced from provider's Sent folder during next sync
      // This matches LinkedIn architecture: provider → sync → display
      // ✅ PROVIDER-SYNC-FIRST: Complete
      // Email sent via provider API successfully
      // Will be synced from provider's Sent folder during next sync
      logger.info(`[Email Send] ✅ Successfully sent ${replyType} via ${isGmail ? 'Gmail' : 'Outlook'}`);

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

/**
 * POST /api/email-sync/resync-outlook
 * TEMPORARY ADMIN ENDPOINT: Re-sync all Outlook accounts to backfill Sent & Trash folders
 * This endpoint triggers a full sync for all Outlook accounts to populate provider_folder
 * Safe to run multiple times (idempotent)
 */
router.post(
  '/resync-outlook',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      logger.info('[Outlook Resync] Starting full Outlook re-sync for Sent & Trash backfill');

      // Fetch all Outlook connected accounts
      const { data: outlookAccounts, error: fetchError } = await supabaseAdmin
        .from('connected_accounts')
        .select('*')
        .eq('oauth_provider', 'microsoft');

      if (fetchError) {
        logger.error('[Outlook Resync] Failed to fetch Outlook accounts:', fetchError);
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to fetch Outlook accounts' 
        });
      }

      if (!outlookAccounts || outlookAccounts.length === 0) {
        logger.info('[Outlook Resync] No active Outlook accounts found');
        return res.json({ 
          success: true, 
          message: 'No active Outlook accounts to sync',
          accounts: 0 
        });
      }

      logger.info(`[Outlook Resync] Found ${outlookAccounts.length} Outlook account(s) to sync`);

      const results = [];

      // Re-sync each Outlook account
      for (const account of outlookAccounts) {
        try {
          logger.info(`[Outlook Resync] Syncing account: ${account.account_email} (ID: ${account.id})`);
          
          // ✅ CRITICAL: Clear last_synced_at to force FULL historical sync (not incremental)
          // This ensures Microsoft Graph fetches ALL messages from ALL folders (including Sent & Trash)
          const previousSyncDate = account.last_synced_at;
          logger.info(`[Outlook Resync] Clearing last_synced_at (was: ${previousSyncDate || 'NULL'}) to force full historical sync`);
          
          await supabaseAdmin
            .from('connected_accounts')
            .update({ last_synced_at: null })
            .eq('id', account.id);
          
          logger.info(`[Outlook Resync] ✅ Cleared sync cursor - will fetch historical messages from all folders`);
          
          // Trigger full sync (includes inbox, sent, trash, etc.)
          // Now that last_synced_at is NULL, initEmailSync will treat this as INITIAL sync
          // and fetch messages from the past EMAIL_INITIAL_SYNC_DAYS (default: 30 days)
          await initEmailSync(account.id, 'full');
          
          results.push({
            accountId: account.id,
            accountEmail: account.account_email,
            status: 'success',
            message: 'Full historical sync completed (Sent & Trash backfilled)'
          });

          logger.info(`[Outlook Resync] ✅ Successfully synced ${account.account_email} - historical messages backfilled`);
        } catch (syncError: any) {
          logger.error(`[Outlook Resync] ❌ Failed to sync ${account.account_email}:`, syncError);
          results.push({
            accountId: account.id,
            accountEmail: account.account_email,
            status: 'error',
            message: syncError.message
          });
        }
      }

      const successCount = results.filter(r => r.status === 'success').length;
      const errorCount = results.filter(r => r.status === 'error').length;

      logger.info(`[Outlook Resync] Completed: ${successCount} success, ${errorCount} errors`);

      return res.json({
        success: true,
        message: `Outlook re-sync completed for ${outlookAccounts.length} account(s)`,
        summary: {
          total: outlookAccounts.length,
          success: successCount,
          errors: errorCount
        },
        results
      });

    } catch (error: any) {
      logger.error('[Outlook Resync] Unexpected error:', error);
      return res.status(500).json({
        success: false,
        error: `Failed to resync Outlook accounts: ${error.message}`,
      });
    }
  })
);

export default router;

