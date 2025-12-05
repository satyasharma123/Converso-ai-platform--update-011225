# LinkedIn DM Handling & Management - Complete Documentation

**Last Updated:** December 2024  
**Purpose:** Comprehensive guide to LinkedIn DM features, functions, database schema, and implementation details

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Database Schema (Supabase Tables)](#database-schema-supabase-tables)
3. [Backend Architecture](#backend-architecture)
4. [Frontend Architecture](#frontend-architecture)
5. [API Endpoints](#api-endpoints)
6. [Data Types & Interfaces](#data-types--interfaces)
7. [Key Features & Functions](#key-features--functions)
8. [Current Implementation Status](#current-implementation-status)
9. [Integration Points](#integration-points)

---

## 🎯 Overview

LinkedIn DM functionality in Converso allows users to:
- Connect LinkedIn accounts
- View LinkedIn conversations alongside email conversations
- Send and receive LinkedIn messages
- Manage LinkedIn conversations with CRM features (assignment, status, stages)
- Filter and search LinkedIn conversations
- Track LinkedIn conversation metadata

**Note:** Currently, LinkedIn accounts can be manually added, but **automatic LinkedIn API sync is NOT yet implemented**. The infrastructure is in place, but LinkedIn OAuth and message fetching need to be implemented.

---

## 🗄️ Database Schema (Supabase Tables)

### 1. **`conversations` Table**

Stores both email and LinkedIn conversations. LinkedIn conversations are identified by `conversation_type = 'linkedin'`.

```sql
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_type conversation_type NOT NULL,  -- 'email' | 'linkedin'
  sender_name TEXT NOT NULL,
  sender_email TEXT,                            -- NULL for LinkedIn
  sender_linkedin_url TEXT,                     -- LinkedIn profile URL
  subject TEXT,                                  -- Optional for LinkedIn
  preview TEXT,                                  -- Message preview/snippet
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status lead_status DEFAULT 'new',             -- 'new' | 'engaged' | 'qualified' | 'converted' | 'not_interested'
  is_read BOOLEAN DEFAULT false,
  is_favorite BOOLEAN DEFAULT false,
  custom_stage_id UUID REFERENCES pipeline_stages(id),
  workspace_id UUID REFERENCES workspaces(id),
  received_on_account_id UUID REFERENCES connected_accounts(id),  -- Which LinkedIn account received this
  company_name TEXT,                             -- Lead company info
  location TEXT,                                 -- Lead location
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**LinkedIn-Specific Fields:**
- `conversation_type`: Must be `'linkedin'`
- `sender_linkedin_url`: LinkedIn profile URL of the sender
- `sender_email`: Usually NULL for LinkedIn (unless manually added)
- `subject`: Optional, may be NULL
- `received_on_account_id`: References the LinkedIn connected account

**Indexes:**
```sql
CREATE INDEX idx_conversations_company_name ON conversations(company_name) WHERE conversation_type IN ('email', 'linkedin');
CREATE INDEX idx_conversations_location ON conversations(location) WHERE conversation_type IN ('email', 'linkedin');
```

---

### 2. **`messages` Table**

Stores individual messages within conversations. For LinkedIn, messages are linked via `conversation_id`.

```sql
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- NULL for lead messages
  sender_name TEXT NOT NULL,
  content TEXT NOT NULL,
  is_from_lead BOOLEAN DEFAULT true,              -- true = from lead, false = from SDR
  linkedin_message_id TEXT,                       -- LinkedIn API message ID (if synced)
  linkedin_sender_profile_url TEXT,               -- LinkedIn profile URL
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**LinkedIn-Specific Fields:**
- `linkedin_message_id`: LinkedIn API message ID (for future sync)
- `linkedin_sender_profile_url`: LinkedIn profile URL of message sender

**Note:** Email-specific fields (`gmail_message_id`, `outlook_message_id`, `email_body`) are NULL for LinkedIn messages.

---

### 3. **`connected_accounts` Table**

Stores connected LinkedIn accounts (and email accounts).

```sql
CREATE TABLE public.connected_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  workspace_id UUID REFERENCES workspaces(id),
  account_type conversation_type NOT NULL,       -- 'email' | 'linkedin'
  account_email TEXT,                             -- NULL for LinkedIn (unless manually set)
  account_name TEXT NOT NULL,                     -- Display name (e.g., "LinkedIn Business Account")
  is_active BOOLEAN DEFAULT true,
  
  -- OAuth fields (for future LinkedIn API integration)
  oauth_access_token TEXT,                        -- Encrypted LinkedIn OAuth token
  oauth_refresh_token TEXT,                       -- Encrypted LinkedIn refresh token
  oauth_token_expires_at TIMESTAMP WITH TIME ZONE,
  oauth_provider TEXT,                            -- 'google' | 'microsoft' | 'linkedin'
  
  -- Sync status
  last_synced_at TIMESTAMP WITH TIME ZONE,
  sync_status TEXT DEFAULT 'pending',            -- 'pending' | 'syncing' | 'success' | 'error'
  sync_error TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**LinkedIn Account Fields:**
- `account_type`: Must be `'linkedin'`
- `account_email`: Usually NULL (LinkedIn doesn't require email)
- `oauth_provider`: Should be `'linkedin'` when OAuth is implemented
- `oauth_access_token` / `oauth_refresh_token`: For LinkedIn API access (future)

**Indexes:**
```sql
CREATE INDEX idx_connected_accounts_user_id ON connected_accounts(user_id);
CREATE INDEX idx_connected_accounts_oauth_provider ON connected_accounts(oauth_provider);
```

---

### 4. **Enums**

```sql
-- Conversation type enum
CREATE TYPE public.conversation_type AS ENUM ('email', 'linkedin');

-- Lead status enum (shared with emails)
CREATE TYPE public.lead_status AS ENUM ('new', 'engaged', 'qualified', 'converted', 'not_interested');
```

---

## 🔧 Backend Architecture

### **File Structure**

```
Converso-backend/
├── src/
│   ├── api/
│   │   ├── conversations.ts          # Database queries for conversations
│   │   └── messages.ts                # Database queries for messages
│   ├── services/
│   │   ├── conversations.ts           # Business logic for conversations
│   │   └── messages.ts                # Business logic for messages
│   ├── routes/
│   │   ├── conversations.routes.ts   # HTTP endpoints for conversations
│   │   ├── messages.routes.ts         # HTTP endpoints for messages
│   │   └── integrations.routes.ts     # OAuth endpoints (Gmail/Outlook, LinkedIn placeholder)
│   └── types/
│       └── index.ts                   # TypeScript interfaces
```

---

### **1. API Layer (`api/conversations.ts`)**

**Function: `getConversations()`**
- Fetches conversations filtered by type (`'linkedin'`)
- Includes `received_account` relationship
- Filters by workspace
- Role-based filtering (SDRs see only assigned)

```typescript
export async function getConversations(
  userId: string,
  userRole: 'admin' | 'sdr' | null,
  type?: 'email' | 'linkedin'  // Filter LinkedIn conversations
): Promise<Conversation[]>
```

**Function: `assignConversation()`**
- Assigns LinkedIn conversation to SDR

**Function: `updateConversationStatus()`**
- Updates LinkedIn conversation status

**Function: `updateLeadProfile()`**
- Updates LinkedIn lead profile (name, company, location)

---

### **2. Service Layer (`services/conversations.ts`)**

**Service: `conversationsService`**

```typescript
export const conversationsService = {
  getConversations(userId, userRole, type?: 'email' | 'linkedin'),
  assignConversation(conversationId, sdrId),
  updateStatus(conversationId, status),
  markAsRead(conversationId),
  toggleRead(conversationId, isRead),
  updateStage(conversationId, stageId),
  toggleFavorite(conversationId, isFavorite),
  deleteConversation(conversationId),
  getById(conversationId),
  updateLeadProfile(conversationId, updates),
};
```

**All functions work identically for LinkedIn and email conversations.**

---

### **3. Messages API (`api/messages.ts`)**

**Function: `getMessages(conversationId)`**
- Fetches all messages for a LinkedIn conversation
- Orders by `created_at` ascending

**Function: `sendMessage(conversationId, userId, content)`**
- Creates a new message in LinkedIn conversation
- Sets `is_from_lead = false` (SDR message)
- Updates `last_message_at` on conversation

**Function: `getMessageById(messageId)`**
- Gets single message by ID

---

### **4. Messages Service (`services/messages.ts`)**

```typescript
export const messagesService = {
  getMessages(conversationId),
  sendMessage(conversationId, userId, content),
  getById(messageId),
};
```

---

### **5. Routes (`routes/conversations.routes.ts`)**

**GET `/api/conversations`**
- Query param: `type=linkedin` to filter LinkedIn conversations
- Returns transformed conversations with account info

**GET `/api/conversations/:id`**
- Get single LinkedIn conversation

**PATCH `/api/conversations/:id/assign`**
- Assign LinkedIn conversation to SDR

**PATCH `/api/conversations/:id/status`**
- Update LinkedIn conversation status

**PATCH `/api/conversations/:id/read`**
- Mark LinkedIn conversation as read/unread

**PATCH `/api/conversations/:id/stage`**
- Update LinkedIn conversation pipeline stage

**PATCH `/api/conversations/:id/favorite`**
- Toggle favorite flag

**DELETE `/api/conversations/:id`**
- Delete LinkedIn conversation (cascades to messages)

**PATCH `/api/conversations/:id/profile`**
- Update LinkedIn lead profile (name, company, location)

---

### **6. Messages Routes (`routes/messages.routes.ts`)**

**GET `/api/messages/conversation/:conversationId`**
- Get all messages for LinkedIn conversation
- Returns messages ordered by `created_at`

**POST `/api/messages`**
- Send a message in LinkedIn conversation
- Body: `{ conversationId, content, userId }`

**GET `/api/messages/:id`**
- Get single message by ID

---

## 🎨 Frontend Architecture

### **File Structure**

```
Converso-frontend/
├── src/
│   ├── pages/
│   │   └── LinkedInInbox.tsx          # Main LinkedIn inbox page
│   ├── components/
│   │   └── Inbox/
│   │       ├── ConversationList.tsx  # Conversation list (supports LinkedIn)
│   │       ├── ConversationView.tsx  # Message view (supports LinkedIn)
│   │       ├── ConnectedAccountFilter.tsx  # Filter by LinkedIn account
│   │       └── LeadProfilePanel.tsx  # Lead profile drawer
│   ├── hooks/
│   │   ├── useConversations.tsx      # Fetch LinkedIn conversations
│   │   └── useMessages.tsx           # Fetch LinkedIn messages
│   └── lib/
│       └── backend-api.ts            # API client functions
```

---

### **1. LinkedIn Inbox Page (`pages/LinkedInInbox.tsx`)**

**Location:** `/inbox/linkedin`

**Features:**
- Three-panel layout: Conversation List | Message View | Lead Profile Panel
- Filter by LinkedIn account
- Search conversations
- Bulk selection
- Status tabs (All, Unread, Favorites)

**Key State:**
```typescript
const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
const [accountFilter, setAccountFilter] = useState('all');
const [searchQuery, setSearchQuery] = useState('');
const [selectedConversations, setSelectedConversations] = useState<string[]>([]);
```

**Data Fetching:**
```typescript
const { data: conversations = [], isLoading } = useConversations('linkedin');
const { data: messagesForSelected = [] } = useMessages(selectedConversation);
```

**Filtering:**
- Filters by `accountFilter` (LinkedIn account name)
- Filters by `searchQuery` (sender name or subject)
- Backend handles SDR role filtering

---

### **2. Conversation List Component (`components/Inbox/ConversationList.tsx`)**

**Supports LinkedIn conversations:**
- Displays LinkedIn icon badge
- Shows `sender_linkedin_url` if available
- Handles LinkedIn-specific fields
- Same UI/UX as email conversations

**Key Props:**
```typescript
interface Conversation {
  type: "email" | "linkedin";
  senderName: string;
  senderEmail?: string;
  sender_linkedin_url?: string;
  receivedAccount?: {
    account_type: "linkedin";
    account_name: string;
  };
}
```

---

### **3. Conversation View Component (`components/Inbox/ConversationView.tsx`)**

**Features:**
- Displays LinkedIn messages in chat-like interface
- Send reply functionality
- Status dropdown
- Assignment dropdown
- Message timestamps

**Message Display:**
- Lead messages: Left-aligned, muted background
- SDR messages: Right-aligned, primary background
- Shows sender name and timestamp

---

### **4. Hooks**

**`useConversations(type?: 'email' | 'linkedin')`**
```typescript
export function useConversations(type?: 'email' | 'linkedin') {
  return useQuery({
    queryKey: ['conversations', type, user?.id],
    queryFn: async () => conversationsApi.list(type),
  });
}
```

**`useMessages(conversationId)`**
```typescript
export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => messagesApi.getByConversation(conversationId),
  });
}
```

**`useSendMessage()`**
- Mutation hook for sending LinkedIn messages
- Invalidates messages and conversations queries on success

---

### **5. API Client (`lib/backend-api.ts`)**

**Conversations API:**
```typescript
export const conversationsApi = {
  list(type?: 'email' | 'linkedin'),
  getById(id),
  assign(conversationId, sdrId),
  updateStatus(conversationId, status),
  toggleRead(conversationId, isRead),
  updateStage(conversationId, stageId),
  toggleFavorite(conversationId, isFavorite),
  delete(conversationId),
  updateProfile(conversationId, updates),
};
```

**Messages API:**
```typescript
export const messagesApi = {
  getByConversation(conversationId),
  send(conversationId, content, userId),
  getById(id),
};
```

---

## 📡 API Endpoints

### **Conversations**

| Method | Endpoint | Description | LinkedIn-Specific |
|--------|----------|-------------|-------------------|
| GET | `/api/conversations?type=linkedin` | Get LinkedIn conversations | ✅ |
| GET | `/api/conversations/:id` | Get single conversation | ✅ |
| PATCH | `/api/conversations/:id/assign` | Assign to SDR | ✅ |
| PATCH | `/api/conversations/:id/status` | Update status | ✅ |
| PATCH | `/api/conversations/:id/read` | Mark read/unread | ✅ |
| PATCH | `/api/conversations/:id/stage` | Update pipeline stage | ✅ |
| PATCH | `/api/conversations/:id/favorite` | Toggle favorite | ✅ |
| DELETE | `/api/conversations/:id` | Delete conversation | ✅ |
| PATCH | `/api/conversations/:id/profile` | Update lead profile | ✅ |

### **Messages**

| Method | Endpoint | Description | LinkedIn-Specific |
|--------|----------|-------------|-------------------|
| GET | `/api/messages/conversation/:conversationId` | Get messages | ✅ |
| POST | `/api/messages` | Send message | ✅ |
| GET | `/api/messages/:id` | Get single message | ✅ |

### **Connected Accounts**

| Method | Endpoint | Description | LinkedIn-Specific |
|--------|----------|-------------|-------------------|
| GET | `/api/connected-accounts` | List accounts | ✅ (filters by `account_type='linkedin'`) |
| POST | `/api/connected-accounts` | Create account | ✅ (manual creation) |
| DELETE | `/api/connected-accounts/:id` | Delete account | ✅ |

**Note:** LinkedIn OAuth endpoints (`/api/integrations/linkedin/connect`, `/api/integrations/linkedin/callback`) are **NOT YET IMPLEMENTED**.

---

## 📝 Data Types & Interfaces

### **Conversation Interface**

```typescript
export interface Conversation {
  id: string;
  sender_name: string;
  sender_email?: string;              // NULL for LinkedIn
  sender_linkedin_url?: string;       // LinkedIn profile URL
  subject?: string;                    // Optional for LinkedIn
  preview: string;
  last_message_at: string;
  conversation_type: 'email' | 'linkedin';  // 'linkedin' for LinkedIn DMs
  status: 'new' | 'engaged' | 'qualified' | 'converted' | 'not_interested';
  is_read: boolean;
  is_favorite?: boolean;
  assigned_to?: string;
  custom_stage_id?: string;
  received_on_account_id?: string;
  company_name?: string;
  location?: string;
  received_account?: {
    account_name: string;
    account_email?: string;
    account_type: 'email' | 'linkedin';
    oauth_provider?: 'google' | 'microsoft' | 'linkedin';
  };
}
```

### **Message Interface**

```typescript
export interface Message {
  id: string;
  conversation_id: string;
  sender_name: string;
  sender_id?: string;                 // NULL for lead messages
  content: string;
  created_at: string;
  is_from_lead: boolean;              // true = from lead, false = from SDR
  linkedin_message_id?: string;       // LinkedIn API message ID (future)
  linkedin_sender_profile_url?: string; // LinkedIn profile URL
}
```

### **ConnectedAccount Interface**

```typescript
export interface ConnectedAccount {
  id: string;
  account_name: string;
  account_email: string | null;       // NULL for LinkedIn
  account_type: 'email' | 'linkedin';  // 'linkedin' for LinkedIn accounts
  is_active: boolean;
  user_id: string;
  oauth_access_token?: string | null; // For LinkedIn API (future)
  oauth_refresh_token?: string | null;
  oauth_token_expires_at?: string | null;
  oauth_provider?: 'google' | 'microsoft' | 'linkedin' | null;
  last_synced_at?: string | null;
  sync_status?: 'pending' | 'syncing' | 'success' | 'error' | null;
  sync_error?: string | null;
}
```

---

## ⚙️ Key Features & Functions

### **1. Conversation Management**

✅ **List LinkedIn Conversations**
- Filter by `conversation_type = 'linkedin'`
- Filter by workspace
- Role-based access (SDRs see only assigned)
- Include account information

✅ **View LinkedIn Conversation**
- Display conversation metadata
- Show sender LinkedIn profile URL
- Display preview/snippet

✅ **Assign LinkedIn Conversation**
- Assign to SDR
- Bulk reassign
- Unassign (set to NULL)

✅ **Update Status**
- Change lead status (new, engaged, qualified, converted, not_interested)
- Visual status badges

✅ **Pipeline Stage Management**
- Assign to custom pipeline stage
- Track stage progression

✅ **Read/Unread Management**
- Mark as read/unread
- Visual indicators (unread dot)
- Auto-mark as read (future)

✅ **Favorite Management**
- Toggle favorite flag
- Filter by favorites

✅ **Lead Profile Updates**
- Update sender name
- Update company name
- Update location

---

### **2. Message Management**

✅ **View Messages**
- List all messages in conversation
- Order by `created_at` ascending
- Display sender name and timestamp
- Distinguish lead vs SDR messages

✅ **Send Messages**
- Create new message
- Set `is_from_lead = false`
- Update `last_message_at` on conversation
- Invalidate queries for real-time updates

✅ **Message Display**
- Chat-like interface
- Left-aligned (lead) vs right-aligned (SDR)
- Timestamp display
- Content rendering

---

### **3. Account Management**

✅ **Create LinkedIn Account**
- Manual creation via Settings page
- Set `account_type = 'linkedin'`
- Set `account_name` (display name)
- No OAuth required (manual mode)

❌ **LinkedIn OAuth Integration**
- **NOT YET IMPLEMENTED**
- Infrastructure exists (`oauth_provider`, `oauth_access_token` fields)
- Need to implement:
  - LinkedIn OAuth flow
  - Token storage
  - API client setup

❌ **LinkedIn Message Sync**
- **NOT YET IMPLEMENTED**
- Need to implement:
  - LinkedIn Messages API integration
  - Fetch conversations from LinkedIn
  - Fetch messages from LinkedIn
  - Store in database
  - Real-time sync (webhooks/polling)

---

### **4. Filtering & Search**

✅ **Account Filter**
- Filter by LinkedIn account name
- "All" option shows all LinkedIn accounts
- Uses `ConnectedAccountFilter` component

✅ **Search**
- Search by sender name
- Search by subject (if available)
- Case-insensitive

✅ **Status Filter**
- All Messages
- Unread
- Favorites

---

### **5. UI Components**

✅ **LinkedIn Icon Badge**
- Blue LinkedIn icon
- Shows in conversation list
- Shows in account filter

✅ **Received Account Badge**
- Displays LinkedIn account name
- Shows LinkedIn icon

✅ **Lead Profile Panel**
- Right-side drawer
- Shows lead information
- Company, location, engagement metrics
- Activity timeline
- Assignment management

---

## 🚧 Current Implementation Status

### ✅ **Implemented**

1. **Database Schema**
   - ✅ `conversations` table with LinkedIn support
   - ✅ `messages` table with LinkedIn fields
   - ✅ `connected_accounts` table with LinkedIn support
   - ✅ OAuth token fields (ready for LinkedIn OAuth)

2. **Backend API**
   - ✅ All conversation endpoints support LinkedIn
   - ✅ All message endpoints support LinkedIn
   - ✅ Type filtering (`type=linkedin`)
   - ✅ Role-based access control

3. **Frontend UI**
   - ✅ LinkedIn Inbox page (`/inbox/linkedin`)
   - ✅ Conversation list with LinkedIn support
   - ✅ Message view with LinkedIn support
   - ✅ Account filtering
   - ✅ Search functionality
   - ✅ Lead profile panel

4. **Manual Account Creation**
   - ✅ Create LinkedIn account via Settings
   - ✅ Manual conversation/message creation (via seed scripts)

---

### ❌ **NOT YET IMPLEMENTED**

1. **LinkedIn OAuth Integration**
   - ❌ OAuth flow (`/api/integrations/linkedin/connect`)
   - ❌ OAuth callback (`/api/integrations/linkedin/callback`)
   - ❌ Token storage and refresh
   - ❌ LinkedIn API client setup

2. **LinkedIn Message Sync**
   - ❌ Fetch conversations from LinkedIn API
   - ❌ Fetch messages from LinkedIn API
   - ❌ Store in database
   - ❌ Real-time sync (webhooks/polling)
   - ❌ Sync status tracking

3. **LinkedIn Message Sending**
   - ❌ Send messages via LinkedIn API (currently only stores in DB)
   - ❌ Message delivery status

4. **LinkedIn Profile Enrichment**
   - ❌ Fetch LinkedIn profile data
   - ❌ Auto-populate company, location, etc.

---

## 🔗 Integration Points

### **1. Email Sync System**

The email sync system (`services/emailSync.ts`) currently handles Gmail and Outlook. To add LinkedIn sync:

1. Create `services/linkedinIntegration.ts` (similar to `gmailIntegration.ts`)
2. Implement LinkedIn API client
3. Add LinkedIn sync logic to `initEmailSync()` or create `initLinkedInSync()`
4. Add LinkedIn sync route (`/api/integrations/linkedin/sync/:accountId`)

### **2. OAuth System**

OAuth utilities (`utils/oauth.ts`) handle Gmail/Outlook. To add LinkedIn:

1. Create `utils/linkedinOAuth.ts`
2. Implement LinkedIn OAuth flow
3. Add routes in `routes/integrations.routes.ts`

### **3. Settings Page**

Settings page (`pages/Settings.tsx`) has LinkedIn account creation UI. Currently manual only. When OAuth is implemented:

1. Add "Connect LinkedIn" button
2. Trigger OAuth flow
3. Handle callback
4. Show sync status

---

## 📊 Database Relationships

```
workspaces
  └── connected_accounts (account_type='linkedin')
        └── conversations (conversation_type='linkedin', received_on_account_id)
              └── messages (conversation_id)
```

**Key Relationships:**
- `conversations.received_on_account_id` → `connected_accounts.id`
- `messages.conversation_id` → `conversations.id`
- `conversations.assigned_to` → `profiles.id` (SDR assignment)
- `conversations.custom_stage_id` → `pipeline_stages.id`

---

## 🔐 Row Level Security (RLS)

**Conversations:**
- Admins: Can view/manage all LinkedIn conversations
- SDRs: Can view/manage only assigned LinkedIn conversations

**Messages:**
- Users can view messages from conversations they have access to
- Users can insert messages to conversations they have access to

**Connected Accounts:**
- Admins: Can view/manage all LinkedIn accounts
- SDRs: Cannot view/manage accounts

---

## 🎯 Development Roadmap

### **Phase 1: LinkedIn OAuth (Not Started)**
- [ ] Implement LinkedIn OAuth flow
- [ ] Store OAuth tokens securely
- [ ] Token refresh mechanism
- [ ] Update Settings UI

### **Phase 2: LinkedIn API Integration (Not Started)**
- [ ] LinkedIn Messages API client
- [ ] Fetch conversations
- [ ] Fetch messages
- [ ] Store in database

### **Phase 3: Sync System (Not Started)**
- [ ] Background sync job
- [ ] Real-time sync (webhooks/polling)
- [ ] Sync status tracking
- [ ] Error handling

### **Phase 4: Message Sending (Not Started)**
- [ ] Send messages via LinkedIn API
- [ ] Delivery status tracking
- [ ] Error handling

### **Phase 5: Profile Enrichment (Not Started)**
- [ ] Fetch LinkedIn profile data
- [ ] Auto-populate company/location
- [ ] Profile picture sync

---

## 📚 Additional Resources

- **LinkedIn API Documentation:** https://docs.microsoft.com/en-us/linkedin/
- **LinkedIn OAuth:** https://docs.microsoft.com/en-us/linkedin/shared/authentication/authentication
- **LinkedIn Messages API:** https://docs.microsoft.com/en-us/linkedin/messaging/

---

## 🐛 Known Limitations

1. **No LinkedIn API Integration:** Currently manual data entry only
2. **No OAuth:** LinkedIn accounts must be created manually
3. **No Real-time Sync:** No automatic fetching of LinkedIn messages
4. **No Message Sending:** Messages are stored in DB but not sent via LinkedIn API
5. **No Profile Enrichment:** Company/location must be manually entered

---

**End of Documentation**
