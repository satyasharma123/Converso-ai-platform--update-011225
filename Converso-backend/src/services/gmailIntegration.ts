/**
 * Gmail API Integration Service
 * Handles fetching emails from Gmail using OAuth tokens
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

/**
 * Get Gmail API client using OAuth token
 */
function getGmailClient(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.gmail({ version: 'v1', auth: oauth2Client });
}

/**
 * Fetch emails from Gmail account
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
      q: 'is:unread OR in:inbox', // Fetch unread or inbox messages
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
 * Parse Gmail message into conversation format
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

