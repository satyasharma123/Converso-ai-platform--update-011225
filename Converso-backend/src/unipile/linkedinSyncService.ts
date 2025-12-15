import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../utils/logger';
import { unipileGet } from './unipileClient';
import { mapConversation, UnipileAttendee, UnipileChat } from './linkedinConversationMapper';
import { mapMessage, UnipileMessage } from './linkedinMessageMapper';

interface ListResponse<T> {
  items?: T[];
}

const CHAT_LIST_PATH = '/api/v1/chats?provider=linkedin';
const CHAT_ATTENDEES_PATH = (chatId: string) => `/api/v1/chats/${chatId}/attendees`;
const ATTENDEE_PICTURE_PATH = (attendeeId: string) => `/api/v1/chat_attendees/${attendeeId}/picture`;
const CHAT_MESSAGES_PATH = (chatId: string, from?: string) =>
  from ? `/api/v1/chats/${chatId}/messages?from=${encodeURIComponent(from)}` : `/api/v1/chats/${chatId}/messages`;

function safeTimestamp(msg: UnipileMessage) {
  return msg.timestamp || msg.datetime || msg.date || null;
}

interface EnrichedAttendee extends UnipileAttendee {
  profile_url?: string | null;
}

function buildProfileUrl(identifier?: string | null) {
  return identifier ? `https://www.linkedin.com/in/${identifier}` : null;
}

function isSelfAttendee(value: any) {
  if (value === true) return true;
  if (value === false) return false;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') return value === '1';
  return false;
}

async function fetchChatContext(
  chatId: string,
  accountId?: string
): Promise<{ primary: EnrichedAttendee | null; pictureUrl: string | null; attendeeMap: Map<string, EnrichedAttendee> }> {
  try {
    const attendeesResp = await unipileGet<ListResponse<UnipileAttendee>>(
      `${CHAT_ATTENDEES_PATH(chatId)}${accountId ? `?account_id=${encodeURIComponent(accountId)}` : ''}`
    );
    const attendees = attendeesResp.items || [];
    const attendeeMap = new Map<string, EnrichedAttendee>();
    attendees.forEach((att) => {
      attendeeMap.set(att.id, {
        ...att,
        profile_url: buildProfileUrl(att.public_identifier || att.provider_id || ''),
      });
    });

    const primary =
      attendees.find((a) => !isSelfAttendee(a.is_self) && a.id) ||
      attendees.find((a) => a.id) ||
      null;

    let pictureUrl: string | null = null;
    if (primary?.id) {
    try {
      const picResp = await unipileGet<{ url?: string }>(
          `${ATTENDEE_PICTURE_PATH(primary.id)}${accountId ? `?account_id=${encodeURIComponent(accountId)}` : ''}`
      );
      pictureUrl = picResp?.url || null;
    } catch (err) {
        logger.warn(`[LinkedIn Sync] Could not fetch picture for attendee ${primary.id} of chat ${chatId}`);
      }
    }

    return { primary: primary ? attendeeMap.get(primary.id) || primary : null, pictureUrl, attendeeMap };
  } catch (err) {
    logger.error(`[LinkedIn Sync] Failed fetching attendees for chat ${chatId}`, err);
    return { primary: null, pictureUrl: null, attendeeMap: new Map() };
  }
}

async function fetchAttendeeById(
  attendeeId: string,
  attendeeMap: Map<string, EnrichedAttendee>,
  accountId?: string
): Promise<EnrichedAttendee | null> {
  if (!attendeeId) return null;
  if (attendeeMap.has(attendeeId)) {
    return attendeeMap.get(attendeeId)!;
  }
  try {
    const attendee = await unipileGet<UnipileAttendee>(
      `/api/v1/chat_attendees/${attendeeId}${accountId ? `?account_id=${encodeURIComponent(accountId)}` : ''}`
    );
    const enriched: EnrichedAttendee = {
      ...attendee,
      profile_url: buildProfileUrl(attendee.public_identifier || attendee.provider_id || ''),
    };
    attendeeMap.set(attendeeId, enriched);
    return enriched;
  } catch (err) {
    logger.warn(`[LinkedIn Sync] Failed fetching attendee ${attendeeId}`, err);
    return null;
  }
}

