/**
 * Email Sync Service
 * Handles syncing emails from Gmail and Outlook to database
 */

import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../utils/logger';
import { fetchGmailEmailMetadata, parseGmailMessageMetadata, fetchGmailEmailBody } from './gmailIntegration';
import { fetchOutlookEmailMetadata, parseOutlookMessageMetadata, fetchOutlookEmailBody } from './outlookIntegration';
import { upsertSyncStatus, getSyncStatus, updateSyncProgress } from '../api/syncStatus';
import type { ConnectedAccount, EmailAttachment } from '../types';
import { EMAIL_INITIAL_SYNC_DAYS } from '../config/unipile';

interface EmailMetadata {
  messageId: string;
  threadId: string;
  from: { name: string; email: string };
  subject: string;
  snippet: string;
  date: Date;
  timestamp: Date;
}

/**
 * Normalize folder names across Gmail and Outlook
 * Gmail: INBOX, SENT, TRASH, etc.
 * Outlook: Inbox, SentItems, DeletedItems, etc.
 * Normalized: inbox, sent, trash, archive, drafts, important
 */
function normalizeProviderFolder(folder: string, isGmail: boolean): string {
  const folderLower = folder.toLowerCase();
  
  // Gmail normalization
  if (isGmail) {
    if (folderLower.includes('inbox')) return 'inbox';
    if (folderLower.includes('sent')) return 'sent';
    if (folderLower.includes('trash') || folderLower.includes('bin')) return 'trash';
    if (folderLower.includes('archive')) return 'archive';
    if (folderLower.includes('draft')) return 'drafts';
    if (folderLower.includes('important') || folderLower.includes('starred')) return 'important';
  }
  
  // Outlook normalization
  if (!isGmail) {
    if (folderLower.includes('inbox')) return 'inbox';
    if (folderLower.includes('sentitems') || folderLower.includes('sent')) return 'sent';
    if (folderLower.includes('deleteditems') || folderLower.includes('trash')) return 'trash';
    if (folderLower.includes('archive')) return 'archive';
    if (folderLower.includes('draft')) return 'drafts';
  }
  
  // Default: return as-is but lowercase
  return folderLower;
}

/**
 * Get workspace ID for a user
 * For now, we'll get the first workspace (can be extended later)
 */
async function getWorkspaceId(userId: string): Promise<string> {
  const { data: workspace, error } = await supabaseAdmin
    .from('workspaces')
    .select('id')
    .limit(1)
    .single();

  if (error || !workspace) {
    // Create default workspace if none exists
    const { data: newWorkspace, error: createError } = await supabaseAdmin
      .from('workspaces')
      .insert({ name: 'Default Workspace' })
      .select()
      .single();

    if (createError || !newWorkspace) {
      throw new Error('Failed to get or create workspace');
    }

    return newWorkspace.id;
  }

  return workspace.id;
}

/**
 * Initialize email sync for a connected account
 * Fetches emails based on EMAIL_INITIAL_SYNC_DAYS (default 30) and stores METADATA ONLY
 * Bodies and attachment binaries are fetched lazily when user opens the email
 */
