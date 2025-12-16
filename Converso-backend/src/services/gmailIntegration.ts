/**
 * Gmail API Integration Service
 * Handles fetching emails from Gmail using OAuth tokens
 * Implements industry-standard sync: 90 days initial, metadata only, lazy load body
 */

import { google } from 'googleapis';
import { logger } from '../utils/logger';
import type { ConnectedAccount, EmailAttachment } from '../types';

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
  folder?: string; // Track which folder this email belongs to
}

export interface GmailEmailBodyResult {
  body: string; // Kept for backward compatibility
  htmlBody: string; // Explicit HTML content
  textBody: string; // Explicit text content
  attachments: EmailAttachment[];
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
 * Fetch email metadata from Gmail for a specific folder
 * Returns only metadata, not full body for performance
 * Supports incremental sync via sinceDate parameter
 */
export async function fetchGmailEmailMetadata(
  account: ConnectedAccount,
  daysBack: number = 90,
  pageToken?: string,
  folder: string = 'inbox',
  sinceDate?: Date // For incremental sync - fetch emails since this date
): Promise<{
  messages: GmailMessageMetadata[];
  nextPageToken?: string;
}> {
  if (!account.oauth_access_token) {
    throw new Error('OAuth access token not found for this account');
  }

  try {
    const gmail = getGmailClient(account.oauth_access_token);
    
    // Use sinceDate for incremental sync, or daysBack for initial sync
    const afterTimestamp = sinceDate 
      ? Math.floor(sinceDate.getTime() / 1000)
      : getDaysAgoTimestamp(daysBack);
    
    // Build query based on folder
    let query = `after:${afterTimestamp}`;
    switch (folder) {
      case 'inbox':
        query += ' in:inbox';
        break;
      case 'sent':
        query += ' in:sent';
        break;
      case 'important':
        query += ' is:starred';
        break;
      case 'drafts':
        query += ' in:drafts';
        break;
      case 'archive':
        query += ' -in:inbox -in:sent -in:drafts -in:trash';
        break;
      case 'deleted':
        query += ' in:trash';
        break;
      default:
        query += ' in:inbox';
    }
    
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
          folder: folder, // Track which folder this email belongs to
        } as GmailMessageMetadata;
      })
    );

    return {
      messages,
      nextPageToken: response.data.nextPageToken || undefined,
    };
  } catch (error: any) {
    logger.error(`Error fetching Gmail email metadata for folder ${folder}:`, error);
    throw new Error(`Failed to fetch Gmail emails from ${folder}: ${error.message}`);
  }
}

/**
 * Fetch full email body from Gmail API (on-demand)
 * Used when user opens an email
 */
export async function fetchGmailEmailBody(
  account: ConnectedAccount,
  messageId: string
): Promise<GmailEmailBodyResult> {
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
      return { body: '', attachments: [] };
    }

    let htmlBody = '';
    let textBody = '';
    const attachments: EmailAttachment[] = [];

    const extractBodyFromParts = (parts: any[]): { html: string; text: string } => {
      let extractedHtml = '';
      let extractedText = '';

      for (const part of parts) {
        const headers = part.headers || [];
        const mimeType = part.mimeType?.toLowerCase() || '';
        const filename = part.filename || '';
        const attachmentId = part.body?.attachmentId;
        const contentDisposition = headers.find((h: any) => h.name?.toLowerCase() === 'content-disposition')?.value?.toLowerCase() || '';
        const contentIdHeader = headers.find((h: any) => h.name?.toLowerCase() === 'content-id')?.value || '';
        const normalizedContentId = contentIdHeader?.replace(/[<>]/g, '') || undefined;
        const isInline = contentDisposition.includes('inline') || Boolean(contentIdHeader);

        const isAttachmentCandidate =
          Boolean(attachmentId || filename) &&
          !['text/plain', 'text/html'].includes(mimeType);

        if (isAttachmentCandidate) {
          attachments.push({
            id: attachmentId || part.partId || `${mimeType}-${attachments.length}`,
            filename: filename || normalizedContentId || 'attachment',
            mimeType: part.mimeType,
            size: part.body?.size,
            isInline,
            contentId: normalizedContentId,
            provider: 'gmail',
          });
          continue;
        }

        // Recursively extract from nested parts
        if (part.parts && part.parts.length > 0) {
          const nestedBody = extractBodyFromParts(part.parts);
          if (nestedBody.html) extractedHtml = nestedBody.html;
          if (nestedBody.text) extractedText = nestedBody.text;
        }

        // Extract body content - PREFER HTML OVER TEXT
        if (part.body?.data) {
          const partBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
          
          if (mimeType === 'text/html') {
            extractedHtml = partBody; // HTML takes priority
          } else if (mimeType === 'text/plain' && !extractedText) {
            extractedText = partBody; // Only use text if we don't have it yet
          }
        }
      }

      return { html: extractedHtml, text: extractedText };
    };

    // Single-part message (body directly in payload)
    if (payload.body?.data) {
      const bodyContent = Buffer.from(payload.body.data, 'base64').toString('utf-8');
      const mimeType = payload.mimeType?.toLowerCase() || '';
      
      if (mimeType === 'text/html') {
        htmlBody = bodyContent;
      } else {
        textBody = bodyContent;
      }
    } 
    // Multi-part message (body in parts)
    else if (payload.parts && payload.parts.length > 0) {
      const extracted = extractBodyFromParts(payload.parts);
      htmlBody = extracted.html;
      textBody = extracted.text;
    }

    // Final body priority: HTML > Text
    const finalBody = htmlBody || textBody;

    logger.info(`[Gmail] Fetched email body for ${messageId}: HTML=${htmlBody.length}b, Text=${textBody.length}b`);

    return {
      body: finalBody, // Backward compatibility
      htmlBody,
      textBody,
      attachments,
    };
  } catch (error: any) {
    logger.error('Error fetching Gmail email body:', error);
    throw new Error(`Failed to fetch email body: ${error.message}`);
  }
}