async function upsertConversation(record: ReturnType<typeof mapConversation>) {
  const { error } = await supabaseAdmin
    .from('conversations')
    .upsert(record, { onConflict: 'id' });
  if (error) {
    logger.error('[LinkedIn Sync] Failed upserting conversation', { error, record });
  }
}

async function upsertMessages(records: ReturnType<typeof mapMessage>[]) {
  if (!records.length) return;
  const { error } = await supabaseAdmin
    .from('messages')
    .upsert(records, { onConflict: 'linkedin_message_id' });
  if (error) {
    logger.error('[LinkedIn Sync] Failed upserting messages batch', error);
  }
}

async function fetchMessages(chatId: string, accountId?: string, from?: string): Promise<UnipileMessage[]> {
  const path = `${CHAT_MESSAGES_PATH(chatId, from)}${accountId ? (from ? `&account_id=${encodeURIComponent(accountId)}` : `?account_id=${encodeURIComponent(accountId)}`) : ''}`;
  const resp = await unipileGet<ListResponse<UnipileMessage>>(path);
  return resp.items || [];
}

export async function runFullLinkedInSync(connectedAccountId: string) {
  const { data: account, error: accountError } = await supabaseAdmin
    .from('connected_accounts')
    .select('*')
    .eq('id', connectedAccountId)
    .eq('account_type', 'linkedin')
    .single();

  if (accountError || !account) {
    throw new Error(`LinkedIn account not found: ${connectedAccountId}`);
  }

  const unipileAccountId = account.unipile_account_id;
  if (!unipileAccountId) {
    throw new Error(`LinkedIn account ${connectedAccountId} missing unipile_account_id`);
  }

  logger.info(`[LinkedIn Sync] Starting full sync for account ${connectedAccountId}`);

const allChatsResp = await unipileGet<ListResponse<UnipileChat>>(
  `/api/v1/chats?provider=linkedin`
  );
const chats = (allChatsResp.items || []).filter(chat => chat.account_id === unipileAccountId);
  logger.info(`[LinkedIn Sync] Found ${chats.length} chats`);

  let conversationsCount = 0;
  let messagesCount = 0;

  for (const chat of chats) {
    try {
      const { primary, pictureUrl, attendeeMap } = await fetchChatContext(chat.id, unipileAccountId);
      const messages = await fetchMessages(chat.id, unipileAccountId);
      // Identify the latest message (for timestamp + preview)
      const latestMessage = messages
        .map((msg) => ({ msg, ts: safeTimestamp(msg) }))
        .filter((entry) => entry.ts)
        .sort((a, b) => (a.ts! < b.ts! ? -1 : 1))
        .pop();

      const latestTs = latestMessage?.ts || chat.updated_at || null;
      const previewText = (() => {
        if (!latestMessage?.msg) {
          logger.debug(`[LinkedIn Sync] No latest message for chat ${chat.id}`);
          return null;
        }
        const m = latestMessage.msg as any;
        const preview = (
          m.text ||
          m.body_text ||
          m.content ||
          m.body ||
          m.snippet ||
          m.preview ||
          m.subject ||
          null
        );
        logger.debug(`[LinkedIn Sync] Chat ${chat.id} preview extracted:`, { 
          hasMessage: !!latestMessage?.msg,
          fields: {
            text: !!m.text,
            body_text: !!m.body_text,
            content: !!m.content,
            body: !!m.body,
            snippet: !!m.snippet,
            preview: !!m.preview,
            subject: !!m.subject
          },
          previewLength: preview ? String(preview).length : 0,
          preview: preview ? String(preview).substring(0, 50) : null
        });
        return preview;
      })();

      const conversation = mapConversation(
        chat,
        primary,
        pictureUrl,
        latestTs,
        { accountId: account.id, workspaceId: account.workspace_id || null },
        previewText ? String(previewText).trim() : null
      );
      logger.debug(`[LinkedIn Sync] Upserting conversation ${conversation.id} with preview:`, {
        hasPreview: !!conversation.preview,
        previewLength: conversation.preview?.length || 0
      });
      await upsertConversation(conversation);
      conversationsCount++;

      const messageRecords: ReturnType<typeof mapMessage>[] = [];
      for (const message of messages) {
        const attendeeId = message.sender_attendee_id || (message as any).sender_id || null;
        const attendeeDetails = attendeeId
          ? await fetchAttendeeById(attendeeId, attendeeMap, unipileAccountId)
          : primary;
        const senderName =
          attendeeDetails?.name ||
          attendeeDetails?.display_name ||
          attendeeDetails?.public_identifier ||
          null;
        const senderLinkedinUrl = attendeeDetails?.profile_url || buildProfileUrl(attendeeDetails?.public_identifier || null);

        messageRecords.push(
        mapMessage(
            { ...message, sender_attendee_id: attendeeId || message.sender_attendee_id || null },
          conversation.id,
          senderName,
          senderLinkedinUrl
        )
      );
      }

      await upsertMessages(messageRecords);
      messagesCount += messageRecords.length;
      logger.info(`[LinkedIn Sync] Synced chat ${chat.id} (${messageRecords.length} messages)`);
    } catch (err) {
      logger.error(`[LinkedIn Sync] Failed chat ${chat.id}`, err);
    }
  }

  await supabaseAdmin
    .from('connected_accounts')
    .update({
      last_synced_at: new Date().toISOString(),
      sync_status: 'success',
      sync_error: null,
    })
    .eq('id', connectedAccountId);

  return { conversations: conversationsCount, messages: messagesCount };
}

