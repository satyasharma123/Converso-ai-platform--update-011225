/**
 * Outlook/Microsoft Graph API Integration Service
 * Handles fetching emails from Outlook using OAuth tokens
 */

import { logger } from '../utils/logger';
import type { ConnectedAccount } from '../types';

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

/**
 * Fetch email metadata from Outlook for a specific folder (last 90 days only)
 * Returns only metadata, not full body for performance
 */
export async function fetchOutlookEmailMetadata(
  account: ConnectedAccount,
  daysBack: number = 90,
  skipToken?: string,
  folder: string = 'inbox'
): Promise<{
  messages: OutlookMessageMetadata[];
  nextSkipToken?: string;
}> {
  if (!account.oauth_access_token) {
    throw new Error('OAuth access token not found for this account');
  }

  try {
    // Calculate date threshold (90 days ago)
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - daysBack);
    const filterDate = dateThreshold.toISOString();

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
): Promise<string> {
  if (!account.oauth_access_token) {
    throw new Error('OAuth access token not found for this account');
  }

  try {
    // Fetch body with both HTML and text formats
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${messageId}?$select=body,bodyPreview`,
      {
        headers: {
          Authorization: `Bearer ${account.oauth_access_token}`,
          'Content-Type': 'application/json',
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
    
    // Extract body content - prefer HTML, fallback to text, then bodyPreview
    if (message?.body?.content) {
      return message.body.content;
    }

    // Fallback to bodyPreview if body is not available
    if (message?.bodyPreview) {
      return message.bodyPreview;
    }

    return '';
  } catch (error: any) {
    logger.error('Error fetching Outlook email body:', {
      messageId,
      accountEmail: account.account_email,
      error: error.message,
    });
    throw error;
  }
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

