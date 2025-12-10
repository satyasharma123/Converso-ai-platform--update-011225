# Unipile Directory Reference

## Overview
The `Converso-backend/src/unipile/` directory contains all LinkedIn integration logic using the Unipile API.

## File Structure

```
Converso-backend/src/unipile/
├── linkedinSync.4actions.ts          ← Main sync implementation
├── linkedinWebhookHandler.ts         ← Webhook event processor
├── linkedinWebhook.4actions.ts       ← (Alternative webhook implementation?)
├── linkedinConversationMapper.ts     ← Maps Unipile chats to conversations
├── linkedinMessageMapper.ts          ← Maps Unipile messages to messages
├── unipileClient.ts                  ← HTTP client for Unipile API
└── addLinkedInColumns.sql            ← Database schema updates
```

## Core Files

### 1. `linkedinSync.4actions.ts` ⭐ PRIMARY SYNC
**Purpose**: Complete LinkedIn sync implementation with 4-phase pipeline

**Exports**:
- `runFullLinkedInSync4Actions(connectedAccountId)` - Full account sync
- `syncChatIncremental(unipileAccountId, chatId, fromTimestamp?)` - Webhook incremental sync
- `syncLinkedInChatsForAccount()` - Action 1: Download chats
- `enrichLinkedInSendersFromAttendees()` - Action 2: Enrich sender details
- `enrichLinkedInSenderPictures()` - Action 3: Fetch profile pictures
- `syncLinkedInMessagesForAccount()` - Action 4: Download messages

**4-Phase Pipeline**:
1. **Action 1**: Download all LinkedIn chats → Store as conversations
2. **Action 2**: Fetch sender details from attendee API → Enrich conversations
3. **Action 3**: Fetch profile pictures → Add to conversations
4. **Action 4**: Download all messages per chat → Store messages

**Used By**:
- `POST /api/linkedin/accounts/start-auth` (auto-sync after connection)
- `POST /api/linkedin/accounts/:id/initial-sync` (manual sync)
- `POST /api/linkedin/sync` (sync all accounts)
- `POST /api/linkedin/messages/sync` (admin sync)
- Webhook handler (incremental sync)

### 2. `linkedinWebhookHandler.ts`
**Purpose**: Process incoming webhook events from Unipile

**Exports**:
- `handleLinkedInWebhook(req, res)` - Express handler

**Event Types Handled**:
- `message.created` - New message received
- `message.updated` - Message edited
- `chat.updated` - Chat metadata changed

**Flow**:
1. Receives webhook event
2. Validates `chat_id` and `account_id`
3. Calls `syncChatIncremental()` to fetch only new messages
4. Updates conversation in real-time

### 3. `linkedinWebhook.4actions.ts`
**Purpose**: Unknown - possibly alternative webhook implementation

**Status**: Needs investigation (is this used?)

### 4. `linkedinConversationMapper.ts`
**Purpose**: Transform Unipile chat objects into Supabase conversation records

**Key Functions**:
- `mapConversation(chat, attendee, pictureUrl, lastMessageAt, context)` - Maps chat data
- `deterministicId(seed)` - Generates consistent UUIDs from chat IDs

**Maps**:
- Unipile `chat.id` → Supabase `conversations.chat_id`
- Chat participant → `sender_name`, `sender_linkedin_url`
- Last message timestamp → `last_message_at`

### 5. `linkedinMessageMapper.ts`
**Purpose**: Transform Unipile message objects into Supabase message records

**Key Functions**:
- `mapMessage(message, conversationId, senderName, senderLinkedinUrl)` - Maps message data

**Maps**:
- Unipile `message.id` → Supabase `messages.linkedin_message_id`
- Message text → `content`
- Sender info → `sender_name`, `sender_linkedin_url`
- Timestamp → `created_at`
- Direction → `is_from_lead`

### 6. `unipileClient.ts`
**Purpose**: HTTP client for making requests to Unipile API

**Exports**:
- `unipileGet<T>(path)` - GET request
- `unipilePost<T>(path, body)` - POST request
- `unipileDelete(path)` - DELETE request

**Features**:
- Automatic authentication with API key
- Base URL configuration
- Error handling
- TypeScript generic support