/**
 * Download Gmail attachment data
 */
export async function downloadGmailAttachment(
  account: ConnectedAccount,
  messageId: string,
  attachmentId: string
): Promise<Buffer> {
  if (!account.oauth_access_token) {
    throw new Error('OAuth access token not found for this account');
  }

  const gmail = getGmailClient(account.oauth_access_token);
  const response = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId,
    id: attachmentId,
  });

  if (!response.data.data) {
    return Buffer.alloc(0);
  }

  return Buffer.from(response.data.data, 'base64');
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
    folder: message.folder || 'inbox', // Include folder information
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

/**
 * Send an email via Gmail API
 * Supports reply, reply all, and forward
 */
export async function sendGmailEmail(
  account: ConnectedAccount,
  params: {
    to: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    subject: string;
    body: string;
    threadId?: string; // For replies
    inReplyTo?: string; // Message ID being replied to
    references?: string; // For threading
  }
): Promise<{ messageId: string; threadId: string }> {
  if (!account.oauth_access_token) {
    throw new Error('OAuth access token not found for this account');
  }

  try {
    const gmail = getGmailClient(account.oauth_access_token);

    // Convert arrays to comma-separated strings
    const toAddresses = Array.isArray(params.to) ? params.to.join(', ') : params.to;
    const ccAddresses = params.cc ? (Array.isArray(params.cc) ? params.cc.join(', ') : params.cc) : '';
    const bccAddresses = params.bcc ? (Array.isArray(params.bcc) ? params.bcc.join(', ') : params.bcc) : '';

    // Build RFC 2822 formatted email
    const messageParts = [
      `From: ${account.account_email}`,
      `To: ${toAddresses}`,
    ];

    if (ccAddresses) {
      messageParts.push(`Cc: ${ccAddresses}`);
    }

    if (bccAddresses) {
      messageParts.push(`Bcc: ${bccAddresses}`);
    }

    messageParts.push(`Subject: ${params.subject}`);
    messageParts.push('MIME-Version: 1.0');
    messageParts.push('Content-Type: text/html; charset=utf-8');

    // Add threading headers for replies
    if (params.inReplyTo) {
      messageParts.push(`In-Reply-To: ${params.inReplyTo}`);
    }

    if (params.references) {
      messageParts.push(`References: ${params.references}`);
    }

    messageParts.push('');
    messageParts.push(params.body);

    const message = messageParts.join('\r\n');
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send the email
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
        threadId: params.threadId, // Maintains thread for replies
      },
    });

    logger.info(`[Gmail] Email sent successfully: ${response.data.id}`);

    return {
      messageId: response.data.id!,
      threadId: response.data.threadId!,
    };
  } catch (error: any) {
    logger.error('Error sending Gmail email:', error);
    throw new Error(`Failed to send email via Gmail: ${error.message}`);
  }
}

