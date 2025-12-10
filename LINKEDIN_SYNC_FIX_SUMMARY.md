# LinkedIn Sync Fix - Complete Rewrite Summary

## What Changed

### Architecture Change
LinkedIn data is now stored in **separate tables** instead of mixing with email data:
- ❌ OLD: `public.conversations` + `public.messages` (mixed email + LinkedIn)
- ✅ NEW: `linkedin_conversations` + `linkedin_messages` (LinkedIn only)

---

## 1. New Database Tables

### Migration File
**Created**: `Converso-frontend/supabase/migrations/20251206000002_create_linkedin_tables.sql`

### Table: `linkedin_conversations`
```sql
- id (uuid pk)
- unipile_chat_id (text unique) -- Maps to Unipile chat.id
- title (text) -- Chat title
- participant_ids (jsonb) -- Array of participants from Unipile
- latest_message_at (timestamptz) -- From Unipile msg.date
- workspace_id (uuid fk)
- account_id (uuid fk)
- is_read (boolean)
- created_at (timestamptz)
- updated_at (timestamptz)
```

### Table: `linkedin_messages`
```sql
- id (uuid pk)
- unipile_message_id (text unique) -- Maps to Unipile msg.id
- conversation_id (uuid fk → linkedin_conversations.id)
- sender_id (text) -- From Unipile msg.from.address
- sender_name (text) -- From Unipile msg.from.display_name
- content (text) -- From Unipile msg.body_text or msg.body_html
- timestamp (timestamptz) -- From Unipile msg.date (NOT sync time)
- direction (text) -- 'in' or 'out' from Unipile
- attachments (jsonb) -- For future attachment support
- raw_json (jsonb) -- Full Unipile message object
- workspace_id (uuid fk)
- account_id (uuid fk)
- created_at (timestamptz)
```

**Key Features**:
- UNIQUE constraints on `unipile_chat_id` and `unipile_message_id` for deduplication
- Indexes on workspace_id, account_id, timestamp for fast queries
- RLS policies for workspace-level access

---

## 2. Backend Sync Service

### File: `linkedinUnipileMessages.ts`

**Updated Functions**:

#### `syncLinkedInMessages(accountId)`
Main sync function that:
1. Gets account from Supabase (requires `unipile_account_id`)
2. Calls Unipile API: `GET /chats?account_id={id}&since={date}&limit=100`
3. For each chat:
   - Fetches messages: `GET /chats/{chat_id}/messages?account_id={id}&limit=100`
   - Sorts messages by date
   - Gets last message
   - Upserts conversation with last message data
   - Upserts all messages with correct timestamps
4. Updates `connected_accounts.sync_status`

#### `upsertLinkedInConversation()`
Maps Unipile chat to `linkedin_conversations`:
```typescript
{
  unipile_chat_id: chat.id,
  title: chat.title || null,
  participant_ids: chat.participants || [],
  latest_message_at: lastMessage?.date || chat.last_message_date,
  workspace_id: workspaceId,
  account_id: accountId,
  is_read: (chat.unread_count ?? 0) === 0,
}
```

#### `upsertLinkedInMessage()`
Maps Unipile message to `linkedin_messages`:
```typescript
{
  unipile_message_id: msg.id,
  conversation_id: conversationId,
  sender_id: msg.from?.address || null,
  sender_name: msg.from?.display_name || msg.from?.address || 'Unknown',
  content: msg.body_text || msg.body_html || '',
  timestamp: msg.date, // ✅ Uses Unipile timestamp, NOT now()
  direction: msg.direction || 'in',
  raw_json: msg, // Stores full message for debugging
  workspace_id: workspaceId,
  account_id: accountId,
}
```

**Key Improvements**:
- ✅ Uses Unipile `msg.date` for timestamps (not sync time)
- ✅ Uses Unipile `msg.from.display_name` for sender names
- ✅ Uses Unipile `msg.body_text` or `msg.body_html` for content
- ✅ Deduplicates by `unipile_message_id`
- ✅ Stores full raw JSON for debugging

---

## 3. Backend API Endpoints

### New Endpoints

#### GET `/api/linkedin/conversations`
Query params: `workspace_id` (required), `account_id` (optional)
- Reads from `linkedin_conversations` table
- Orders by `latest_message_at` DESC
- Returns conversations with Unipile data

#### GET `/api/linkedin/conversations/:id/messages`
- Reads from `linkedin_messages` table
- Orders by `timestamp` ASC
- Returns messages with correct timestamps

#### POST `/api/linkedin/accounts/:id/initial-sync`
- Triggers `syncLinkedInMessages()` service
- Updates sync status
- Returns count of synced conversations and messages

#### DELETE `/api/linkedin/accounts/:id`
- Disconnects from Unipile: `DELETE /accounts/{unipile_account_id}`
- Deletes from Supabase (cascades to conversations and messages)

---

## 4. Frontend Updates