// Used by webhook incremental sync
export async function syncChatIncremental(unipileAccountId: string, chatId: string, fromTimestamp?: string) {
  const { data: account, error } = await supabaseAdmin
    .from('connected_accounts')
    .select('id, workspace_id')
    .eq('account_type', 'linkedin')
    .eq('unipile_account_id', unipileAccountId)
    .single();

  if (error || !account) {
    throw new Error(`LinkedIn account with unipile_account_id ${unipileAccountId} not found`);
  }

  const { primary, pictureUrl, attendeeMap } = await fetchChatContext(chatId, unipileAccountId);
  const messages = await fetchMessages(chatId, unipileAccountId, fromTimestamp);
  
  // Identify the latest message (for timestamp + preview)
  const latestMessage = messages
    .map((msg) => ({ msg, ts: safeTimestamp(msg) }))
    .filter((entry) => entry.ts)
    .sort((a, b) => (a.ts! < b.ts! ? -1 : 1))
    .pop();

  const latestTs = latestMessage?.ts || null;
  const previewText = (() => {
    if (!latestMessage?.msg) return null;
    const m = latestMessage.msg as any;
    return (
      m.text ||
      m.body_text ||
      m.content ||
      m.body ||
      m.snippet ||
      m.preview ||
      m.subject ||
      null
    );
  })();

  const conversation = mapConversation(
    { id: chatId, updated_at: latestTs },
    primary,
    pictureUrl,
    latestTs,
    { accountId: account.id, workspaceId: account.workspace_id || null },
    previewText ? String(previewText).trim() : null
  );
  await upsertConversation(conversation);

  const messageRecords: ReturnType<typeof mapMessage>[] = [];
  for (const message of messages) {
    const attendeeId = message.sender_attendee_id || (message as any).sender_id || null;
    const attendeeDetails = attendeeId
      ? await fetchAttendeeById(attendeeId, attendeeMap, unipileAccountId)
      : primary;
    const senderName =
      attendeeDetails?.name ||
      attendeeDetails?.display_name ||
      attendeeDetails?.public_identifier ||
      null;
    const senderLinkedinUrl = attendeeDetails?.profile_url || buildProfileUrl(attendeeDetails?.public_identifier || null);

    messageRecords.push(
    mapMessage(
        { ...message, sender_attendee_id: attendeeId || message.sender_attendee_id || null },
      conversation.id,
      senderName,
      senderLinkedinUrl
    )
  );
  }
  await upsertMessages(messageRecords);
  logger.info(`[LinkedIn Sync] Incremental sync for chat ${chatId} (${messages.length} messages)`);
}
