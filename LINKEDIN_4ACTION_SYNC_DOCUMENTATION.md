# LinkedIn 4-Action Sync Implementation

This document describes the comprehensive LinkedIn DM sync pipeline implementation using Unipile APIs.

## Overview

The LinkedIn sync pipeline consists of **4 sequential actions** that work together to:
1. Download all LinkedIn chats
2. Enrich sender details (name, LinkedIn URL)
3. Fetch profile pictures
4. Download all messages

## Architecture

### Core Components

1. **linkedinSync.4actions.ts** - Main sync service with 4 action functions
2. **linkedinWebhook.4actions.ts** - Webhook handler for incremental updates
3. **linkedin.sync.routes.ts** - API routes for triggering sync actions
4. **Migration: 20251208000008_add_sync_tracking_columns.sql** - Database schema

### Database Schema

The `conversations` table has been extended with tracking columns:

```sql
- initial_sync_done: BOOLEAN (tracks if messages have been synced)
- sender_enriched: BOOLEAN (tracks if sender details are fetched)
- picture_enriched: BOOLEAN (tracks if profile picture is fetched)
- sender_attendee_id: TEXT (Unipile attendee ID)
- sender_profile_picture_url: TEXT (profile picture URL)
- sender_linkedin_url: TEXT (LinkedIn profile URL)
- linkedin_sender_id: TEXT (LinkedIn provider ID)
- provider_member_urn: TEXT (LinkedIn member URN)
- chat_id: TEXT (Unipile chat ID - unique)
- provider: TEXT ('linkedin')
```

The `messages` table includes:

```sql
- message_type: TEXT ('linkedin')
- linkedin_message_id: TEXT (unique - Unipile message ID)
- sender_attendee_id: TEXT (Unipile attendee ID)
- sender_name: TEXT NOT NULL (never null!)
- sender_linkedin_url: TEXT
- provider: TEXT ('linkedin')
- attachments: JSONB
- reactions: JSONB
```

## The 4 Actions

### Action 1: Initial Chat Download

**Function:** `syncLinkedInChatsForAccount(connectedAccountId, unipileAccountId)`

**What it does:**
- Calls Unipile `GET /chats?account_id={unipileAccountId}`
- Creates a conversation record for each chat
- Stores `chat_id`, `sender_attendee_id`, timestamps
- Sets tracking flags to `false` (not yet enriched)

**Example:**
```typescript
const result = await syncLinkedInChatsForAccount(
  'uuid-connected-account-id',
  'unipile-account-id'
);
// { chatsCount: 15 }
```

### Action 2: Sender Attendee Details

**Function:** `enrichLinkedInSendersFromAttendees()`

**What it does:**
- Queries all conversations where `sender_enriched = false`
- For each, calls Unipile `GET /chat_attendees/{sender_attendee_id}`
- Updates conversation with:
  - `sender_name` (from `name` or `display_name`)
  - `sender_linkedin_url` (from `profile_url` or built from `public_identifier`)
  - `linkedin_sender_id` (from `provider_id`)
  - `provider_member_urn` (from `specifics.member_urn`)
- Sets `sender_enriched = true`

**Fallback:**
- If API call fails, sets `sender_name = 'LinkedIn Contact'` and marks as enriched

**Example:**
```typescript
const result = await enrichLinkedInSendersFromAttendees();
// { enrichedCount: 15 }
```

### Action 3: Sender Profile Picture

**Function:** `enrichLinkedInSenderPictures()`

**What it does:**
- Queries all conversations where `picture_enriched = false`
- For each, calls Unipile `GET /chat_attendees/{sender_attendee_id}/picture`
- Stores picture URL in `sender_profile_picture_url`
- Sets `picture_enriched = true`

**Fallback:**
- If no picture available, marks as enriched anyway
- UI will display initials from `sender_name` (first + last name)

**Example:**
```typescript
const result = await enrichLinkedInSenderPictures();
// { enrichedCount: 15 }
```

### Action 4: Messages Per Chat

**Function:** `syncLinkedInMessagesForAccount(connectedAccountId)`

**What it does:**
- Queries all conversations where `initial_sync_done = false`
- For each chat, calls Unipile `GET /chats/{chat_id}/messages?account_id={unipileAccountId}`
- For each message:
  - Determines sender (lead vs. self)
  - Uses cached sender data from conversation record
  - **Ensures `sender_name` is NEVER null** (fallback to 'LinkedIn Contact' or 'You')
  - Inserts into `messages` table with upsert on `linkedin_message_id`
- Marks conversation as `initial_sync_done = true`

**Sender Resolution:**
- If `message.is_sender = true` → sender_name = 'You'
- If `message.is_sender = false` → use conversation's cached sender data
- Always fallback to 'LinkedIn Contact' if null

