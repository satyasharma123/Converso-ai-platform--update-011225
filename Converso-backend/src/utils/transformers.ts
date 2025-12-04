/**
 * Transform database records to frontend-friendly format
 * Converts snake_case to camelCase
 */

import type { Conversation, Message } from '../types';

export function transformConversation(conv: Conversation): any {
  const canonicalTimestamp = conv.email_timestamp || conv.last_message_at;

  return {
    id: conv.id,
    senderName: conv.sender_name,
    sender_name: conv.sender_name, // Keep both for compatibility
    senderEmail: conv.sender_email,
    sender_email: conv.sender_email, // Keep both
    senderLinkedinUrl: conv.sender_linkedin_url,
    sender_linkedin_url: conv.sender_linkedin_url, // Keep both
    subject: conv.subject,
    preview: conv.preview,
    timestamp: canonicalTimestamp,
    lastMessageAt: canonicalTimestamp,
    type: conv.conversation_type,
    conversationType: conv.conversation_type,
    status: conv.status,
    isRead: conv.is_read,
    is_read: conv.is_read, // Keep both for compatibility
    isFavorite: conv.is_favorite || false,
    is_favorite: conv.is_favorite || false,
    assignedTo: conv.assigned_to,
    assigned_to: conv.assigned_to, // Keep both
    customStageId: conv.custom_stage_id,
    custom_stage_id: conv.custom_stage_id, // Keep both for compatibility
    receivedAccount: conv.received_account,
    received_account: conv.received_account, // Keep both
    receivedOnAccountId: conv.received_on_account_id,
    received_on_account_id: conv.received_on_account_id,
    emailFolder: conv.email_folder || 'inbox',
    email_folder: conv.email_folder || 'inbox',
    companyName: conv.company_name,
    company_name: conv.company_name, // Keep both
    location: conv.location,
    // Email-specific fields
    email_body: (conv as any).email_body || null,
    has_full_body: conv.has_full_body || (conv as any).has_full_body || false,
    hasFullBody: conv.has_full_body || (conv as any).has_full_body || false,
    email_timestamp: conv.email_timestamp || null,
    emailTimestamp: conv.email_timestamp || null,
    email_attachments: (conv as any).email_attachments || [],
    emailAttachments: (conv as any).email_attachments || [],
    gmail_message_id: conv.gmail_message_id || (conv as any).gmail_message_id || null,
    outlook_message_id: conv.outlook_message_id || (conv as any).outlook_message_id || null,
  };
}

export function transformMessage(msg: Message): any {
  return {
    id: msg.id,
    conversationId: msg.conversation_id,
    senderId: msg.sender_id,
    senderName: msg.sender_name,
    content: msg.content,
    email_body: (msg as any).email_body || null,
    isFromLead: msg.is_from_lead,
    createdAt: msg.created_at,
    timestamp: msg.created_at,
    // Keep snake_case for compatibility
    conversation_id: msg.conversation_id,
    sender_id: msg.sender_id,
    is_from_lead: msg.is_from_lead,
    created_at: msg.created_at,
  };
}

export function transformConversations(conversations: Conversation[]): any[] {
  return conversations.map(transformConversation);
}

export function transformMessages(messages: Message[]): any[] {
  return messages.map(transformMessage);
}