### 7. `addLinkedInColumns.sql`
**Purpose**: Database migration for LinkedIn-specific columns

**Likely Contains**:
- `conversations` table columns for LinkedIn
- `messages` table columns for LinkedIn
- Indexes for performance

## Data Flow

### Full Sync Flow
```
User triggers sync
    ↓
runFullLinkedInSync4Actions()
    ↓
Action 1: syncLinkedInChatsForAccount()
    ├→ unipileGet('/chats')
    └→ Insert into conversations table
    ↓
Action 2: enrichLinkedInSendersFromAttendees()
    ├→ unipileGet('/chat_attendees/{id}')
    └→ Update conversations with sender info
    ↓
Action 3: enrichLinkedInSenderPictures()
    ├→ unipileGet('/chat_attendees/{id}/picture')
    └→ Update conversations with pictures
    ↓
Action 4: syncLinkedInMessagesForAccount()
    ├→ unipileGet('/chats/{id}/messages')
    ├→ Map messages with linkedinMessageMapper
    └→ Insert into messages table
```

### Webhook Incremental Sync Flow
```
Unipile webhook event
    ↓
handleLinkedInWebhook()
    ↓
syncChatIncremental()
    ├→ Find existing conversation
    ├→ unipileGet('/chats/{id}/messages?from={timestamp}')
    ├→ Map new messages
    └→ Upsert into messages table
```

## Dependencies

### Internal
- `../lib/supabase` - Database client
- `../utils/logger` - Logging
- `../config/unipile` - Unipile configuration

### External
- `crypto` - For deterministic UUID generation
- Unipile API endpoints

## Database Tables Used

### `conversations`
- `chat_id` (unique) - Unipile chat ID
- `sender_attendee_id` - Unipile attendee ID
- `sender_name` - Contact name
- `sender_linkedin_url` - LinkedIn profile URL
- `sender_profile_picture_url` - Profile picture
- `initial_sync_done` - Flag for Action 4 completion
- `sender_enriched` - Flag for Action 2 completion
- `picture_enriched` - Flag for Action 3 completion

### `messages`
- `linkedin_message_id` (unique) - Unipile message ID
- `conversation_id` - FK to conversations
- `sender_attendee_id` - Message sender
- `sender_name` - Sender name
- `sender_linkedin_url` - Sender LinkedIn URL
- `content` - Message text
- `is_from_lead` - Direction (true = from contact, false = from user)

### `connected_accounts`
- `unipile_account_id` - Unipile account identifier
- `last_synced_at` - Last successful sync timestamp
- `sync_status` - 'syncing', 'success', 'error'
- `sync_error` - Error message if failed

## Key Concepts

### Deterministic IDs
UUIDs are generated consistently from Unipile IDs:
```typescript
deterministicId('chat-{unipile_chat_id}') → conversation.id
deterministicId('msg-{unipile_message_id}') → message.id
```

This allows idempotent operations - same Unipile data always produces same UUID.

### Upsert Strategy
All database operations use `upsert` with conflict resolution:
- Conversations: conflict on `chat_id`
- Messages: conflict on `linkedin_message_id`

This makes sync operations idempotent and safe to retry.

### Progress Tracking
Conversations have flags to track sync progress:
- `initial_sync_done: false` → Action 4 will process
- `sender_enriched: false` → Action 2 will process
- `picture_enriched: false` → Action 3 will process

This allows resuming partial syncs and processing in batches.

## Best Practices

1. **Always use the 4actions implementation** - It's the only sync code now
2. **Don't skip actions** - Each action enriches data for the next
3. **Handle rate limits** - Action 4 has rate limit detection
4. **Use incremental sync for webhooks** - Don't full sync on every webhook
5. **Never null sender_name** - Always fallback to 'LinkedIn Contact' or 'You'

## Future Improvements (Optional)

- [ ] Add pagination support for large chat lists
- [ ] Implement selective sync (only changed conversations)
- [ ] Add retry logic with exponential backoff
- [ ] Cache attendee data to reduce API calls
- [ ] Add sync metrics/monitoring
- [ ] Parallelize Action 4 (process multiple chats simultaneously)

---

**Last Updated**: December 8, 2025  
**Maintainer**: Converso AI Platform Team