**Example:**
```typescript
const result = await syncLinkedInMessagesForAccount('uuid-connected-account-id');
// { messagesCount: 234, conversationsCount: 15 }
```

## Full Sync Orchestrator

**Function:** `runFullLinkedInSync4Actions(connectedAccountId)`

Runs all 4 actions in sequence:

```typescript
const result = await runFullLinkedInSync4Actions('uuid-connected-account-id');

// Returns:
{
  status: 'success',
  action1_chats: { chatsCount: 15 },
  action2_senders: { enrichedCount: 15 },
  action3_pictures: { enrichedCount: 15 },
  action4_messages: { messagesCount: 234, conversationsCount: 15 }
}
```

## API Endpoints

### Full Sync

```bash
POST /api/linkedin/sync/full
Body: { "connectedAccountId": "uuid" }

# Runs all 4 actions in sequence
```

### Individual Actions

```bash
# Action 1: Download chats
POST /api/linkedin/sync/action1
Body: { "connectedAccountId": "uuid" }

# Action 2: Enrich senders
POST /api/linkedin/sync/action2
Body: {}

# Action 3: Enrich pictures
POST /api/linkedin/sync/action3
Body: {}

# Action 4: Download messages
POST /api/linkedin/sync/action4
Body: { "connectedAccountId": "uuid" }
```

### Resume Sync

```bash
POST /api/linkedin/sync/resume
Body: { "connectedAccountId": "uuid" }

# Runs actions 2, 3, 4 for any incomplete items
# Useful if sync was interrupted
```

### Sync Status

```bash
GET /api/linkedin/sync/status?connectedAccountId=uuid

# Returns:
{
  "total_conversations": 15,
  "messages_synced": 15,
  "senders_enriched": 15,
  "pictures_enriched": 15,
  "pending_messages": 0,
  "pending_senders": 0,
  "pending_pictures": 0,
  "last_synced_at": "2025-12-08T10:00:00Z",
  "sync_status": "success"
}
```

## Webhook Implementation

### Webhook Handler

**File:** `linkedinWebhook.4actions.ts`

**Endpoint:** `POST /api/linkedin/webhook`

**What it does:**
1. Receives webhook event from Unipile
2. Verifies signature (if `UNIPILE_WEBHOOK_SECRET` is set)
3. Finds connected account by `unipile_account_id`
4. Ensures conversation exists (creates if new)
5. Fetches and enriches sender details (if new attendee)
6. Syncs new messages incrementally
7. Updates `last_message_at` timestamp

**Event Types Handled:**
- `message.created` - New message received
- `message.updated` - Message updated (edited, reaction added)
- `chat.updated` - Chat metadata updated

**Example Event:**
```json
{
  "type": "message.created",
  "chat_id": "urn:li:fs_conversation:abc123",
  "account_id": "unipile-account-id",
  "message_id": "msg-123",
  "timestamp": "2025-12-08T10:00:00Z"
}
```

**Signature Verification:**
```typescript
// Webhook secret in env
UNIPILE_WEBHOOK_SECRET=your-secret-here

// Signature header
x-unipile-signature: sha256-hmac-hex
```

### Incremental Sync

The webhook handler performs incremental sync:
- Only fetches new messages (using `from` timestamp parameter)
- Reuses cached attendee details (stored in conversation)
- Handles new attendees by fetching their details
- Never inserts messages with `sender_name = null`

## Integration with Account Connection

When a LinkedIn account is connected via OAuth:

**File:** `linkedin.accounts.routes.ts`

```typescript
// After successful OAuth callback
setImmediate(async () => {
  await runFullLinkedInSync4Actions(dbAccountId);
});
```

This automatically:
1. Downloads all chats
2. Enriches all senders
3. Fetches all profile pictures
4. Downloads all messages

## Rate Limiting

**File:** `unipileClient.ts`

Built-in rate limiter:
- Max 60 requests per minute
- Min 300ms gap between requests
- Automatic retry on 429 (rate limit) errors
- Waits when rate cap is reached

If rate limit is hit during sync:
- Sync stops gracefully
- Run `/api/linkedin/sync/resume` to continue later

## Error Handling

### Action 1 Errors
- Logs error and continues with next chat
- Tracks successful count

### Action 2 Errors
- On API failure: sets `sender_name = 'LinkedIn Contact'`
- Marks as enriched to avoid repeated failures

### Action 3 Errors
- On API failure: marks as enriched anyway
- UI falls back to displaying initials

### Action 4 Errors
- Logs error and continues with next conversation
- Checks for rate limit errors and stops if detected

## Testing the Implementation

### 1. Connect a LinkedIn Account

