# LinkedIn Unipile Integration - Complete Documentation

## Table of Contents
1. [Overview](#overview)
2. [Unipile Configuration](#unipile-configuration)
3. [Complete Data Flow](#complete-data-flow)
4. [Code Structure](#code-structure)
5. [API Endpoints](#api-endpoints)
6. [Database Schema](#database-schema)
7. [Frontend Components](#frontend-components)
8. [Sync Process Details](#sync-process-details)
9. [Environment Variables](#environment-variables)

---

## Overview

The LinkedIn integration uses **Unipile API** as the intermediary service to connect LinkedIn accounts and sync messages. The architecture follows this pattern:

```
LinkedIn → Unipile API → Backend (Express) → Supabase → Frontend (React)
```

**Key Principles**:
1. All messages are **first synced to Supabase**, then displayed in the Converso application. The frontend never directly calls Unipile API.
2. **IMPORTANT - Unified Table Structure**: LinkedIn messages are stored in the main `public.messages` table (NOT in a separate `linkedin_messages` table). They are identified by having a non-null `linkedin_message_id` field. This follows enterprise best practices for unified multi-channel inbox systems.
3. Similarly, LinkedIn conversations are stored in the main `public.conversations` table with `conversation_type='linkedin'`.

---

## Unipile Configuration

### Configuration File
**Location**: `Converso-backend/src/config/unipile.ts`

```typescript
export const UNIPILE_BASE_URL = process.env.UNIPILE_BASE_URL || 'https://api23.unipile.com:15315/api/v1';
export const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY!;
export const UNIPILE_WEBHOOK_SECRET = process.env.UNIPILE_WEBHOOK_SECRET;

// LinkedIn DM limits
export const LINKEDIN_DAILY_DM_LIMIT = parseInt(process.env.LINKEDIN_DAILY_DM_LIMIT || '120', 10);
export const LINKEDIN_DAILY_DM_WARN_AT = parseInt(process.env.LINKEDIN_DAILY_DM_WARN_AT || '80', 10);
export const LINKEDIN_INITIAL_SYNC_DAYS = parseInt(process.env.LINKEDIN_INITIAL_SYNC_DAYS || '30', 10);
```

### HTTP Client
**Location**: `Converso-backend/src/integrations/unipileClient.ts`

The Unipile client is an Axios-based HTTP client that:
- Uses `X-API-KEY` header for authentication (not Bearer token)
- Has request/response interceptors for logging
- Provides helper functions: `unipileGet`, `unipilePost`, `unipileDelete`, `unipilePatch`

**Key Configuration**:
```typescript
export const unipileClient: AxiosInstance = axios.create({
  baseURL: UNIPILE_BASE_URL,
  headers: {
    'X-API-KEY': UNIPILE_API_KEY,
    'Content-Type': 'application/json',
    'accept': 'application/json',
  },
  timeout: 30000,
});
```

---

## Complete Data Flow

### 1. Account Connection Flow

```
User clicks "Add LinkedIn Account" 
  → Opens dialog (manual entry currently)
  → Creates account in Supabase connected_accounts table
  → Account stored with workspace_id and account_type='linkedin'
  → Account appears in Settings page
```

**Note**: Currently, the account connection is manual. The Unipile hosted authentication flow is not yet implemented.

### 2. Message Sync Flow (When "Sync" Button is Clicked)

```
Frontend: User clicks "Sync" button
  ↓
Frontend: POST /api/linkedin/accounts/:id/initial-sync
  ↓
Backend: linkedin.routes.ts → syncLinkedInMessages()
  ↓
Backend: Get account from Supabase (with unipile_account_id)
  ↓
Backend: Call Unipile API → GET /chats?account_id={unipile_account_id}
  ↓
Backend: For each chat, call Unipile API → GET /chats/{chat_id}/messages
  ↓
Backend: Upsert conversations to Supabase public.conversations table
  ↓
Backend: Upsert messages to Supabase public.messages table (using linkedin_message_id)
  ↓
Backend: Update connected_accounts.sync_status = 'success'
  ↓
Frontend: Display success toast with counts
```

### 3. Display Flow (LinkedIn Inbox Page)

```
User navigates to LinkedIn Inbox
  ↓
Frontend: useConversations('linkedin') hook
  ↓
Frontend: GET /api/conversations?type=linkedin
  ↓
Backend: conversations.routes.ts → queries Supabase conversations table
  ↓
Backend: Filters by conversation_type='linkedin' and workspace_id
  ↓
Backend: Returns conversations from Supabase (NOT from Unipile)
  ↓
Frontend: Displays conversations in ConversationList component
  ↓
User clicks conversation
  ↓
Frontend: useMessages(conversationId) hook
  ↓
Frontend: GET /api/messages?conversation_id={id}
  ↓
Backend: messages.routes.ts → queries Supabase messages table
  ↓
Backend: Returns messages from Supabase (NOT from Unipile)
  ↓
Frontend: Displays messages in ConversationView component
```

**Key Point**: The frontend **ONLY** reads from Supabase. It never calls Unipile API directly.

### 4. Disconnect Flow

```
User clicks "Disconnect" button
  ↓
Frontend: DELETE /api/linkedin/accounts/:id
  ↓
Backend: Get account from Supabase
  ↓
Backend: If unipile_account_id exists → Call Unipile API DELETE /accounts/{unipile_account_id}
  ↓
Backend: Delete account from Supabase (cascades to conversations and messages)
  ↓
Frontend: Refresh accounts list
```

---

## Code Structure

### Backend Structure

```
Converso-backend/
├── src/
│   ├── config/
│   │   └── unipile.ts                    # Unipile configuration
│   ├── integrations/
│   │   └── unipileClient.ts              # HTTP client for Unipile API
│   ├── services/
│   │   └── linkedinUnipileMessages.ts    # Sync service (Unipile → Supabase)
│   ├── routes/
│   │   ├── linkedin.routes.ts            # LinkedIn API endpoints
│   │   ├── conversations.routes.ts       # Conversations API (reads from Supabase)
│   │   └── messages.routes.ts            # Messages API (reads from Supabase)
│   ├── api/
│   │   └── connectedAccounts.ts          # Account management (Supabase queries)
│   └── types/
│       └── index.ts                       # TypeScript types
```

### Frontend Structure

```
Converso-frontend/
├── src/
│   ├── api/
│   │   └── linkedin.ts                   # LinkedIn API client (calls backend)
│   ├── pages/
│   │   ├── Settings.tsx                  # Account management UI
│   │   └── LinkedInInbox.tsx             # LinkedIn messages display
│   ├── hooks/
│   │   ├── useConversations.tsx          # Fetches conversations from backend
│   │   └── useMessages.tsx               # Fetches messages from backend
│   └── components/
│       └── Inbox/
│           ├── ConversationList.tsx      # Displays conversation list
│           └── ConversationView.tsx      # Displays messages
```

---

## API Endpoints

### Backend Endpoints

#### 1. Get LinkedIn Accounts
```
GET /api/linkedin/accounts?workspace_id={id}
```
- **Purpose**: Fetch all LinkedIn accounts for a workspace
- **Source**: Queries Supabase `connected_accounts` table
- **Returns**: Array of LinkedIn accounts

#### 2. Initial Sync
```
POST /api/linkedin/accounts/:id/initial-sync
```
- **Purpose**: Sync messages from Unipile to Supabase
- **Flow**: 
  1. Gets account from Supabase
  2. Calls Unipile API to fetch chats
  3. For each chat, fetches messages from Unipile
  4. Upserts conversations and messages to Supabase
- **Returns**: `{ success: boolean, conversations: number, messages: number }`

#### 3. Disconnect Account
```
DELETE /api/linkedin/accounts/:id
```
- **Purpose**: Disconnect LinkedIn account
- **Flow**:
  1. Gets account from Supabase
  2. If `unipile_account_id` exists, calls Unipile API `DELETE /accounts/{id}`
  3. Deletes account from Supabase (cascades to conversations/messages)
- **Returns**: `{ success: true }`

#### 4. Get Conversations (LinkedIn)
```
GET /api/conversations?type=linkedin
```
- **Purpose**: Get LinkedIn conversations
- **Source**: Queries Supabase `conversations` table
- **Filter**: `conversation_type='linkedin'` and `workspace_id`
- **Returns**: Array of conversations

#### 5. Get Messages
```
GET /api/messages/conversation/:conversationId
```
- **Purpose**: Get messages for a conversation
- **Source**: Queries Supabase `public.messages` table
- **Filter**: `conversation_id` (works for all message types - email, LinkedIn, etc.)
- **Returns**: Array of messages

**Example Query for LinkedIn Messages Only**:
```sql
SELECT * FROM public.messages 
WHERE linkedin_message_id IS NOT NULL 
ORDER BY created_at DESC 
LIMIT 50;
```

---

## Database Schema

### `connected_accounts` Table

```sql
CREATE TABLE connected_accounts (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  user_id UUID REFERENCES profiles(id),
  account_type VARCHAR CHECK (account_type IN ('email', 'linkedin')),
  account_name VARCHAR,
  account_email VARCHAR,
  is_active BOOLEAN DEFAULT true,
  unipile_account_id VARCHAR,  -- Stores Unipile account ID
  sync_status VARCHAR,         -- 'pending', 'syncing', 'success', 'error'
  sync_error TEXT,
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP
);
```

**Key Fields for LinkedIn**:
- `unipile_account_id`: The Unipile account ID (used for API calls)
- `workspace_id`: Links account to workspace (for multi-tenant)
- `sync_status`: Tracks sync state

### `conversations` Table

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  received_on_account_id UUID REFERENCES connected_accounts(id),
  conversation_type VARCHAR CHECK (conversation_type IN ('email', 'linkedin')),
  sender_name VARCHAR,
  subject VARCHAR,
  preview TEXT,
  last_message_at TIMESTAMP,
  status VARCHAR,
  is_read BOOLEAN,
  external_conversation_id VARCHAR,  -- Unipile chat ID
  provider VARCHAR DEFAULT 'linkedin',
  created_at TIMESTAMP
);
```

**Key Fields for LinkedIn**:
- `external_conversation_id`: Maps to Unipile chat ID
- `conversation_type='linkedin'`: Identifies LinkedIn conversations
- `provider='linkedin'`: Additional filter

### `messages` Table

```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id),
  account_id UUID REFERENCES connected_accounts(id),
  sender_name VARCHAR,
  sender_id TEXT,
  content TEXT,
  created_at TIMESTAMP,
  is_from_lead BOOLEAN,
  linkedin_message_id TEXT,  -- Unipile message ID for LinkedIn (with unique index)
  gmail_message_id TEXT,     -- Gmail message ID
  outlook_message_id TEXT,   -- Outlook message ID
  email_body TEXT,           -- Full email body
  attachments JSONB
);

-- Unique index to prevent duplicate LinkedIn messages
CREATE UNIQUE INDEX IF NOT EXISTS messages_linkedin_message_id_uidx
  ON public.messages(linkedin_message_id)
  WHERE linkedin_message_id IS NOT NULL;
```

**Key Fields for LinkedIn**:
- `linkedin_message_id`: Maps to Unipile message ID (unique constraint prevents duplicates)
- `is_from_lead`: `true` if message is from the lead (not from us)
- `account_id`: Links message to the connected account

**Important Notes**:
- LinkedIn messages are stored in the main `messages` table alongside email messages
- LinkedIn messages are identified by having a non-null `linkedin_message_id`
- The `linkedin_message_id` is used in upsert operations to prevent duplicate messages
- To query LinkedIn messages: `SELECT * FROM messages WHERE linkedin_message_id IS NOT NULL`

---

## Frontend Components

### Settings Page (`Settings.tsx`)

**Location**: `Converso-frontend/src/pages/Settings.tsx`

**Key Features**:
1. **LinkedIn Accounts Query**:
   ```typescript
   const { data: linkedInAccountsData = [] } = useQuery({
     queryKey: ['linkedin_accounts', workspace?.id],
     queryFn: async () => {
       if (!workspace?.id) return [];
       const res = await getLinkedInAccounts(workspace.id);
       return res.accounts || [];
     },
     enabled: !!workspace?.id,
   });
   ```

2. **Sync Button**:
   ```typescript
   onClick={async () => {
     const res = await initialSyncLinkedIn(account.id);
     toast.success(`Sync started: ${res.conversations} conversations, ${res.messages} messages`);
   }}
   ```

3. **Disconnect Button**:
   ```typescript
   onClick={() => handleRemoveAccount({
     id: account.id,
     name: account.account_name,
     type: 'linkedin'
   })}
   ```

### LinkedIn Inbox Page (`LinkedInInbox.tsx`)

**Location**: `Converso-frontend/src/pages/LinkedInInbox.tsx`

**Key Features**:
1. **Fetches Conversations**:
   ```typescript
   const { data: conversations = [] } = useConversations('linkedin');
   ```
   - This calls `GET /api/conversations?type=linkedin`
   - Reads from Supabase, NOT Unipile

2. **Fetches Messages**:
   ```typescript
   const { data: messagesForSelected = [] } = useMessages(selectedConversation);
   ```
   - This calls `GET /api/messages?conversation_id={id}`
   - Reads from Supabase, NOT Unipile

---

## Sync Process Details

### Sync Service (`linkedinUnipileMessages.ts`)

**Location**: `Converso-backend/src/services/linkedinUnipileMessages.ts`

**Main Function**: `syncLinkedInMessages(accountId: string)`

**Step-by-Step Process**:

1. **Get Account from Supabase**:
   ```typescript
   const { data: account } = await supabaseAdmin
     .from('connected_accounts')
     .select('*')
     .eq('id', accountId)
     .eq('account_type', 'linkedin')
     .single();
   ```

2. **Calculate Sync Date Range**:
   ```typescript
   const since = new Date();
   since.setDate(since.getDate() - LINKEDIN_INITIAL_SYNC_DAYS); // Default: 30 days
   ```

3. **Fetch Chats from Unipile**:
   ```typescript
   const chatsResponse = await unipileGet<{ items: UnipileConversation[] }>(
     `/chats`,
     { account_id: unipileAccountId, since: since.toISOString(), limit: 100 }
   );
   ```

4. **For Each Chat**:
   - **Upsert Conversation to Supabase**:
     ```typescript
     await upsertConversation(accountId, workspaceId, chat);
     ```
     - Checks if conversation exists by `external_conversation_id`
     - Creates or updates in `conversations` table
   
   - **Fetch Messages from Unipile**:
     ```typescript
     const messagesResponse = await unipileGet<{ items: UnipileMessage[] }>(
       `/chats/${chat.id}/messages`,
       { account_id: unipileAccountId, limit: 100 }
     );
     ```
   
   - **Upsert Messages to Supabase**:
     ```typescript
     for (const msg of messages) {
       await upsertMessage(conversationId, workspaceId, msg);
     }
     ```
     - Checks if message exists by `external_message_id`
     - Creates or updates in `messages` table

5. **Update Sync Status**:
   ```typescript
   await supabaseAdmin
     .from('connected_accounts')
     .update({
       last_synced_at: new Date().toISOString(),
       sync_status: 'success',
       sync_error: null,
     })
     .eq('id', accountId);
   ```

**Error Handling**:
- If sync fails, updates `sync_status='error'` and `sync_error` with error message
- Continues processing other conversations even if one fails

---

## Environment Variables

### Required Environment Variables

Add these to `Converso-backend/.env`:

```env
# Unipile API Configuration
UNIPILE_BASE_URL=https://api23.unipile.com:15315/api/v1
UNIPILE_API_KEY=your_unipile_api_key_here
UNIPILE_WEBHOOK_SECRET=your_webhook_secret_here  # Optional, for webhooks

# LinkedIn DM Limits
LINKEDIN_DAILY_DM_LIMIT=120
LINKEDIN_DAILY_DM_WARN_AT=80
LINKEDIN_INITIAL_SYNC_DAYS=30
```

### Supabase Configuration

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # Required for admin operations
```

---

## Current Implementation Status

### ✅ Implemented

1. **Unipile Client**: HTTP client configured and working
2. **Account Display**: LinkedIn accounts show in Settings page
3. **Sync Functionality**: Sync button triggers Unipile → Supabase sync
4. **Disconnect Functionality**: Disconnects from Unipile and Supabase
5. **Message Display**: LinkedIn Inbox reads from Supabase
6. **Database Schema**: All required tables and fields exist

### ⚠️ Partially Implemented

1. **Account Connection**: Currently manual entry. Unipile hosted auth not yet implemented
2. **Webhook Support**: Webhook routes exist but not fully integrated
3. **Incremental Sync**: Only initial sync implemented. No automatic incremental sync yet

### ❌ Not Implemented

1. **Sending Messages**: No send message functionality yet
2. **Real-time Updates**: No webhook processing for new messages
3. **Rate Limiting**: DM limit tracking not enforced
4. **Account Refresh**: Refresh from Unipile endpoint is placeholder

---

## Data Flow Summary

### Sync Flow (Unipile → Supabase)
```
Unipile API → Backend Service → Supabase Database
```

### Display Flow (Supabase → Frontend)
```
Supabase Database → Backend API → Frontend React Components
```

### Key Principle
**All data flows through Supabase**. The frontend never directly accesses Unipile API. This ensures:
- Data consistency
- Offline capability
- Faster response times
- Centralized data management

---

## Troubleshooting

### LinkedIn Accounts Not Showing

1. **Check Backend is Running**: `curl http://localhost:3001/health`
2. **Check Supabase Connection**: Verify `SUPABASE_SERVICE_ROLE_KEY` is set
3. **Check Workspace ID**: Ensure `workspace_id` is correctly set in account
4. **Check Browser Console**: Look for API errors in Network tab

### Sync Not Working

1. **Check Unipile API Key**: Verify `UNIPILE_API_KEY` is set correctly
2. **Check Account Has `unipile_account_id`**: Account must have Unipile account ID
3. **Check Backend Logs**: Look for Unipile API errors
4. **Check Sync Status**: Query `connected_accounts.sync_status` and `sync_error`

### Messages Not Displaying

1. **Check Sync Completed**: Verify `sync_status='success'` in `connected_accounts`
2. **Check Conversations Table**: Query `conversations` table for `conversation_type='linkedin'`
3. **Check Messages Table**: Query `messages` table for LinkedIn messages:
   ```sql
   SELECT * FROM public.messages 
   WHERE linkedin_message_id IS NOT NULL 
   ORDER BY created_at DESC 
   LIMIT 50;
   ```
4. **Check Frontend Query**: Verify `useConversations('linkedin')` is called
5. **Important**: LinkedIn messages are in `public.messages` (NOT in `linkedin_messages` table). The old `linkedin_messages` table is obsolete.

---

## Unified Table Architecture

### Why Use a Single `messages` Table?

The Converso platform uses a **unified table architecture** where all messages from different channels (email, LinkedIn, etc.) are stored in a single `public.messages` table. This is an enterprise best practice for several reasons:

1. **Simplified Queries**: The UI can query one table with simple filters instead of joining multiple tables
2. **Consistent Schema**: All messages share the same core fields (id, content, sender, timestamp, etc.)
3. **Channel-Specific Fields**: Channel-specific identifiers like `linkedin_message_id`, `gmail_message_id`, or `outlook_message_id` are added as optional columns
4. **Scalability**: Adding new channels (WhatsApp, SMS, etc.) doesn't require new tables
5. **Unified Search**: Search across all message types with a single query

### How LinkedIn Messages are Identified

LinkedIn messages in the `public.messages` table are identified by:
- **Primary identifier**: `linkedin_message_id IS NOT NULL`
- **Secondary identifier**: Can also join to `conversations` where `conversation_type='linkedin'`

### Query Examples

**Get all LinkedIn messages**:
```sql
SELECT * FROM public.messages 
WHERE linkedin_message_id IS NOT NULL 
ORDER BY created_at DESC;
```

**Get LinkedIn messages for a specific conversation**:
```sql
SELECT * FROM public.messages 
WHERE conversation_id = 'some-uuid' 
ORDER BY created_at ASC;
```

**Get all messages (all channels) for display**:
```sql
SELECT m.*, c.conversation_type, c.sender_name as conversation_sender
FROM public.messages m
JOIN public.conversations c ON m.conversation_id = c.id
WHERE m.workspace_id = 'workspace-uuid'
ORDER BY m.created_at DESC;
```

### Legacy Tables

If you see references to `linkedin_messages` or `linkedin_conversations` tables in old code or migrations, these are **obsolete** and should be ignored or dropped. The current implementation uses only:
- `public.conversations` (with `conversation_type` to identify channel)
- `public.messages` (with `linkedin_message_id` to identify LinkedIn messages)

---

## Next Steps for Full Implementation

1. **Implement Unipile Hosted Auth**: Connect accounts via Unipile's hosted authentication
2. **Add Webhook Handler**: Process real-time message updates from Unipile
3. **Implement Send Message**: Add ability to send LinkedIn messages via Unipile
4. **Add Incremental Sync**: Sync only new messages since last sync
5. **Add Rate Limiting**: Enforce daily DM limits
6. **Add Error Recovery**: Retry failed syncs automatically

---

**Document Version**: 1.0  
**Last Updated**: December 6, 2025  
**Status**: Current Implementation

