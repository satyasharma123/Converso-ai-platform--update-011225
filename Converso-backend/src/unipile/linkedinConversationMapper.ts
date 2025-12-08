import crypto from 'crypto';

export interface UnipileChat {
  id: string;
  title?: string | null;
  updated_at?: string | null;
  account_id?: string | null;
}

export interface UnipileAttendee {
  id: string;
  name?: string | null;
  display_name?: string | null;
  public_identifier?: string | null;
  is_self?: boolean | number;
  provider_id?: string | null;
  specifics?: {
    member_urn?: string | null;
  };
}

export interface ConversationRecord {
  id: string;
  chat_id: string;
  conversation_type: 'linkedin';
  sender_name: string;
  sender_email?: string | null;
  sender_attendee_id?: string | null;
  sender_linkedin_url?: string | null;
  sender_profile_picture_url?: string | null;
  provider_member_urn?: string | null;
  subject?: string | null;
  preview?: string | null;
  last_message_at?: string | null;
  is_read?: boolean;
  received_on_account_id?: string | null;
  workspace_id?: string | null;
}

export function deterministicId(seed: string) {
  const hex = crypto.createHash('sha1').update(seed).digest('hex');
  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    hex.substring(12, 16),
    hex.substring(16, 20),
    hex.substring(20, 32),
  ].join('-');
}

interface ConversationOptions {
  accountId?: string | null;
  workspaceId?: string | null;
}

export function mapConversation(
  chat: UnipileChat,
  attendee: UnipileAttendee | null,
  pictureUrl: string | null,
  lastMessageAt: string | null,
  options: ConversationOptions = {}
): ConversationRecord {
  const id = deterministicId(`chat-${chat.id}`);
  const senderName =
    attendee?.name ||
    attendee?.display_name ||
    attendee?.public_identifier ||
    'LinkedIn Contact';
  const senderLinkedinUrl = attendee?.public_identifier
    ? `https://www.linkedin.com/in/${attendee.public_identifier}`
    : null;

  return {
    id,
    chat_id: chat.id,
    conversation_type: 'linkedin',
    sender_name: senderName,
    sender_email: null,
    sender_attendee_id: attendee?.id || null,
    sender_linkedin_url: senderLinkedinUrl,
    sender_profile_picture_url: pictureUrl || null,
    provider_member_urn: attendee?.specifics?.member_urn || attendee?.provider_id || null,
    subject: chat.title || null,
    preview: null,
    last_message_at: lastMessageAt,
    is_read: true,
    received_on_account_id: options.accountId || null,
    workspace_id: options.workspaceId || null,
  };
}
