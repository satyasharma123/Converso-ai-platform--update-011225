import crypto from 'crypto';

export interface UnipileMessage {
  id: string;
  chat_id: string;
  text?: string | null;
  body_text?: string | null;
  timestamp?: string | null;
  datetime?: string | null;
  date?: string | null;
  is_sender?: boolean;
  sender_attendee_id?: string | null;
  sender_provider_id?: string | null;
  attachments?: any[];
  reactions?: any[];
}

export interface MessageRecord {
  id: string;
  conversation_id: string;
  message_type: 'linkedin';
  linkedin_message_id: string;
  sender_attendee_id?: string | null;
  sender_name?: string | null;
  sender_linkedin_url?: string | null;
  content: string;
  created_at: string;
  is_from_lead: boolean;
  attachments?: any[] | null;
  reactions?: any[] | null;
  media_id?: string | null;
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

export function mapMessage(
  message: UnipileMessage,
  conversationId: string,
  senderName: string | null,
  senderLinkedinUrl: string | null
): MessageRecord {
  const createdAt =
    message.timestamp ||
    message.datetime ||
    message.date ||
    new Date().toISOString();

  // Extract media_id from first attachment with media.id (Unipile official payload)
  let media_id: string | null = null;
  if (Array.isArray(message.attachments)) {
    const mediaAttachment = message.attachments.find(
      (att) => att?.media?.id
    );
    if (mediaAttachment) {
      media_id = mediaAttachment.media.id;
    }
  }

  return {
    id: deterministicId(`msg-${message.id}`),
    conversation_id: conversationId,
    message_type: 'linkedin',
    linkedin_message_id: message.id,
    sender_attendee_id: message.sender_attendee_id || null,
    sender_name: senderName || undefined,
    sender_linkedin_url: senderLinkedinUrl || undefined,
    content: message.text || message.body_text || '',
    created_at: createdAt,
    is_from_lead: !message.is_sender,
    attachments: message.attachments ?? null,
    reactions: message.reactions ?? null,
    media_id: media_id,
  };
}