### New API Client
**File**: `Converso-frontend/src/api/linkedin.ts` (replaced old version)

**New Functions**:
- `getLinkedInConversations(workspaceId, accountId?)` → reads from `linkedin_conversations`
- `getLinkedInMessages(conversationId)` → reads from `linkedin_messages`
- `getLinkedInAccounts(workspaceId)` → reads from `connected_accounts`
- `initialSyncLinkedIn(accountId)` → triggers sync
- `disconnectLinkedInAccount(accountId)` → disconnects

### Updated LinkedIn Inbox
**File**: `Converso-frontend/src/pages/LinkedInInbox.tsx`

**Changes**:
- ❌ Removed: `useConversations('linkedin')` (reads from old table)
- ✅ Added: Direct query to `getLinkedInConversations()` (reads from new table)
- ❌ Removed: `useMessages(conversationId)` (reads from old table)
- ✅ Added: Direct query to `getLinkedInMessages()` (reads from new table)
- Maps new structure to display format

---

## Data Flow (Complete)

### Sync Flow
```
1. User clicks "Sync" button
   ↓
2. Frontend: POST /api/linkedin/accounts/:id/initial-sync
   ↓
3. Backend: syncLinkedInMessages(accountId)
   ↓
4. Backend: GET /chats (Unipile API)
   ↓
5. Backend: For each chat → GET /chats/{id}/messages (Unipile API)
   ↓
6. Backend: Upsert to linkedin_conversations table
   ↓
7. Backend: Upsert to linkedin_messages table
   ↓
8. Backend: Update connected_accounts.sync_status = 'success'
   ↓
9. Frontend: Display success message
```

### Display Flow
```
1. User opens LinkedIn Inbox
   ↓
2. Frontend: GET /api/linkedin/conversations?workspace_id={id}
   ↓
3. Backend: Query linkedin_conversations table (NOT Unipile)
   ↓
4. Frontend: Display conversations
   ↓
5. User clicks conversation
   ↓
6. Frontend: GET /api/linkedin/conversations/{id}/messages
   ↓
7. Backend: Query linkedin_messages table (NOT Unipile)
   ↓
8. Frontend: Display messages with correct timestamps
```

---

## Critical Points

### ✅ Correct Behavior
1. Messages sync from Unipile → Supabase first
2. Frontend reads from Supabase (not Unipile)
3. Timestamps are from Unipile (`msg.date`), not sync time
4. Sender names from Unipile (`msg.from.display_name`)
5. Content from Unipile (`msg.body_text` or `msg.body_html`)
6. Deduplication by `unipile_message_id` (unique constraint)

### ❌ What Was Wrong Before
1. Mixing LinkedIn with email in same tables
2. Using `now()` for message timestamps (incorrect)
3. Not using Unipile sender names properly
4. No proper deduplication

---

## Testing Steps

### 1. Apply Database Migration
```bash
# Run this in Supabase SQL Editor or via migrations
```
Apply the migration: `20251206000002_create_linkedin_tables.sql`

### 2. Restart Backend
```bash
cd Converso-backend
npm run dev
```

### 3. Sync LinkedIn Account
1. Go to Settings → LinkedIn Integration
2. Click "Sync" button
3. Watch backend logs for:
   ```
   [LinkedIn Sync] Found X conversations
   [LinkedIn Sync] Found Y messages in conversation
   [LinkedIn Sync] Completed: X conversations, Y messages
   ```

### 4. Check Supabase
Query the new tables:
```sql
SELECT * FROM linkedin_conversations ORDER BY latest_message_at DESC LIMIT 5;
SELECT * FROM linkedin_messages ORDER BY timestamp DESC LIMIT 10;
```

Verify:
- `latest_message_at` has real dates (not sync time)
- `sender_name` has real names from LinkedIn
- `content` has actual message text
- `timestamp` has message dates (not sync dates)

### 5. View in Frontend
1. Open LinkedIn Inbox
2. Conversations should appear
3. Click a conversation
4. Messages should display with correct:
   - Sender names
   - Message content
   - Timestamps (chronological order)

---

## Environment Variables Required

```env
UNIPILE_BASE_URL=https://api23.unipile.com:15315/api/v1
UNIPILE_API_KEY=your_api_key_here
LINKEDIN_INITIAL_SYNC_DAYS=30
```

---

## Files Changed

### Backend
1. `supabase/migrations/20251206000002_create_linkedin_tables.sql` - NEW
2. `src/services/linkedinUnipileMessages.ts` - UPDATED (uses new tables)
3. `src/routes/linkedin.routes.ts` - UPDATED (new endpoints)

### Frontend
4. `src/api/linkedin.ts` - REPLACED (new API client)
5. `src/pages/LinkedInInbox.tsx` - UPDATED (uses new endpoints)
6. `src/pages/Settings.tsx` - NO CHANGE (already correct)

---

**Status**: ✅ Ready to test after migration is applied




