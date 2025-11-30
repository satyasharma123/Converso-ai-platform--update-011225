/**
 * Email Sync Service
 * Handles syncing emails from Gmail and Outlook to database
 */

import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../utils/logger';
import { fetchGmailEmailMetadata, parseGmailMessageMetadata, fetchGmailEmailBody } from './gmailIntegration';
import { fetchOutlookEmailMetadata, parseOutlookMessageMetadata, fetchOutlookEmailBody } from './outlookIntegration';
import { upsertSyncStatus, getSyncStatus } from '../api/syncStatus';
import type { ConnectedAccount } from '../types';

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
 * Fetches last 90 days of emails and stores metadata only
 */
export async function initEmailSync(
  accountId: string,
  userId: string
): Promise<void> {
  let account: any = null;
  
  try {
    // Get connected account
    const { data: accountData, error: accountError } = await supabaseAdmin
      .from('connected_accounts')
      .select('*')
      .eq('id', accountId)
      .single();

    if (accountError || !accountData) {
      throw new Error('Connected account not found');
    }
    
    account = accountData;

    // Get workspace ID
    const workspaceId = await getWorkspaceId(userId);

    // Set sync status to in_progress
    await upsertSyncStatus(workspaceId, accountId, 'in_progress');

    logger.info(`Starting email sync for account ${accountId}, workspace ${workspaceId}, provider: ${account.oauth_provider}`);

    // Determine provider and use appropriate integration
    const isGmail = account.oauth_provider === 'google';
    const isOutlook = account.oauth_provider === 'microsoft';

    if (!isGmail && !isOutlook) {
      throw new Error(`Unsupported email provider: ${account.oauth_provider}`);
    }

    // Fetch emails in batches (90 days, metadata only)
    let pageToken: string | undefined;
    let skipToken: string | undefined;
    let totalSynced = 0;
    const maxBatches = 100; // Safety limit
    let batchCount = 0;

    do {
      batchCount++;
      if (batchCount > maxBatches) {
        logger.warn(`Reached max batch limit (${maxBatches}) for account ${accountId}`);
        break;
      }

      let messages: any[] = [];
      let nextPageToken: string | undefined;
      let nextSkipToken: string | undefined;

      if (isGmail) {
        const result = await fetchGmailEmailMetadata(
          account as ConnectedAccount,
          90, // Last 90 days
          pageToken
        );
        messages = result.messages;
        nextPageToken = result.nextPageToken;
      } else if (isOutlook) {
        try {
          const result = await fetchOutlookEmailMetadata(
            account as ConnectedAccount,
            90, // Last 90 days
            skipToken
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
                  90,
                  skipToken
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

      // Process messages and store in database
      for (const message of messages) {
        const parsed: any = isGmail 
          ? parseGmailMessageMetadata(message)
          : parseOutlookMessageMetadata(message);

        // Check if conversation already exists (by message_id)
        // Use appropriate field based on provider
        let existingConvQuery = supabaseAdmin
          .from('conversations')
          .select('id')
          .eq('workspace_id', workspaceId);
        
        if (isGmail) {
          existingConvQuery = existingConvQuery.eq('gmail_message_id', parsed.messageId);
        } else if (isOutlook) {
          existingConvQuery = existingConvQuery.eq('outlook_message_id', parsed.messageId);
        }
        
        const { data: existingConv } = await existingConvQuery.single();

        if (existingConv) {
          // Update existing conversation
          await supabaseAdmin
            .from('conversations')
            .update({
              email_timestamp: parsed.timestamp.toISOString(),
              preview: parsed.snippet,
              subject: parsed.subject,
              sender_name: parsed.from.name,
              sender_email: parsed.from.email,
              last_message_at: parsed.timestamp.toISOString(),
            })
            .eq('id', existingConv.id);
        } else {
          // Create new conversation
          const conversationData: any = {
            conversation_type: 'email',
            sender_name: parsed.from.name,
            sender_email: parsed.from.email,
            subject: parsed.subject,
            preview: parsed.snippet,
            email_timestamp: parsed.timestamp.toISOString(),
            last_message_at: parsed.timestamp.toISOString(),
            received_on_account_id: accountId,
            workspace_id: workspaceId,
            has_full_body: false, // Metadata only
            is_read: false,
            status: 'new',
          };
          
          // Add provider-specific fields
          if (isGmail) {
            conversationData.gmail_message_id = parsed.messageId;
            conversationData.gmail_thread_id = parsed.threadId;
          } else if (isOutlook) {
            conversationData.outlook_message_id = parsed.messageId;
            conversationData.outlook_conversation_id = parsed.threadId || parsed.conversationId;
          }
          
          const { data: newConv, error: convError } = await supabaseAdmin
            .from('conversations')
            .insert(conversationData)
            .select()
            .single();

          if (convError) {
            logger.error(`Error creating conversation for message ${parsed.messageId}:`, convError);
          } else if (newConv) {
            // Create initial message with snippet (metadata only, no full body)
            const messageData: any = {
              conversation_id: newConv.id,
              sender_name: parsed.from.name,
              content: parsed.snippet, // Use snippet as placeholder
              is_from_lead: true,
              created_at: parsed.timestamp.toISOString(),
              workspace_id: workspaceId,
            };
            
            // Add provider-specific message ID
            if (isGmail) {
              messageData.gmail_message_id = parsed.messageId;
            } else if (isOutlook) {
              messageData.outlook_message_id = parsed.messageId;
            }
            
            await supabaseAdmin
              .from('messages')
              .insert(messageData);
          }
        }

        totalSynced++;
      }

      // Update pagination tokens
      if (isGmail) {
        pageToken = nextPageToken;
      } else if (isOutlook) {
        skipToken = nextSkipToken;
      }
      
      // Log progress
      if (totalSynced % 100 === 0) {
        logger.info(`Synced ${totalSynced} emails for account ${accountId}`);
      }
    } while (pageToken || skipToken);

    // Mark sync as completed
    await upsertSyncStatus(workspaceId, accountId, 'completed');

    logger.info(`Email sync completed for account ${accountId}. Total: ${totalSynced} emails`);
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error during email sync';
    logger.error('Error during email sync:', {
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
 * Fetch full email body and store it
 * Called when user opens an email
 */
export async function fetchAndStoreEmailBody(
  conversationId: string,
  messageId: string,
  account: ConnectedAccount
): Promise<string> {
  try {
    // Determine provider and use appropriate integration
    const isGmail = account.oauth_provider === 'google';
    const isOutlook = account.oauth_provider === 'microsoft';

    if (!isGmail && !isOutlook) {
      throw new Error(`Unsupported email provider: ${account.oauth_provider}`);
    }

    // Fetch body from appropriate API
    const body = isGmail
      ? await fetchGmailEmailBody(account, messageId)
      : await fetchOutlookEmailBody(account, messageId);

    // Update conversation to mark body as fetched
    const { error: updateError } = await supabaseAdmin
      .from('conversations')
      .update({
        has_full_body: true,
        preview: body.substring(0, 500), // Update preview with full body snippet
      })
      .eq('id', conversationId);

    if (updateError) {
      logger.error('Error updating conversation with body:', updateError);
    }

    // Also update the first message in the conversation with the body
    const { data: messages } = await supabaseAdmin
      .from('messages')
      .select('id')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(1);

    if (messages && messages.length > 0) {
      await supabaseAdmin
        .from('messages')
        .update({
          email_body: body,
          content: body, // Also update content field
        })
        .eq('id', messages[0].id);
    }

    return body;
  } catch (error: any) {
    logger.error('Error fetching email body:', error);
    throw error;
  }
}

