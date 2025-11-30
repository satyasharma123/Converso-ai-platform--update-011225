# Converso Application - Implementation Reference Guide

**Last Updated:** November 30, 2025  
**Purpose:** Comprehensive reference guide for all implemented features, functions, and components

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Core Features Implemented](#core-features-implemented)
3. [Frontend Architecture](#frontend-architecture)
4. [Backend Architecture](#backend-architecture)
5. [Database Schema](#database-schema)
6. [Key Components & Their Functions](#key-components--their-functions)
7. [API Endpoints](#api-endpoints)
8. [Hooks & Custom Functions](#hooks--custom-functions)
9. [Email Sync System](#email-sync-system)
10. [UI/UX Features](#uiux-features)
11. [File Structure](#file-structure)

---

## 🎯 Project Overview

**Converso** is a multi-channel conversation management platform that integrates Gmail and Outlook emails, LinkedIn messages, and provides CRM-like features including pipeline management, lead assignment, and team collaboration.

### Tech Stack
- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL (via Supabase)
- **Authentication:** Supabase Auth
- **Email APIs:** Gmail API, Microsoft Graph API

---

## ✨ Core Features Implemented

### 1. Email Inbox System
- ✅ Multi-account email support (Gmail & Outlook)
- ✅ Email sync with progress tracking
- ✅ Full email body display with HTML rendering
- ✅ Email thread/conversation view
- ✅ Read/unread status with visual indicators (black dot)
- ✅ Auto-mark as read after 5 seconds
- ✅ Account-based filtering
- ✅ Search functionality

### 2. Lead Profile Panel
- ✅ Sliding drawer on right side
- ✅ Company/lead information display
- ✅ Engagement metrics
- ✅ Stage management
- ✅ Activity timeline
- ✅ Internal comments system
- ✅ SDR assignment

### 3. Email Sync System
- ✅ Gmail OAuth integration
- ✅ Outlook OAuth integration
- ✅ Automatic email sync on account connection
- ✅ Sync status tracking (pending, in_progress, completed, error)
- ✅ Full email body fetching on demand
- ✅ Token refresh handling

### 4. Conversation Management
- ✅ Conversation list with metadata
- ✅ Bulk actions (select all, archive, delete)
- ✅ Status filtering (All, Unread, Favorites)
- ✅ Folder navigation (Inbox, Sent, Drafts, etc.)
- ✅ Conversation assignment to SDRs
- ✅ Stage pipeline integration

### 5. UI/UX Enhancements
- ✅ Collapsible left sidebar (60px collapsed, 200px expanded)
- ✅ Sliding right drawer for lead profile (340px)
- ✅ Fixed width layout to prevent horizontal scrolling
- ✅ Vertical scrolling within panels
- ✅ Professional, clean design with proper spacing
- ✅ Responsive layout

---

## 🏗️ Frontend Architecture

### Main Pages

#### `/pages/EmailInbox.tsx`
**Primary email management page**

**Key Features:**
- Three-panel layout: Sidebar (200px) | Email List (320px) | Email View (flex) | Profile Drawer (340px)
- State management for selected conversations, filters, search
- Auto-sync trigger on mount
- Workspace validation
- Connected account filtering

**Main Functions:**
- `setSelectedConversation(id)` - Select conversation to view
- `handleToggleSelect(id)` - Toggle bulk selection
- `handleSelectAll()` - Select/deselect all conversations
- Account filter handling
- Search filtering

**Key State Variables:**
```typescript
selectedConversation: string | null
accountFilter: 'all' | accountId
searchQuery: string
selectedConversations: string[]
isProfileOpen: boolean
isSidebarCollapsed: boolean
```

#### `/pages/Settings.tsx`
- Integration management
- OAuth connection flows
- Account settings

#### `/pages/SalesPipeline.tsx`
- Kanban board view
- Pipeline stages
- Lead management

### Core Components

#### `/components/Inbox/EmailView.tsx`
**Displays individual email content and reply composer**

**Key Features:**
- Full email body rendering with HTML support
- Reply/Reply All/Forward functionality
- Mark as read after 5 seconds
- Email thread display (all messages in conversation)
- SDR assignment dropdown
- Stage selection dropdown

**Main Functions:**
- `handleSend()` - Send reply/forward
- `handleReplyClick(type)` - Open reply composer
- `getInitials(name)` - Generate avatar initials
- Auto-mark as read timer (5 seconds)

**Props:**
```typescript
{
  conversation: {
    id, senderName, senderEmail, subject, 
    status, assigned_to, custom_stage_id, is_read
  },
  messages: Message[]
}
```

#### `/components/Inbox/ConversationList.tsx`
**Lists all email conversations**

**Key Features:**
- Read/unread indicator (black dot for unread)
- Bulk selection checkboxes
- Account badges
- Timestamp formatting
- Dropdown menu for actions (Mark as Read/Unread, Assign, Change Stage, Archive)

**Main Functions:**
- `handleToggleRead(conversation)` - Toggle read status
- `handleAssignSDR(conversationId, sdrId)` - Assign to SDR
- `handleChangeStage(conversationId, stageId)` - Change pipeline stage

**Visual Indicators:**
- Black dot (●) shows for unread emails
- Bold font for unread emails
- Selected conversation highlighted

#### `/components/Inbox/EmailSidebar.tsx`
**Left sidebar with email folders**

**Key Features:**
- Collapsible design (60px when collapsed, 200px when expanded)
- Folder list (Inbox, Sent, Important, Snoozed, Drafts, Archive, Deleted)
- Sync status indicator
- Active folder highlighting

**Props:**
```typescript
{
  onFolderChange?: (folderId: string) => void
  isCollapsed?: boolean
}
```

#### `/components/Inbox/LeadProfilePanel.tsx`
**Right drawer panel with lead details**

**Key Features:**
- Company/lead name and details
- Engagement score display
- Stage selector
- Message count and last response time
- Activity timeline
- Internal comments system

**Layout:**
- Header section with company name
- Metrics section (Engagement, Stage, Messages, Last Response)
- Activity section
- Comments section with input and history

**Styling:**
- Professional spacing (px-5 py-4)
- Proper truncation to prevent text cutoff
- Clean dividers between sections
- Scrollable comments area

#### `/components/Inbox/ConnectedAccountFilter.tsx`
**Filter dropdown for email accounts**

**Features:**
- Shows all connected email accounts
- "All Accounts" option
- Account-specific filtering
- Visual account badges

#### `/components/Inbox/BulkActions.tsx`
**Bulk action toolbar**

**Features:**
- Archive selected
- Delete selected
- Assign to SDR
- Change stage
- Clear selection

---

## 🔧 Backend Architecture

### Main Services

#### `/services/emailSync.ts`
**Email synchronization service**

**Key Functions:**

1. **`syncEmailsForAccount(accountId: string)`**
   - Main sync function
   - Fetches emails from Gmail/Outlook API
   - Stores in database
   - Updates sync status
   - Returns sync progress

2. **`fetchAndStoreEmailBody(conversationId, messageId, account)`**
   - Fetches full email body from API
   - Stores in messages table
   - Updates conversation.has_full_body flag
   - Supports both Gmail and Outlook

3. **`fetchGmailEmailBody(account, messageId)`**
   - Gmail-specific body fetching
   - Handles HTML and plain text
   - Decodes base64 content

4. **`fetchOutlookEmailBody(account, messageId)`**
   - Outlook-specific body fetching
   - Uses Microsoft Graph API
   - Handles HTML content

**Sync Flow:**
1. Check sync status (avoid duplicate syncs)
2. Fetch emails from API (last 30 days or since last sync)
3. Transform email data to conversation/message format
4. Store in database
5. Update sync_status table
6. Return sync results

#### `/services/gmailIntegration.ts`
**Gmail API integration**

**Key Functions:**

1. **`refreshGmailToken(account)`**
   - Refreshes expired access tokens
   - Updates token in database
   - Returns new token data

2. **`getGmailMessages(account, options)`**
   - Fetches email list from Gmail API
   - Supports pagination
   - Filters by date range
   - Returns message metadata

3. **`getGmailMessageBody(account, messageId)`**
   - Fetches full email body
   - Handles multipart MIME
   - Extracts HTML/text content

#### `/services/outlookIntegration.ts`
**Outlook/Microsoft Graph API integration**

**Key Functions:**

1. **`refreshOutlookToken(account)`**
   - Refreshes Microsoft Graph tokens
   - Handles refresh token rotation
   - Updates stored tokens

2. **`getOutlookMessages(account, options)`**
   - Fetches emails from Microsoft Graph
   - Supports date filtering
   - Handles pagination

3. **`getOutlookMessageBody(account, messageId)`**
   - Fetches full email content
   - Returns HTML body

#### `/services/conversations.ts`
**Conversation business logic**

**Key Functions:**

1. **`getConversations(userId, userRole, type)`**
   - Fetches conversations with role-based filtering
   - Admins see all, SDRs see assigned only
   - Filters by conversation type (email/linkedin)
   - Includes received_account relationship

2. **`toggleRead(conversationId, isRead)`**
   - Updates conversation read status
   - Uses supabaseAdmin to bypass RLS

3. **`assignConversation(conversationId, sdrId)`**
   - Assigns conversation to SDR
   - Updates assigned_to field

4. **`updateStage(conversationId, stageId)`**
   - Updates pipeline stage
   - Sets custom_stage_id

#### `/services/messages.ts`
**Message operations**

**Key Functions:**

1. **`getMessages(conversationId)`**
   - Fetches all messages for a conversation
   - Ordered by created_at ascending
   - Includes email_body if available

2. **`sendMessage(conversationId, userId, content)`**
   - Creates new message
   - Updates conversation.last_message_at
   - Sets is_from_lead = false

---

## 📊 Database Schema

### Key Tables

#### `conversations`
```sql
- id (uuid, PK)
- sender_name (text)
- sender_email (text)
- subject (text)
- preview (text)
- conversation_type (enum: 'email' | 'linkedin')
- status (enum: lead_status)
- is_read (boolean)
- assigned_to (uuid, FK -> profiles.id)
- custom_stage_id (uuid, FK -> pipeline_stages.id)
- workspace_id (uuid, FK -> workspaces.id)
- received_on_account_id (uuid, FK -> connected_accounts.id)
- gmail_message_id (text) - for Gmail emails
- outlook_message_id (text) - for Outlook emails
- email_timestamp (timestamp)
- has_full_body (boolean)
- last_message_at (timestamp)
- created_at (timestamp)
```

#### `messages`
```sql
- id (uuid, PK)
- conversation_id (uuid, FK -> conversations.id)
- sender_id (uuid, FK -> profiles.id)
- sender_name (text)
- content (text)
- email_body (text) - full HTML email body
- gmail_message_id (text)
- outlook_message_id (text)
- is_from_lead (boolean)
- created_at (timestamp)
```

#### `connected_accounts`
```sql
- id (uuid, PK)
- user_id (uuid, FK -> profiles.id)
- workspace_id (uuid, FK -> workspaces.id)
- account_name (text)
- account_email (text)
- account_type (text) - 'email' | 'linkedin'
- oauth_provider (text) - 'google' | 'microsoft'
- access_token (text, encrypted)
- refresh_token (text, encrypted)
- expires_at (timestamp)
- created_at (timestamp)
```

#### `sync_status`
```sql
- id (uuid, PK)
- account_id (uuid, FK -> connected_accounts.id)
- workspace_id (uuid, FK -> workspaces.id)
- status (text) - 'pending' | 'in_progress' | 'completed' | 'error'
- last_sync_at (timestamp)
- total_synced (integer)
- error_message (text)
- created_at (timestamp)
```

---

## 🔌 API Endpoints

### Conversations

#### `GET /api/conversations`
**Get all conversations**

Query Params:
- `type` (optional): 'email' | 'linkedin'
- `userId` (required if not authenticated)
- `userRole` (optional): 'admin' | 'sdr'

Response:
```json
{
  "data": [
    {
      "id": "...",
      "senderName": "...",
      "senderEmail": "...",
      "subject": "...",
      "isRead": false,
      "status": "new",
      "receivedAccount": {...}
    }
  ]
}
```

#### `PATCH /api/conversations/:id/read`
**Toggle read status**

Body:
```json
{
  "isRead": true
}
```

#### `PATCH /api/conversations/:id/assign`
**Assign conversation to SDR**

Body:
```json
{
  "sdrId": "uuid" | null
}
```

#### `PATCH /api/conversations/:id/stage`
**Update pipeline stage**

Body:
```json
{
  "stageId": "uuid" | null
}
```

### Messages

#### `GET /api/messages/conversation/:conversationId`
**Get all messages for a conversation**

Features:
- Automatically fetches full email bodies if missing
- Returns messages ordered by created_at
- Includes email_body field for HTML content

Response:
```json
{
  "data": [
    {
      "id": "...",
      "senderName": "...",
      "content": "...",
      "email_body": "<html>...</html>",
      "timestamp": "..."
    }
  ]
}
```

#### `POST /api/messages`
**Send a new message**

Body:
```json
{
  "conversationId": "uuid",
  "content": "Message text",
  "userId": "uuid"
}
```

### Email Sync

#### `POST /api/emails/init-sync`
**Initiate email sync**

Body:
```json
{
  "accountId": "uuid"
}
```

Response:
```json
{
  "message": "Sync initiated",
  "syncId": "uuid"
}
```

#### `GET /api/emails/sync-status`
**Get sync status for all accounts**

Response:
```json
{
  "data": [
    {
      "accountId": "uuid",
      "status": "in_progress",
      "lastSyncAt": "...",
      "totalSynced": 42
    }
  ]
}
```

---

## 🎣 Hooks & Custom Functions

### `/hooks/useConversations.tsx`

#### `useConversations(type?)`
Fetches conversations list
- Automatically refetches on user change
- Filters by type (email/linkedin)
- Returns: `{ data, isLoading, error }`

#### `useToggleRead()`
Mutation to toggle read/unread status
- Updates conversation.is_read
- Silently updates (no toast notification)
- Invalidates conversations cache

#### `useAssignConversation()`
Mutation to assign conversation to SDR
- Updates conversation.assigned_to
- Shows success toast
- Invalidates cache

#### `useUpdateConversationStage()`
Mutation to change pipeline stage
- Updates conversation.custom_stage_id
- Shows success toast
- Invalidates cache

### `/hooks/useMessages.tsx`

#### `useMessages(conversationId)`
Fetches messages for a conversation
- Auto-refetches when conversationId changes
- Returns: `{ data, isLoading }`

#### `useSendMessage()`
Mutation to send a message
- Creates new message
- Updates conversation timestamp
- Shows success toast

### `/hooks/useEmailSync.tsx`

#### `useEmailSyncStatus()`
Fetches sync status for all accounts
- Returns array of sync statuses
- Auto-refetches periodically

#### `useInitEmailSync()`
Mutation to start email sync
- Triggers sync for account
- Shows loading state
- Handles errors

### `/hooks/useWorkspace.tsx`

#### `useWorkspace()`
Fetches workspace data
- Uses `/api/workspace` endpoint
- Returns workspace configuration

### `/hooks/useConnectedAccounts.tsx`

#### `useConnectedAccounts()`
Fetches all connected accounts
- Returns Gmail, Outlook, LinkedIn accounts
- Includes account metadata

---

## 📧 Email Sync System

### How It Works

1. **Account Connection**
   - User connects Gmail/Outlook via OAuth
   - Tokens stored in `connected_accounts` table
   - Initial sync triggered automatically

2. **Sync Process**
   ```
   User Action → POST /api/emails/init-sync
   → emailSync.syncEmailsForAccount()
   → gmailIntegration.getGmailMessages() OR outlookIntegration.getOutlookMessages()
   → Transform to conversations/messages
   → Store in database
   → Update sync_status
   ```

3. **Full Body Fetching**
   - Email metadata synced initially (subject, preview, timestamp)
   - Full body fetched lazily when user opens email
   - Stored in `messages.email_body` field
   - Conversation marked with `has_full_body = true`

4. **Token Refresh**
   - Tokens expire after 1 hour (Gmail) or varying (Outlook)
   - Refresh handled automatically in integration services
   - New tokens saved back to database

### Sync Status States

- **pending**: Sync not started
- **in_progress**: Currently syncing
- **completed**: Sync finished successfully
- **error**: Sync failed (check error_message)

### Error Handling

- Token refresh failures → Prompt user to reconnect
- API rate limits → Exponential backoff
- Network errors → Retry logic
- Invalid account → Mark as error, show in UI

---

## 🎨 UI/UX Features

### Layout System

**Fixed Width Design:**
- Left Sidebar: 200px (collapsed: 60px)
- Conversation List: 320px
- Email View: flex (remaining space)
- Profile Drawer: 340px (slides from right)

**Scrolling:**
- Main container: `overflow-hidden` (no horizontal scroll)
- Internal panels: `overflow-y-auto` (vertical scroll only)
- Full page height: `h-[calc(100vh-100px)]`

### Visual Indicators

1. **Read/Unread Status**
   - Unread: Black dot (●) + bold text
   - Read: No dot + normal text
   - Dot size: `w-1.5 h-1.5 rounded-full`

2. **Sync Status**
   - In Progress: Spinner + "Syncing..." text
   - Completed: Checkmark
   - Error: Warning icon

3. **Selected Conversation**
   - Highlighted background: `bg-accent/20`
   - Left border: `border-l-2 border-l-primary`

### Responsive Elements

- Collapsible sidebar (toggle button)
- Sliding drawer (smooth animation)
- Overflow handling (truncation, word-break)
- Proper padding/spacing (px-5, py-4, space-y-3.5)

---

## 📁 File Structure

### Frontend Key Files

```
Converso-frontend/src/
├── pages/
│   ├── EmailInbox.tsx          # Main email inbox page
│   ├── Settings.tsx             # Settings & integrations
│   └── SalesPipeline.tsx        # Pipeline kanban board
│
├── components/Inbox/
│   ├── EmailView.tsx            # Email content display
│   ├── ConversationList.tsx     # Conversation list
│   ├── EmailSidebar.tsx         # Folder sidebar
│   ├── LeadProfilePanel.tsx     # Right drawer panel
│   ├── BulkActions.tsx          # Bulk action toolbar
│   └── ConnectedAccountFilter.tsx # Account filter
│
├── hooks/
│   ├── useConversations.tsx     # Conversation hooks
│   ├── useMessages.tsx          # Message hooks
│   ├── useEmailSync.tsx         # Sync hooks
│   ├── useWorkspace.tsx         # Workspace hooks
│   └── useConnectedAccounts.tsx # Account hooks
│
└── lib/
    ├── api-client.ts            # API client setup
    └── backend-api.ts           # API endpoint definitions
```

### Backend Key Files

```
Converso-backend/src/
├── services/
│   ├── emailSync.ts             # Email sync orchestration
│   ├── gmailIntegration.ts      # Gmail API wrapper
│   ├── outlookIntegration.ts    # Outlook API wrapper
│   ├── conversations.ts         # Conversation logic
│   └── messages.ts              # Message operations
│
├── api/
│   ├── conversations.ts         # Conversation DB queries
│   ├── messages.ts              # Message DB queries
│   └── workspace.ts             # Workspace queries
│
├── routes/
│   ├── conversations.routes.ts  # Conversation endpoints
│   ├── messages.routes.ts       # Message endpoints
│   ├── emailSync.routes.ts      # Sync endpoints
│   └── connectedAccounts.routes.ts # Account endpoints
│
└── utils/
    └── transformers.ts          # Data transformation
```

### Database Files

```
Converso-frontend/supabase/migrations/
├── [various migration files]
└── 20251130000001_add_outlook_fields.sql

Root directory:
├── SETUP_DATABASE_FOR_EMAIL_SYNC.sql  # Setup script
└── CLEANUP_DUMMY_DATA.sql             # Cleanup script
```

---

## 🔑 Key Functions Reference

### Frontend Functions

#### EmailInbox.tsx
```typescript
// State Management
setSelectedConversation(id: string)
setAccountFilter(filter: string)
setSearchQuery(query: string)
handleToggleSelect(id: string)
handleSelectAll()

// Filtering
filteredConversations = conversations.filter(...)
  - matchesAccount
  - matchesSearch
  - matchesFolder

// Auto-sync
useEffect(() => {
  // Auto-trigger sync for connected accounts
}, [user, connectedAccounts])
```

#### EmailView.tsx
```typescript
// Mark as read after 5 seconds
useEffect(() => {
  const timer = setTimeout(() => {
    toggleRead.mutate({ conversationId, isRead: true });
  }, 5000);
  return () => clearTimeout(timer);
}, [conversation.id, conversation.is_read]);

// Reply handling
handleReplyClick(type: "reply" | "replyAll" | "forward")
handleSend()
```

#### ConversationList.tsx
```typescript
// Read/unread logic
const isUnread = !(conversation.isRead ?? conversation.is_read ?? false);

// Toggle read
handleToggleRead(conversation) {
  toggleRead.mutate({ 
    conversationId: conversation.id, 
    isRead: !currentReadStatus 
  });
}
```

### Backend Functions

#### emailSync.ts
```typescript
async syncEmailsForAccount(accountId: string): Promise<SyncResult>
async fetchAndStoreEmailBody(conversationId, messageId, account): Promise<string>
```

#### gmailIntegration.ts
```typescript
async refreshGmailToken(account): Promise<TokenData>
async getGmailMessages(account, options): Promise<GmailMessage[]>
async getGmailMessageBody(account, messageId): Promise<string>
```

#### conversations.ts
```typescript
async getConversations(userId, userRole, type): Promise<Conversation[]>
async toggleRead(conversationId, isRead): Promise<void>
async assignConversation(conversationId, sdrId): Promise<void>
```

---

## 🚀 Getting Started (Quick Reference)

### To Resume Development:

1. **Start Backend:**
   ```bash
   cd Converso-backend
   npm install
   npm run dev
   # Runs on port 3001
   ```

2. **Start Frontend:**
   ```bash
   cd Converso-frontend
   npm install
   npm run dev
   # Runs on port 3000
   ```

3. **Database Setup:**
   - Ensure Supabase is configured
   - Run `SETUP_DATABASE_FOR_EMAIL_SYNC.sql` if needed
   - Check migrations are applied

4. **Environment Variables:**
   - Backend: `.env` with Supabase keys, OAuth credentials
   - Frontend: `.env` with VITE_API_URL, Supabase keys

### Common Tasks:

**View Email Inbox:**
- Navigate to `/email-inbox`
- Select conversation to view email
- Right drawer shows lead profile

**Trigger Email Sync:**
- Go to Settings → Integrations
- Connect Gmail/Outlook account
- Sync starts automatically
- Check sync status in inbox

**Mark Email as Read/Unread:**
- Click dropdown menu (three dots) on conversation
- Select "Mark as Read" or "Mark as Unread"
- Black dot appears/disappears accordingly

**View Full Email Body:**
- Click on any conversation
- Email body loads automatically
- Full HTML content displayed

---

## 📝 Important Notes

### Read/Unread Implementation
- Uses `is_read` boolean field in conversations table
- Black dot (●) shown for unread emails
- Auto-marks as read after 5 seconds of viewing
- No toast notifications for read/unread changes

### Email Body Fetching
- Metadata synced initially (subject, preview)
- Full body fetched lazily when email opened
- Stored in `messages.email_body` field
- HTML rendered with `dangerouslySetInnerHTML`

### Layout Constraints
- Fixed widths prevent horizontal scrolling
- Only internal panels scroll vertically
- Main container: `overflow-hidden`
- Panels: `overflow-y-auto`

### Database Access
- Uses `supabaseAdmin` for admin operations (bypasses RLS)
- Client operations use regular `supabase` (respects RLS)
- All conversation/message queries use admin client

---

## 🔍 Debugging Tips

### Email Not Syncing
1. Check sync_status table for error messages
2. Verify OAuth tokens are valid
3. Check API rate limits
4. Review backend logs

### Email Body Not Showing
1. Check `has_full_body` flag in conversations
2. Verify `email_body` field in messages table
3. Check API credentials for Gmail/Outlook
4. Review network requests in browser

### Read Status Not Updating
1. Check `is_read` field in database
2. Verify `toggleRead` mutation is called
3. Check React Query cache invalidation
4. Review backend logs for errors

### Layout Issues
1. Check fixed width constraints
2. Verify overflow settings
3. Check Tailwind classes
4. Inspect computed styles in browser

---

## 📚 Additional Resources

### Setup Guides
- `START_HERE.md` - Initial setup guide
- `EMAIL_SYNC_COMPLETE_SOLUTION.md` - Email sync documentation
- `SETUP_DATABASE_FOR_EMAIL_SYNC.sql` - Database setup script

### Configuration Files
- `Converso-frontend/.env` - Frontend environment variables
- `Converso-backend/.env` - Backend environment variables
- `Converso-frontend/vite.config.ts` - Vite configuration

---

**End of Reference Guide**

*For questions or issues, refer to specific component files or API route handlers for detailed implementation.*
