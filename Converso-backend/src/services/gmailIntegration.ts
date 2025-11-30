/**
 * Gmail API Integration Service
 * Handles fetching emails from Gmail using OAuth tokens
 * Implements industry-standard sync: 90 days initial, metadata only, lazy load body
 */

import { google } from 'googleapis';
import { logger } from '../utils/logger';
import type { ConnectedAccount } from '../types';

interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    parts?: Array<{ body: { data?: string }; mimeType: string }>;
    body?: { data?: string };
  };
  internalDate: string;
}

interface GmailMessageMetadata {
  id: string;
  threadId: string;
  snippet: string;
  headers: Array<{ name: string; value: string }>;
  internalDate: string;
}

/**
 * Get Gmail API client using OAuth token
 */
function getGmailClient(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.gmail({ version: 'v1', auth: oauth2Client });
}

/**
 * Get Unix timestamp for N days ago
 */
function getDaysAgoTimestamp(days: number): number {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return Math.floor(date.getTime() / 1000);
}

/**
 * Fetch email metadata from Gmail (last 90 days only)
 * Returns only metadata, not full body for performance
 */
export async function fetchGmailEmailMetadata(
  account: ConnectedAccount,
  daysBack: number = 90,
  pageToken?: string
): Promise<{
  messages: GmailMessageMetadata[];
  nextPageToken?: string;
}> {
  if (!account.oauth_access_token) {
    throw new Error('OAuth access token not found for this account');
  }

  try {
    const gmail = getGmailClient(account.oauth_access_token);
    
    // Calculate timestamp for 90 days ago
    const afterTimestamp = getDaysAgoTimestamp(daysBack);
    
    // Build query: last 90 days, in inbox
    const query = `after:${afterTimestamp} in:inbox`;
    
    // List messages (metadata only, no body)
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 500, // Gmail API max
      q: query,
      pageToken,
    });

    if (!response.data.messages || response.data.messages.length === 0) {
      return { messages: [], nextPageToken: response.data.nextPageToken || undefined };
    }

    // Fetch message metadata (format: 'metadata' is faster than 'full')
    const messages = await Promise.all(
      response.data.messages.map(async (msg) => {
        const message = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'metadata',
          metadataHeaders: ['From', 'To', 'Subject', 'Date'],
        });
        
        return {
          id: message.data.id!,
          threadId: message.data.threadId!,
          snippet: message.data.snippet || '',
          headers: message.data.payload?.headers || [],
          internalDate: message.data.internalDate || '',
        } as GmailMessageMetadata;
      })
    );

    return {
      messages,
      nextPageToken: response.data.nextPageToken || undefined,
    };
  } catch (error: any) {
    logger.error('Error fetching Gmail email metadata:', error);
    throw new Error(`Failed to fetch Gmail emails: ${error.message}`);
  }
}

/**
 * Fetch full email body from Gmail API (on-demand)
 * Used when user opens an email
 */
export async function fetchGmailEmailBody(
  account: ConnectedAccount,
  messageId: string
): Promise<string> {
  if (!account.oauth_access_token) {
    throw new Error('OAuth access token not found for this account');
  }

  try {
    const gmail = getGmailClient(account.oauth_access_token);
    
    // Fetch full message
    const message = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const payload = message.data.payload;
    if (!payload) {
      return '';
    }

    // Extract body from payload
    let body = '';
    
    // Check if body is directly in payload
    if (payload.body?.data) {
      body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    } 
    // Check parts for body
    else if (payload.parts) {
      // Find text/plain or text/html part
      const textPart = payload.parts.find(p => 
        p.mimeType === 'text/plain' || p.mimeType === 'text/html'
      );
      
      if (textPart?.body?.data) {
        body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
      }
      
      // If no text part found, try to get from first part
      if (!body && payload.parts[0]?.body?.data) {
        body = Buffer.from(payload.parts[0].body.data, 'base64').toString('utf-8');
      }
    }

    return body;
  } catch (error: any) {
    logger.error('Error fetching Gmail email body:', error);
    throw new Error(`Failed to fetch email body: ${error.message}`);
  }
}

/**
 * Legacy function - kept for backward compatibility
 * @deprecated Use fetchGmailEmailMetadata instead
 */
export async function fetchGmailEmails(
  account: ConnectedAccount,
  maxResults: number = 50
): Promise<GmailMessage[]> {
  if (!account.oauth_access_token) {
    throw new Error('OAuth access token not found for this account');
  }

  try {
    const gmail = getGmailClient(account.oauth_access_token);
    
    // List messages
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults,
      q: 'is:unread OR in:inbox',
    });

    if (!response.data.messages || response.data.messages.length === 0) {
      return [];
    }

    // Fetch full message details
    const messages = await Promise.all(
      response.data.messages.map(async (msg) => {
        const message = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'full',
        });
        return message.data as GmailMessage;
      })
    );

    return messages;
  } catch (error: any) {
    logger.error('Error fetching Gmail emails:', error);
    throw new Error(`Failed to fetch Gmail emails: ${error.message}`);
  }
}

/**
 * Parse Gmail message metadata into conversation format
 * Used for initial sync (metadata only, no body)
 */
export function parseGmailMessageMetadata(message: GmailMessageMetadata) {
  const headers = message.headers || [];
  const getHeader = (name: string) => 
    headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  const from = getHeader('From');
  const subject = getHeader('Subject');
  const date = getHeader('Date');
  
  // Extract email from "Name <email@domain.com>" format
  const emailMatch = from.match(/<(.+)>/);
  const email = emailMatch ? emailMatch[1] : from;
  const name = from.replace(/<.+>/, '').trim() || email;

  return {
    messageId: message.id,
    threadId: message.threadId,
    from: {
      name,
      email,
    },
    subject,
    snippet: message.snippet,
    date: new Date(parseInt(message.internalDate)),
    timestamp: new Date(parseInt(message.internalDate)),
  };
}

/**
 * Parse Gmail message into conversation format (legacy, includes body)
 * @deprecated Use parseGmailMessageMetadata for initial sync
 */
export function parseGmailMessage(message: GmailMessage) {
  const headers = message.payload.headers || [];
  const getHeader = (name: string) => 
    headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  const from = getHeader('From');
  const subject = getHeader('Subject');
  const date = getHeader('Date');
  
  // Extract email from "Name <email@domain.com>" format
  const emailMatch = from.match(/<(.+)>/);
  const email = emailMatch ? emailMatch[1] : from;
  const name = from.replace(/<.+>/, '').trim() || email;

  // Get message body
  let body = '';
  if (message.payload.body?.data) {
    body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
  } else if (message.payload.parts) {
    const textPart = message.payload.parts.find(p => 
      p.mimeType === 'text/plain' || p.mimeType === 'text/html'
    );
    if (textPart?.body?.data) {
      body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
    }
  }

  return {
    messageId: message.id,
    threadId: message.threadId,
    from: {
      name,
      email,
    },
    subject,
    body: body || message.snippet,
    date: new Date(parseInt(message.internalDate)),
    snippet: message.snippet,
  };
}

/**
 * Refresh Gmail access token
 */
export async function refreshGmailToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const { refreshAccessToken } = require('../utils/oauth');
  return await refreshAccessToken(refreshToken);
}

