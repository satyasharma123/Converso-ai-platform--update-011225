/**
 * Outlook/Microsoft Graph API Integration Service
 * Handles fetching emails from Outlook using OAuth tokens
 */

import { logger } from '../utils/logger';
import type { ConnectedAccount, EmailAttachment } from '../types';

interface OutlookMessage {
  id: string;
  conversationId: string;
  subject: string;
  bodyPreview: string;
  receivedDateTime: string;
  from: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  body?: {
    content: string;
    contentType: string;
  };
}

interface OutlookMessageMetadata {
  id: string;
  conversationId: string;
  subject: string;
  bodyPreview: string;
  receivedDateTime: string;
  from: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  folder?: string; // Track which folder this email belongs to
}

export interface OutlookEmailBodyResult {
  body: string; // Kept for backward compatibility  
  htmlBody: string; // Explicit HTML content
  textBody: string; // Explicit text content
  attachments: EmailAttachment[];
}

/**
 * Fetch email metadata from Outlook for a specific folder
 * Returns only metadata, not full body for performance
 * Supports incremental sync via sinceDate parameter
 */
export async function fetchOutlookEmailMetadata(
  account: ConnectedAccount,
  daysBack: number = 90,
  skipToken?: string,
  folder: string = 'inbox',
  sinceDate?: Date // For incremental sync - fetch emails since this date
): Promise<{
  messages: OutlookMessageMetadata[];
  nextSkipToken?: string;
}> {
  if (!account.oauth_access_token) {
    throw new Error('OAuth access token not found for this account');
  }

  try {
    // Use sinceDate for incremental sync, or daysBack for initial sync
    const filterDate = sinceDate 
      ? sinceDate.toISOString()
      : (() => {
          const dateThreshold = new Date();
          dateThreshold.setDate(dateThreshold.getDate() - daysBack);
          return dateThreshold.toISOString();
        })();

    // Build Microsoft Graph API URL based on folder
    let baseUrl = 'https://graph.microsoft.com/v1.0/me';
    switch (folder) {
      case 'inbox':
        baseUrl += '/messages';
        break;
      case 'sent':
        baseUrl += `/mailFolders('SentItems')/messages`;
        break;
      case 'drafts':
        baseUrl += `/mailFolders('Drafts')/messages`;
        break;
      case 'archive':
        baseUrl += `/mailFolders('Archive')/messages`;
        break;
      case 'deleted':
        baseUrl += `/mailFolders('DeletedItems')/messages`;
        break;
      case 'important':
        // For important, we filter by flag
        baseUrl += '/messages';
        break;
      default:
        baseUrl += '/messages';
    }

    // Build filter - for important, add flag filter
    let filter = `receivedDateTime ge ${filterDate}`;
    if (folder === 'important') {
      filter += ` and flag/flagStatus eq 'flagged'`;
    }

    let url = `${baseUrl}?$filter=${encodeURIComponent(filter)}&$select=id,conversationId,subject,bodyPreview,receivedDateTime,from&$orderby=receivedDateTime desc&$top=100`;

    if (skipToken) {
      url += `&$skiptoken=${skipToken}`;
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${account.oauth_access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData: any = await response.json().catch(() => ({ error: response.statusText }));
      const errorMessage = errorData?.error?.message || errorData?.message || response.statusText;
      const statusCode = response.status;
      
      logger.error(`Outlook API error [${statusCode}] for folder ${folder}:`, {
        status: statusCode,
        error: errorData,
        account: account.account_email,
        folder,
      });
      
      // Handle specific error cases
      if (statusCode === 401) {
        throw new Error(`Outlook token expired or invalid. Please reconnect your account. (${errorMessage})`);
      } else if (statusCode === 403) {
        throw new Error(`Outlook API permission denied. Please check app permissions. (${errorMessage})`);
      } else if (statusCode === 429) {
        throw new Error(`Outlook API rate limit exceeded. Please try again later. (${errorMessage})`);
      }
      
      throw new Error(`Failed to fetch Outlook emails from ${folder}: ${errorMessage} (Status: ${statusCode})`);
    }

    const data: any = await response.json();
    const messages = (data.value || []).map((msg: any) => ({
      id: msg.id,
      conversationId: msg.conversationId,
      subject: msg.subject || '',
      bodyPreview: msg.bodyPreview || '',
      receivedDateTime: msg.receivedDateTime,
      from: msg.from,
      folder: folder, // Track which folder this email belongs to
    }));

    return {
      messages,
      nextSkipToken: data['@odata.nextLink'] ? extractSkipToken(data['@odata.nextLink']) : undefined,
    };
  } catch (error: any) {
    logger.error(`Error fetching Outlook email metadata for folder ${folder}:`, error);
    throw new Error(`Failed to fetch Outlook emails from ${folder}: ${error.message}`);
  }
}

/**
 * Extract skip token from Microsoft Graph nextLink
 */
function extractSkipToken(nextLink: string): string | undefined {
  try {
    const url = new URL(nextLink);
    return url.searchParams.get('$skiptoken') || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Fetch full email body from Microsoft Graph API (on-demand)
 * Used when user opens an email
 */
export async function fetchOutlookEmailBody(
  account: ConnectedAccount,
  messageId: string
): Promise<OutlookEmailBodyResult> {
  if (!account.oauth_access_token) {
    throw new Error('OAuth access token not found for this account');
  }

  try {
    // Fetch body with HTML format explicitly requested
    // Prefer-Outlook-Format: text ensures we get HTML body content
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${messageId}?$select=body,bodyPreview,hasAttachments&$expand=attachments($select=id,name,contentType,size,isInline,contentId)`,
      {
        headers: {
          Authorization: `Bearer ${account.oauth_access_token}`,
          'Content-Type': 'application/json',
          'Prefer': 'outlook.body-content-type="html"',
        },
      }
    );

    if (!response.ok) {
      const statusCode = response.status;
      let errorData: any = {};
      
      try {
        errorData = await response.json();
      } catch {
        errorData = { error: { message: response.statusText } };
      }

      const errorMessage = errorData?.error?.message || errorData?.message || response.statusText;
      
      // Handle specific error cases
      if (statusCode === 401) {
        throw new Error(`Outlook token expired or invalid. Please reconnect your account. (${errorMessage})`);
      } else if (statusCode === 403) {
        throw new Error(`Outlook API permission denied. Please check app permissions. (${errorMessage})`);
      } else if (statusCode === 404) {
        throw new Error(`Email message not found. It may have been deleted. (${errorMessage})`);
      } else if (statusCode === 429) {
        throw new Error(`Outlook API rate limit exceeded. Please try again later. (${errorMessage})`);
      }
      
      throw new Error(`Failed to fetch email body: ${errorMessage} (Status: ${statusCode})`);
    }

    const message: any = await response.json();
    
    // Extract attachments metadata
    const attachments: EmailAttachment[] = (message?.attachments || []).map((attachment: any) => ({
      id: attachment.id,
      filename: attachment.name,
      mimeType: attachment.contentType,
      size: attachment.size,
      isInline: attachment.isInline,
      contentId: attachment.contentId,
      provider: 'outlook',
    }));

    // Extract body content - Microsoft Graph returns body in this structure:
    // { contentType: 'html' | 'text', content: '...' }
    let htmlBody = '';
    let textBody = '';
    
    if (message?.body) {
      const bodyObj = message.body;
      const contentType = bodyObj.contentType?.toLowerCase();
      const content = bodyObj.content || '';
      
      // Store in appropriate field based on contentType
      if (contentType === 'html') {
        htmlBody = content;
      } else if (contentType === 'text') {
        textBody = content;
      } else if (content) {
        // Unknown type - try to detect
        if (content.includes('<html') || content.includes('</')) {
          htmlBody = content;
        } else {
          textBody = content;
        }
      }
    }
    
    // NEVER use bodyPreview when fetching full body - it's just a snippet!
    // Only use bodyPreview as absolute last resort if API returned empty body
    if (!htmlBody && !textBody && message?.bodyPreview) {
      logger.warn(`[Outlook] No body content found for ${messageId}, falling back to preview (unexpected)`);
      textBody = message.bodyPreview;
    }

    // Final body priority: HTML > Text
    const finalBody = htmlBody || textBody;

    logger.info(`[Outlook] Fetched email body for ${messageId}: type=${message?.body?.contentType}, HTML=${htmlBody.length}b, Text=${textBody.length}b`);

    return {
      body: finalBody, // Backward compatibility
      htmlBody,
      textBody,
      attachments,
    };
  } catch (error: any) {
    logger.error('Error fetching Outlook email body:', {
      messageId,
      accountEmail: account.account_email,
      error: error.message,
    });
    throw error;
  }
}

export async function downloadOutlookAttachment(
  account: ConnectedAccount,
  messageId: string,
  attachmentId: string
): Promise<Buffer> {
  if (!account.oauth_access_token) {
    throw new Error('OAuth access token not found for this account');
  }

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages/${messageId}/attachments/${attachmentId}/$value`,
    {
      headers: {
        Authorization: `Bearer ${account.oauth_access_token}`,
      },
    }
  );

  if (!response.ok) {
    const statusCode = response.status;
    const message = await response.text();
    throw new Error(`Failed to download Outlook attachment (status ${statusCode}): ${message}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Parse Outlook message metadata into conversation format
 * Used for initial sync (metadata only, no body)
 */
export function parseOutlookMessageMetadata(message: OutlookMessageMetadata) {
  const from = message.from?.emailAddress || { name: '', address: '' };
  
  return {
    messageId: message.id,
    threadId: message.conversationId,
    from: {
      name: from.name || from.address,
      email: from.address,
    },
    subject: message.subject || '',
    snippet: message.bodyPreview || '',
    date: new Date(message.receivedDateTime),
    timestamp: new Date(message.receivedDateTime),
    folder: message.folder || 'inbox', // Include folder information
  };
}

/**
 * Refresh Outlook access token
 */
export async function refreshOutlookToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}> {
  const outlookOAuth = require('../utils/outlookOAuth');
  return await outlookOAuth.refreshAccessToken(refreshToken);
}

/**
 * Send an email via Microsoft Graph API (Outlook)
 * Supports reply, reply all, and forward
 */
export async function sendOutlookEmail(
  account: ConnectedAccount,
  params: {
    to: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    subject: string;
    body: string;
    conversationId?: string; // For threading (Outlook uses conversationId)
    inReplyTo?: string; // Message ID being replied to
  }
): Promise<{ messageId: string; conversationId: string }> {
  if (!account.oauth_access_token) {
    throw new Error('OAuth access token not found for this account');
  }

  try {
    // Convert string arrays to proper format
    const toRecipients = (Array.isArray(params.to) ? params.to : [params.to])
      .filter(Boolean)
      .map(email => ({
        emailAddress: { address: email.trim() }
      }));

    const ccRecipients = params.cc
      ? (Array.isArray(params.cc) ? params.cc : [params.cc])
          .filter(Boolean)
          .map(email => ({
            emailAddress: { address: email.trim() }
          }))
      : [];

    const bccRecipients = params.bcc
      ? (Array.isArray(params.bcc) ? params.bcc : [params.bcc])
          .filter(Boolean)
          .map(email => ({
            emailAddress: { address: email.trim() }
          }))
      : [];

    // Build email message
    const message: any = {
      subject: params.subject,
      body: {
        contentType: 'HTML',
        content: params.body,
      },
      toRecipients,
    };

    if (ccRecipients.length > 0) {
      message.ccRecipients = ccRecipients;
    }

    if (bccRecipients.length > 0) {
      message.bccRecipients = bccRecipients;
    }

    // If replying to a message, add Internet Message Headers for threading
    if (params.inReplyTo) {
      message.internetMessageHeaders = [
        {
          name: 'In-Reply-To',
          value: params.inReplyTo,
        },
      ];
    }

    // Use Microsoft Graph API to send email
    const graphEndpoint = params.inReplyTo
      ? `https://graph.microsoft.com/v1.0/me/messages/${params.inReplyTo}/reply`
      : 'https://graph.microsoft.com/v1.0/me/sendMail';

    const requestBody = params.inReplyTo
      ? {
          message, // For reply, send as 'message' key
          comment: '', // Optional comment for reply
        }
      : {
          message, // For new email
          saveToSentItems: true,
        };

    const response = await fetch(graphEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${account.oauth_access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[Outlook] Send email error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      throw new Error(`Outlook API error: ${response.status} - ${errorText}`);
    }

    // For sendMail endpoint, response is 202 Accepted with no body
    // For reply endpoint, response contains the message data
    let responseData: any = {};
    if (response.status !== 202) {
      try {
        responseData = await response.json();
      } catch {
        // No JSON body - that's fine for 202 Accepted
      }
    }

    logger.info('[Outlook] Email sent successfully');

    return {
      messageId: responseData.id || 'sent',
      conversationId: responseData.conversationId || params.conversationId || 'unknown',
    };
  } catch (error: any) {
    logger.error('Error sending Outlook email:', error);
    throw new Error(`Failed to send email via Outlook: ${error.message}`);
  }
}