```bash
# Frontend: Go to Settings → Connect LinkedIn
# This triggers OAuth flow and auto-sync
```

### 2. Monitor Sync Progress

```bash
curl -X GET 'http://localhost:3001/api/linkedin/sync/status?connectedAccountId=YOUR_UUID'
```

### 3. Manual Full Sync

```bash
curl -X POST 'http://localhost:3001/api/linkedin/sync/full' \
  -H 'Content-Type: application/json' \
  -d '{"connectedAccountId":"YOUR_UUID"}'
```

### 4. Test Individual Actions

```bash
# Action 1
curl -X POST 'http://localhost:3001/api/linkedin/sync/action1' \
  -H 'Content-Type: application/json' \
  -d '{"connectedAccountId":"YOUR_UUID"}'

# Action 2
curl -X POST 'http://localhost:3001/api/linkedin/sync/action2' \
  -H 'Content-Type: application/json'

# Action 3
curl -X POST 'http://localhost:3001/api/linkedin/sync/action3' \
  -H 'Content-Type: application/json'

# Action 4
curl -X POST 'http://localhost:3001/api/linkedin/sync/action4' \
  -H 'Content-Type: application/json' \
  -d '{"connectedAccountId":"YOUR_UUID"}'
```

### 5. Test Webhook

```bash
curl -X POST 'http://localhost:3001/api/linkedin/webhook' \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "message.created",
    "chat_id": "urn:li:fs_conversation:abc123",
    "account_id": "YOUR_UNIPILE_ACCOUNT_ID",
    "timestamp": "2025-12-08T10:00:00Z"
  }'
```

## Database Queries for Verification

### Check Sync Status

```sql
-- Check conversation sync status
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN initial_sync_done THEN 1 ELSE 0 END) as synced_messages,
  SUM(CASE WHEN sender_enriched THEN 1 ELSE 0 END) as enriched_senders,
  SUM(CASE WHEN picture_enriched THEN 1 ELSE 0 END) as enriched_pictures
FROM conversations
WHERE conversation_type = 'linkedin';
```

### Check for Null Sender Names

```sql
-- Should return 0 rows!
SELECT id, conversation_id, content, sender_name
FROM messages
WHERE message_type = 'linkedin' 
  AND sender_name IS NULL;
```

### Check Recent Messages

```sql
SELECT 
  m.id,
  m.sender_name,
  m.content,
  m.created_at,
  m.is_from_lead,
  c.sender_name as conversation_sender
FROM messages m
JOIN conversations c ON m.conversation_id = c.id
WHERE m.message_type = 'linkedin'
ORDER BY m.created_at DESC
LIMIT 10;
```

## Environment Variables

Required:
```bash
UNIPILE_BASE_URL=https://api23.unipile.com:15315/api/v1
UNIPILE_API_KEY=your-api-key-here
```

Optional:
```bash
UNIPILE_WEBHOOK_SECRET=your-webhook-secret-here
```

## Key Differences from Previous Implementation

1. **Sequential Actions**: Sync is broken into 4 clear steps
2. **Tracking Flags**: Database tracks completion of each step
3. **Resumable**: Can resume from where it left off
4. **Never Null**: `sender_name` is NEVER null in messages
5. **Efficient**: Caches sender data in conversation table
6. **Webhook-Ready**: Incremental sync uses cached data
7. **Better Error Handling**: Graceful degradation on failures

## Troubleshooting

### Messages not syncing
- Check `initial_sync_done` flag in conversations
- Run Action 4 manually: `POST /api/linkedin/sync/action4`

### Sender names missing
- Check `sender_enriched` flag
- Run Action 2 manually: `POST /api/linkedin/sync/action2`

### Pictures not showing
- Check `picture_enriched` flag
- Run Action 3 manually: `POST /api/linkedin/sync/action3`
- UI should fallback to initials automatically

### Rate limit errors
- Wait 1 minute and run `POST /api/linkedin/sync/resume`
- Adjust rate limiter settings in `unipileClient.ts`

### Webhook not working
- Verify `UNIPILE_WEBHOOK_SECRET` is set correctly
- Check webhook URL is accessible from internet
- Review webhook logs in backend console

## Next Steps

1. Run the migration: `20251208000008_add_sync_tracking_columns.sql`
2. Restart backend server
3. Connect a LinkedIn account (auto-sync will trigger)
4. Monitor sync progress via status endpoint
5. Test webhook by sending a LinkedIn DM
6. Verify all messages have sender names (no nulls)

## Support

For issues or questions, check:
- Backend logs: Look for `[Action 1]`, `[Action 2]`, etc.
- Database: Run verification queries above
- Unipile API: Check API rate limits and quotas
