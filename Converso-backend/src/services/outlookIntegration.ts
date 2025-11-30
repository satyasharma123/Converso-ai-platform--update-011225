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
}

/**
 * Fetch email metadata from Outlook (last 90 days only)
 * Returns only metadata, not full body for performance
 */
export async function fetchOutlookEmailMetadata(
  account: ConnectedAccount,
  daysBack: number = 90,
  skipToken?: string
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

    // Build Microsoft Graph API URL
    let url = `https://graph.microsoft.com/v1.0/me/messages?$filter=receivedDateTime ge ${filterDate}&$select=id,conversationId,subject,bodyPreview,receivedDateTime,from&$orderby=receivedDateTime desc&$top=100`;

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
      
      logger.error(`Outlook API error [${statusCode}]:`, {
        status: statusCode,
        error: errorData,
        account: account.account_email,
      });
      
      // Handle specific error cases
      if (statusCode === 401) {
        throw new Error(`Outlook token expired or invalid. Please reconnect your account. (${errorMessage})`);
      } else if (statusCode === 403) {
        throw new Error(`Outlook API permission denied. Please check app permissions. (${errorMessage})`);
      } else if (statusCode === 429) {
        throw new Error(`Outlook API rate limit exceeded. Please try again later. (${errorMessage})`);
      }
      
      throw new Error(`Failed to fetch Outlook emails: ${errorMessage} (Status: ${statusCode})`);
    }

    const data: any = await response.json();
    const messages = (data.value || []).map((msg: any) => ({
      id: msg.id,
      conversationId: msg.conversationId,
      subject: msg.subject || '',
      bodyPreview: msg.bodyPreview || '',
      receivedDateTime: msg.receivedDateTime,
      from: msg.from,
    }));

    return {
      messages,
      nextSkipToken: data['@odata.nextLink'] ? extractSkipToken(data['@odata.nextLink']) : undefined,
    };
  } catch (error: any) {
    logger.error('Error fetching Outlook email metadata:', error);
    throw new Error(`Failed to fetch Outlook emails: ${error.message}`);
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
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${messageId}?$select=body`,
      {
        headers: {
          Authorization: `Bearer ${account.oauth_access_token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorData: any = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(`Failed to fetch email body: ${errorData?.error?.message || errorData?.message || response.statusText}`);
    }

    const message: any = await response.json();
    
    // Extract body content
    if (message?.body?.content) {
      // If HTML, we might want to strip HTML tags for plain text
      // For now, return as-is
      return message.body.content;
    }

    return '';
  } catch (error: any) {
    logger.error('Error fetching Outlook email body:', error);
    throw new Error(`Failed to fetch email body: ${error.message}`);
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