export async function initEmailSync(
  accountId: string,
  userId: string
): Promise<void> {
  let account: any = null;
  
  try {
    logger.info(`[Email Sync] Initiating sync for account ${accountId}, user ${userId}`);
    
    // Get connected account
    const { data: accountData, error: accountError } = await supabaseAdmin
      .from('connected_accounts')
      .select('*')
      .eq('id', accountId)
      .single();

    if (accountError || !accountData) {
      logger.error(`[Email Sync] Connected account not found: ${accountId}`, { error: accountError });
      throw new Error(`Connected account not found: ${accountId}. Please reconnect your email account from Settings → Integrations.`);
    }
    
    account = accountData;
    
    // Determine if this is incremental sync (has last_synced_at) or initial sync
    const isIncrementalSync = !!account.last_synced_at;
    const sinceDate = isIncrementalSync ? new Date(account.last_synced_at) : null;
    const syncType = isIncrementalSync 
      ? `INCREMENTAL (since ${sinceDate?.toISOString()})` 
      : `INITIAL (last ${EMAIL_INITIAL_SYNC_DAYS} days)`;
    
    logger.info(`[Email Sync] ${syncType} - Account: ${account.account_email} (${account.oauth_provider})`);

    // Get workspace ID
    const workspaceId = await getWorkspaceId(userId);

    // Set sync status to in_progress
    await upsertSyncStatus(workspaceId, accountId, 'in_progress');

    logger.info(`[Email Sync] Starting sync - Account: ${account.account_email}, Workspace: ${workspaceId}, Provider: ${account.oauth_provider}`);

    // Determine provider and use appropriate integration
    const isGmail = account.oauth_provider === 'google';
    const isOutlook = account.oauth_provider === 'microsoft';

    if (!isGmail && !isOutlook) {
      throw new Error(`Unsupported email provider: ${account.oauth_provider}`);
    }

    // Define folders to sync (removed 'snoozed')
    const foldersToSync = ['inbox', 'sent', 'important', 'drafts', 'archive', 'trash'];
    
    let totalSynced = 0;

    // Sync each folder
    for (const folder of foldersToSync) {
      try {
        let pageToken: string | undefined;
        let skipToken: string | undefined;
        const maxBatches = 100; // Safety limit
        let batchCount = 0;

        logger.info(`Syncing folder: ${folder} for account ${account.account_email}`);

      do {
        batchCount++;
        if (batchCount > maxBatches) {
          logger.warn(`Reached max batch limit (${maxBatches}) for folder ${folder} in account ${accountId}`);
          break;
        }

        let messages: any[] = [];
        let nextPageToken: string | undefined;
        let nextSkipToken: string | undefined;

        if (isGmail) {
          const result = await fetchGmailEmailMetadata(
            account as ConnectedAccount,
            EMAIL_INITIAL_SYNC_DAYS, // Used for initial sync only
            pageToken,
            folder,
            sinceDate || undefined // For incremental sync - fetch since last_synced_at
          );
          messages = result.messages;
          nextPageToken = result.nextPageToken;
        } else if (isOutlook) {
          try {
            const result = await fetchOutlookEmailMetadata(
              account as ConnectedAccount,
              EMAIL_INITIAL_SYNC_DAYS, // Used for initial sync only
              skipToken,
              folder,
              sinceDate || undefined // For incremental sync - fetch since last_synced_at
            );
            messages = result.messages;
            nextSkipToken = result.nextSkipToken;
          } catch (outlookError: any) {
            logger.error(`Error fetching Outlook emails for account ${account.account_email}:`, outlookError);
            
            // If it's a token error (401), try to refresh token
            if (outlookError.message?.includes('401') || outlookError.message?.includes('token expired') || outlookError.message?.includes('invalid')) {
              if (account.oauth_refresh_token) {
                logger.info(`Attempting to refresh Outlook token for ${account.account_email}`);
                try {
                  const { refreshOutlookToken } = require('./outlookIntegration');
                  const newTokens = await refreshOutlookToken(account.oauth_refresh_token);
                  
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
                    .eq('id', accountId);
                  
                  logger.info(`Token refreshed successfully for ${account.account_email}, retrying sync`);
                  
                  // Retry with new token
                  const updatedAccount = { ...account, oauth_access_token: newTokens.access_token };
                  const result = await fetchOutlookEmailMetadata(
                    updatedAccount as ConnectedAccount,
                    EMAIL_INITIAL_SYNC_DAYS,
                    skipToken,
                    folder,
                    sinceDate || undefined
                  );
                  messages = result.messages;
                  nextSkipToken = result.nextSkipToken;
                } catch (refreshError: any) {
                  logger.error(`Failed to refresh Outlook token:`, refreshError);
                  throw new Error(`Outlook authentication failed. Please reconnect your account: ${account.account_email}`);
                }
              } else {
                throw new Error(`Outlook token expired and no refresh token available. Please reconnect your account: ${account.account_email}`);
              }
            } else {
              throw outlookError;
            }
          }
        }

        if (messages.length === 0) {
          break;
        }

        // Process messages and store in database (METADATA ONLY - no body/attachment binary fetch)
        for (const message of messages) {
        try {
          const parsed: any = isGmail 
            ? parseGmailMessageMetadata(message)
            : parseOutlookMessageMetadata(message);

        // METADATA-ONLY SYNC: Store attachment metadata if available, but don't fetch binaries
        // Body will be fetched lazily when user opens the email
        let attachmentMetadata: EmailAttachment[] = [];
        
        // Extract attachment metadata from the message metadata (if provider returns it)
        if (message.attachments && Array.isArray(message.attachments)) {
          attachmentMetadata = message.attachments.map((att: any) => ({
            id: att.id || att.attachmentId,
            filename: att.filename || att.name || 'unknown',
            mimeType: att.mimeType || att.contentType || 'application/octet-stream',
            size: att.size || 0,
            isInline: att.isInline || false,
            contentId: att.contentId,
            provider: isGmail ? 'gmail' : 'outlook'
          }));
        }

          // ===================================================================
          // ✅ CORRECT ARCHITECTURE: Store the "OTHER PERSON" in conversation
          // - For INBOX emails: Store sender (person who sent TO you)
          // - For SENT emails: Store recipient (person you sent TO)
          // ===================================================================
          
          // Normalize folder name
          const normalizedFolder = normalizeProviderFolder(parsed.folder || folder, isGmail);
          
          // ✅ KEY FIX: Determine who the "other person" is
          const isSentEmail = normalizedFolder === 'sent' || normalizedFolder === 'drafts';
          const otherPerson = isSentEmail ? parsed.to : parsed.from;
          
          // STEP 1: Find or create conversation by THREAD_ID (not message_id)
          // ✅ CRITICAL FIX: For SENT emails, also match by recipient email
          // This prevents forwarded emails from being grouped with original thread
          let existingConvQuery = supabaseAdmin
            .from('conversations')
            .select('id, sender_name, sender_email, subject')
            .eq('workspace_id', workspaceId)
            .eq('conversation_type', 'email');
          
          if (isGmail) {
            existingConvQuery = existingConvQuery.eq('gmail_thread_id', parsed.threadId);
          } else if (isOutlook) {
            existingConvQuery = existingConvQuery.eq('outlook_conversation_id', parsed.threadId);
          }
          
          // ✅ For SENT emails, also match by recipient to avoid grouping forwards
          if (isSentEmail) {
            existingConvQuery = existingConvQuery.eq('sender_email', otherPerson.email);
          }
          
          const { data: existingConv } = await existingConvQuery.single();
          
          let conversationId: string;
          
          if (existingConv) {
            // ✅ CONVERSATION IMMUTABILITY RULE:
            // Once created, NEVER update sender_name, sender_email, or subject
            // Only update last_message_at to reflect latest activity
            conversationId = existingConv.id;
            
            await supabaseAdmin
              .from('conversations')
              .update({
                last_message_at: parsed.timestamp.toISOString(),
              })
              .eq('id', conversationId);
            
            logger.info(`Found existing conversation for thread: ${parsed.threadId}`);
          } else {
            // Create new conversation - store the OTHER PERSON
            const conversationData: any = {
              conversation_type: 'email',
              sender_name: otherPerson.name,      // ✅ FIXED: Other person (recipient for sent, sender for inbox)
              sender_email: otherPerson.email,    // ✅ FIXED: Other person's email
              subject: parsed.subject,
              preview: parsed.snippet,
              email_timestamp: parsed.timestamp.toISOString(),
              last_message_at: parsed.timestamp.toISOString(),
              received_on_account_id: accountId,
              workspace_id: workspaceId,
              is_read: normalizedFolder !== 'inbox', // ✅ Only inbox emails are unread
              status: 'new',
              email_folder: normalizedFolder, // DEPRECATED - kept for backward compatibility
            };
            
            // Add provider-specific thread IDs AND message IDs
            // ✅ CRITICAL: Store first message ID so body can be fetched later
            if (isGmail) {
              conversationData.gmail_thread_id = parsed.threadId;
              conversationData.gmail_message_id = parsed.messageId; // ✅ NEW: For lazy body loading
            } else if (isOutlook) {
              conversationData.outlook_conversation_id = parsed.threadId;
              conversationData.outlook_message_id = parsed.messageId; // ✅ NEW: For lazy body loading
            }
            
            // ✅ SENDER-LEVEL INHERITANCE: Inherit assigned_to and custom_stage_id from existing conversations
            // This ensures new emails from the same sender automatically inherit assignment and stage
            const normalizedSenderEmail = otherPerson.email?.toLowerCase().trim();
            
            if (normalizedSenderEmail) {
              try {
                const { data: existingSender } = await supabaseAdmin
                  .from('conversations')
                  .select('assigned_to, custom_stage_id')
                  .eq('conversation_type', 'email')
                  .eq('workspace_id', workspaceId)
                  .eq('sender_email', normalizedSenderEmail)
                  .order('last_message_at', { ascending: false })
                  .limit(1)
                  .single();
                
                if (existingSender) {
                  // Inherit assigned_to (even if NULL)
                  conversationData.assigned_to = existingSender.assigned_to;
                  
                  // Inherit custom_stage_id (even if NULL)
                  conversationData.custom_stage_id = existingSender.custom_stage_id;
                  
                  // Set stage_assigned_at only if custom_stage_id is not NULL
                  if (existingSender.custom_stage_id) {
                    conversationData.stage_assigned_at = new Date().toISOString();
                  }
                  
                  logger.info(`[Sender Inheritance] New email from ${normalizedSenderEmail} inherits: assigned_to=${existingSender.assigned_to}, stage=${existingSender.custom_stage_id}`);
                }
              } catch (inheritError) {
                // Non-fatal: If inheritance fails, proceed with NULL values
                logger.warn(`[Sender Inheritance] Failed to fetch existing sender data for ${normalizedSenderEmail}:`, inheritError);
              }
            }
            
            const { data: newConv, error: convError } = await supabaseAdmin
              .from('conversations')
              .insert(conversationData)
              .select()
              .single();

            if (convError) {
              logger.error(`Error creating conversation for thread ${parsed.threadId}:`, convError);
              continue; // Skip this message
            }
            
            conversationId = newConv.id;
            logger.info(`Created new conversation for thread: ${parsed.threadId}`);
          }
          
          // STEP 2: Check if message already exists (by provider_message_id)
          const { data: existingMessage } = await supabaseAdmin
            .from('messages')
            .select('id')
            .eq('workspace_id', workspaceId)
            .eq('provider_message_id', parsed.messageId)
            .single();
          
          if (existingMessage) {
            // Message already synced - skip
            logger.info(`Message already exists: ${parsed.messageId}`);
            continue;
          }
          
          // STEP 3: Fetch email body from provider (no lazy loading)
          // ✅ MINIMAL FIX: Fetch body during sync, store in messages table
          let emailHtmlBody: string | null = null;
          let emailTextBody: string | null = null;
          
          try {
            logger.info(`[Email Sync] Fetching body for message: ${parsed.messageId}`);
            const bodyResult = isGmail
              ? await fetchGmailEmailBody(account as ConnectedAccount, parsed.messageId)
              : await fetchOutlookEmailBody(account as ConnectedAccount, parsed.messageId);
            
            emailHtmlBody = bodyResult.htmlBody || null;
            emailTextBody = bodyResult.textBody || null;
            
            logger.info(`[Email Sync] Body fetched: HTML=${emailHtmlBody?.length || 0}b, Text=${emailTextBody?.length || 0}b`);
          } catch (bodyError: any) {
            // Don't fail sync if body fetch fails - store metadata and preview
            logger.warn(`[Email Sync] Failed to fetch body for ${parsed.messageId}: ${bodyError.message}`);
            // Continue with null body - preview will be used as fallback
          }
          
          // STEP 4: Create message record with body
          const messageData: any = {
            conversation_id: conversationId,
            workspace_id: workspaceId,
            sender_name: parsed.from.name,
            sender_email: parsed.from.email,
            subject: parsed.subject,
            content: parsed.snippet, // Preview/snippet as content
            is_from_lead: !isSentEmail, // ✅ FIX: Sent emails are from US, not from leads
            provider_folder: normalizedFolder, // ✅ CRITICAL: Store folder at message level
            provider_message_id: parsed.messageId,
            provider_thread_id: parsed.threadId,
            provider: isGmail ? 'gmail' : 'outlook',
            created_at: parsed.timestamp.toISOString(),
            // ✅ MINIMAL FIX: Store body in messages table at sync time
            html_body: emailHtmlBody,
            text_body: emailTextBody,
          };
          
          // Add provider-specific fields (legacy compatibility)
          if (isGmail) {
            messageData.gmail_message_id = parsed.messageId;
          } else if (isOutlook) {
            messageData.outlook_message_id = parsed.messageId;
          }
          
          const { data: newMessage, error: msgError } = await supabaseAdmin
            .from('messages')
            .insert(messageData)
            .select()
            .single();

          if (msgError) {
            logger.error(`Error creating message ${parsed.messageId}:`, msgError);
          } else {
            logger.info(`✅ Created message with body: ${parsed.subject} in ${normalizedFolder} folder (HTML: ${emailHtmlBody?.length || 0}b, Text: ${emailTextBody?.length || 0}b)`);
          }

          totalSynced++;
          
          // Update progress every 10 emails
          if (totalSynced % 10 === 0) {
            try {
              await updateSyncProgress(workspaceId, accountId, totalSynced);
            } catch (progressError) {
              // Don't fail sync if progress update fails
              logger.warn('Failed to update sync progress:', progressError);
            }
          }
        } catch (messageError: any) {
          // Log error but continue processing other messages
          logger.error(`Error processing message ${message.id || 'unknown'}:`, {
            error: messageError.message,
            accountId,
            stack: messageError.stack,
          });
          // Continue to next message
        }
      }

        // Update pagination tokens
        if (isGmail) {
          pageToken = nextPageToken;
        } else if (isOutlook) {
          skipToken = nextSkipToken;
        }
        
        // Update progress after each batch
        try {
          await updateSyncProgress(workspaceId, accountId, totalSynced);
        } catch (progressError) {
          // Don't fail sync if progress update fails
          logger.warn('Failed to update sync progress:', progressError);
        }
        
        // Log progress
        if (totalSynced % 100 === 0) {
          logger.info(`Synced ${totalSynced} emails for account ${accountId}`);
        }
        } while (pageToken || skipToken);
        
        logger.info(`Completed syncing folder ${folder} for account ${account.account_email}`);
      } catch (folderError: any) {
        // Log error but continue with other folders
        logger.error(`Error syncing folder ${folder} for account ${account.account_email}:`, {
          error: folderError.message,
          folder,
          accountId,
        });
        // Continue to next folder
      }
    }

    // Mark sync as completed
    await upsertSyncStatus(workspaceId, accountId, 'completed');

    // Update last_synced_at for incremental sync (email accounts only)
    await supabaseAdmin
      .from('connected_accounts')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', accountId)
      .eq('account_type', 'email');

    logger.info(`[Email Sync] ✅ ${syncType} completed for ${account.account_email}. Total: ${totalSynced} emails synced (with body in messages table) from all folders`);
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error during email sync';
    logger.error(`[Email Sync] ❌ Error for account ${account?.account_email || accountId}:`, {
      accountId,
      userId,
      provider: account?.oauth_provider,
      accountEmail: account?.account_email,
      error: errorMessage,
      stack: error?.stack,
    });
    
    // Get workspace ID for error status
    try {
      const workspaceId = await getWorkspaceId(userId);
      await upsertSyncStatus(workspaceId, accountId, 'error', errorMessage);
    } catch (statusError) {
      logger.error('Failed to update sync status:', statusError);
    }
    
    // Re-throw with more context
    // Get account email for error message
    let accountEmail = accountId;
    try {
      const { data: accountData } = await supabaseAdmin
        .from('connected_accounts')
        .select('account_email')
        .eq('id', accountId)
        .single();
      if (accountData) {
        accountEmail = accountData.account_email || accountId;
      }
    } catch {
      // Ignore if we can't get account email
    }
    
    throw new Error(`Email sync failed for ${accountEmail}: ${errorMessage}`);
  }
}

/**
 * Fetch and store email body for a conversation (LAZY LOADING)
 * Called when user opens an email for the first time
 * Supports metadata-only sync architecture
 */
export async function fetchAndStoreEmailBody(
  conversationId: string,
  messageId: string,
  account: ConnectedAccount
): Promise<{ html: string; text: string; attachments: EmailAttachment[] }> {
  try {
    // Determine provider and use appropriate integration
    const isGmail = account.oauth_provider === 'google';
    const isOutlook = account.oauth_provider === 'microsoft';

    if (!isGmail && !isOutlook) {
      throw new Error(`Unsupported email provider: ${account.oauth_provider}`);
    }

    // Fetch body from appropriate API (lazy load on first open)
    logger.info(`[Lazy Load] Fetching email body for ${conversationId} from ${isGmail ? 'Gmail' : 'Outlook'}`);
    
    const bodyResult = isGmail
      ? await fetchGmailEmailBody(account, messageId)
      : await fetchOutlookEmailBody(account, messageId);

    // Use explicit HTML and text bodies from provider
    const bodyHtml = bodyResult.htmlBody || '';
    const bodyText = bodyResult.textBody || '';
    const attachments = bodyResult.attachments || [];

    logger.info(`[Lazy Load] Body extracted: HTML=${bodyHtml.length}b, Text=${bodyText.length}b, Attachments=${attachments.length}`);

    // ✅ CRITICAL FIX: Get existing preview before updating (never overwrite with null/undefined)
    const { data: existingConv } = await supabaseAdmin
      .from('conversations')
      .select('preview')
      .eq('id', conversationId)
      .single();

    // Update conversation with lazy-loaded body in new fields
    // ✅ CRITICAL: Only update preview if we have new content, otherwise preserve existing
    const updateData: any = {
      email_body_html: bodyHtml || null,
      email_body_text: bodyText || null,
      email_body_fetched_at: new Date().toISOString(),
      email_attachments: attachments.length > 0 ? attachments : undefined,
      // Keep old fields for backward compatibility during migration
      email_body: bodyHtml || bodyText || existingConv?.preview || '',
      has_full_body: !!(bodyHtml || bodyText),
    };

    // ✅ CRITICAL: Only update preview if we have new content
    // NEVER overwrite existing preview with empty/null
    if (bodyHtml || bodyText) {
      const newPreview = (bodyHtml || bodyText).substring(0, 500);
      if (newPreview.trim()) {
        updateData.preview = newPreview;
      }
    }
    // If no new content, preserve existing preview (don't update it)

    const { error: updateError } = await supabaseAdmin
      .from('conversations')
      .update(updateData)
      .eq('id', conversationId);

    if (updateError) {
      logger.error('[Lazy Load] Error updating conversation with body:', updateError);
      throw updateError;
    }

    logger.info(`[Lazy Load] ✅ Email body stored for conversation ${conversationId} (HTML: ${bodyHtml.length}b, Text: ${bodyText.length}b)`);

    return {
      html: bodyHtml,
      text: bodyText,
      attachments,
    };
  } catch (error: any) {
    logger.error(`[Lazy Load] ❌ Error fetching email body for ${conversationId}:`, {
      error: error.message,
      stack: error.stack,
      provider: account.oauth_provider,
      messageId,
    });
    
    // ✅ CRITICAL: Mark as fetched (with error) to prevent infinite retry loops
    // But preserve existing preview
    try {
      await supabaseAdmin
        .from('conversations')
        .update({
          email_body_fetched_at: new Date().toISOString(),
          has_full_body: false,
          // Don't update preview or body fields - preserve what's there
        })
        .eq('id', conversationId);
    } catch (updateError) {
      logger.error('[Lazy Load] Failed to mark conversation as fetched:', updateError);
    }
    
    // Provide user-friendly error messages for common issues
    if (error.message?.includes('401') || error.message?.includes('token') || error.message?.includes('expired')) {
      throw new Error('Email account authentication expired. Please reconnect your account in Settings.');
    }
    
    // Return empty but don't throw - let frontend show preview
    logger.warn(`[Lazy Load] Returning empty body for ${conversationId}, frontend will show preview`);
    return {
      html: '',
      text: '',
      attachments: [],
    };
  }
}

