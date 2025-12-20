# SYSTEM SNAPSHOT – CURRENT STATE

## 1. Core Data Models / Tables

### Profiles
- **Table name**: `profiles`
- **Purpose**: User profiles linked to Supabase auth.users
- **Key fields**: `id` (UUID, FK to auth.users), `email`, `full_name`, `avatar_url`, `workspace_id` (UUID, FK to workspaces), `status` ('active' | 'invited'), `created_at`, `updated_at`

### User Roles
- **Table name**: `user_roles`
- **Purpose**: Maps users to roles (admin/sdr)
- **Key fields**: `id` (UUID), `user_id` (UUID, FK to auth.users), `role` (enum: 'admin' | 'sdr'), `created_at`
- **Constraint**: UNIQUE(user_id, role)

### Workspaces
- **Table name**: `workspaces`
- **Purpose**: Multi-tenant workspace isolation
- **Key fields**: `id` (UUID), `name`, `created_at`, `updated_at`
- **Note**: Default workspace "My Workspace" created automatically

### Connected Accounts
- **Table name**: `connected_accounts`
- **Purpose**: Stores OAuth-connected email/LinkedIn accounts
- **Key fields**: `id` (UUID), `user_id` (UUID, FK to auth.users), `account_type` (enum: 'email' | 'linkedin'), `account_email`, `account_name`, `is_active`, `workspace_id` (UUID, FK to workspaces), `oauth_provider` ('google' | 'microsoft' | 'linkedin'), `oauth_access_token`, `oauth_refresh_token`, `oauth_token_expires_at`, `unipile_account_id` (for LinkedIn), `sync_status`, `last_synced_at`, `sync_error`, `created_at`

### Conversations
- **Table name**: `conversations`
- **Purpose**: Unified conversation/thread container for emails and LinkedIn messages
- **Key fields**: 
  - `id` (UUID), `conversation_type` (enum: 'email' | 'linkedin'), `sender_name`, `sender_email`, `sender_linkedin_url`, `subject`, `preview`, `assigned_to` (UUID, FK to auth.users, nullable), `status` (enum: 'new' | 'engaged' | 'qualified' | 'converted' | 'not_interested'), `is_read`, `is_favorite`, `custom_stage_id` (UUID, FK to pipeline_stages), `stage_assigned_at`, `received_on_account_id` (UUID, FK to connected_accounts), `workspace_id` (UUID, FK to workspaces), `last_message_at`, `created_at`
  - Email-specific: `gmail_thread_id`, `gmail_message_id`, `outlook_conversation_id`, `outlook_message_id`, `email_folder` (deprecated, kept for backward compatibility), `email_timestamp`
  - LinkedIn-specific: `chat_id` (Unipile chat ID), `sender_attendee_id`, `sender_profile_picture_url`
  - Lead profile: `company_name`, `location`, `mobile`
- **Note**: For emails, `sender_name`/`sender_email` represent the OTHER person (recipient for sent, sender for inbox). Folder information is derived from latest message's `provider_folder`.

### Messages
- **Table name**: `messages`
- **Purpose**: Individual messages within conversations (shared table for email and LinkedIn)
- **Key fields**: 
  - `id` (UUID), `conversation_id` (UUID, FK to conversations), `sender_id` (UUID, FK to auth.users, nullable), `sender_name`, `sender_email`, `content`, `is_from_lead` (boolean), `created_at`, `workspace_id` (UUID, FK to workspaces)
  - Email-specific: `conversation_type` ('email'), `is_sent` (boolean), `subject`, `text_body`, `html_body`, `email_body` (legacy), `gmail_message_id`, `outlook_message_id`, `provider_message_id` (unified), `provider_thread_id` (unified), `provider_folder` ('inbox' | 'sent' | 'trash' | 'archive' | 'drafts' | 'important')
  - LinkedIn-specific: `linkedin_message_id` (Unipile message ID), `linkedin_sender_profile_url`
- **Constraint**: UNIQUE(provider_message_id, workspace_id) WHERE provider_message_id IS NOT NULL

### LinkedIn Conversations (Separate Table)
- **Table name**: `linkedin_conversations`
- **Purpose**: Separate storage for LinkedIn conversations (synced from Unipile)
- **Key fields**: `id` (UUID), `unipile_chat_id` (UNIQUE), `title`, `participant_ids` (JSONB), `latest_message_at`, `workspace_id`, `account_id` (FK to connected_accounts), `is_read`, `created_at`, `updated_at`

### LinkedIn Messages (Separate Table)
- **Table name**: `linkedin_messages`
- **Purpose**: Separate storage for LinkedIn messages (synced from Unipile)
- **Key fields**: `id` (UUID), `unipile_message_id` (UNIQUE), `conversation_id` (FK to linkedin_conversations), `sender_id`, `sender_name`, `content`, `timestamp`, `direction` ('in' | 'out'), `attachments` (JSONB), `raw_json` (JSONB), `workspace_id`, `account_id`, `created_at`

### Pipeline Stages
- **Table name**: `pipeline_stages`
- **Purpose**: Custom pipeline stages for lead management
- **Key fields**: `id` (UUID), `name`, `description`, `display_order`, `workspace_id` (UUID, FK to workspaces), `created_at`, `updated_at`

### Email Templates
- **Table name**: `email_templates`
- **Purpose**: Saved email templates for quick replies
- **Key fields**: `id` (UUID), `name`, `subject`, `body`, `workspace_id` (UUID, FK to workspaces), `created_at`, `updated_at`

### Lead Notes
- **Table name**: `lead_notes`
- **Purpose**: Notes attached to conversations/leads
- **Key fields**: `id` (UUID), `conversation_id` (UUID, FK to conversations), `user_id` (UUID, FK to auth.users), `content`, `created_at`, `updated_at`

### Routing Rules
- **Table name**: `routing_rules`
- **Purpose**: Auto-assignment rules for incoming conversations
- **Key fields**: `id` (UUID), `name`, `condition_field`, `condition_operator`, `condition_value`, `action_type`, `action_value`, `is_active`, `workspace_id` (UUID, FK to workspaces), `created_at`, `updated_at`

### Sync Status
- **Table name**: `sync_status`
- **Purpose**: Tracks sync progress for connected accounts
- **Key fields**: `id` (UUID), `workspace_id` (UUID, FK to workspaces), `account_id` (UUID, FK to connected_accounts), `status` ('pending' | 'syncing' | 'success' | 'error'), `progress_percentage`, `last_synced_at`, `error_message`, `created_at`, `updated_at`

---

## 2. Lead ↔ Conversation ↔ Message Mapping

### Email Channel
- **Conversation = Lead**: Each `conversations` record represents a lead (the other person in the email thread)
- **No separate leads table**: Conversations table IS the leads table
- **Message linking**: Messages link to conversations via `conversation_id`
- **Thread grouping**: Email conversations are grouped by `gmail_thread_id` (Gmail) or `outlook_conversation_id` (Outlook)
- **Sent email handling**: For sent emails, `sender_name`/`sender_email` in conversation represent the recipient (other person). Messages have `is_sent=true` and `provider_folder='sent'`
- **Forwarded email grouping**: Sent emails are matched by thread ID AND recipient email to prevent forwarded emails from grouping incorrectly

### LinkedIn Channel
- **Dual storage**: LinkedIn data stored in both `conversations`/`messages` (unified inbox) AND `linkedin_conversations`/`linkedin_messages` (Unipile sync)
- **Conversation = Lead**: Each `conversations` record with `conversation_type='linkedin'` represents a lead
- **Message linking**: LinkedIn messages link to conversations via `conversation_id`
- **Unipile mapping**: `chat_id` in conversations maps to `unipile_chat_id` in `linkedin_conversations`

### Lead Assignment
- **Field**: `assigned_to` (UUID, FK to auth.users) on `conversations` table
- **Assignment affects visibility**: SDRs only see conversations where `assigned_to = their_user_id` OR `assigned_to IS NULL`
- **Bulk reassignment**: API endpoint exists for bulk reassignment from one SDR to another

---

## 3. Channels & Inbox Architecture

### Supported Channels
1. **Gmail** (via Google OAuth2 API)
2. **Outlook** (via Microsoft Graph API)
3. **LinkedIn** (via Unipile API integration)

### Storage Architecture
- **Unified storage**: Email and LinkedIn messages share the same `messages` table (differentiated by `conversation_type`)
- **LinkedIn dual storage**: LinkedIn also has separate `linkedin_conversations` and `linkedin_messages` tables for Unipile sync
- **Email folders**: Folder information stored at MESSAGE level (`provider_folder`), not conversation level
- **Folder derivation**: Conversation folder is derived from latest message's `provider_folder` when filtering by folder

### Email Folders
- **Supported folders**: 'inbox', 'sent', 'trash' (synced as 'deleted' in UI but normalized to 'trash'), 'archive', 'drafts', 'important'
- **Folder sync**: Each folder synced separately from Gmail/Outlook APIs
- **Provider normalization**: Folder names normalized across Gmail/Outlook (e.g., 'DeletedItems' → 'trash', 'SentItems' → 'sent')
- **Folder filtering**: Conversations filtered by folder using `provider_folder` on messages table (provider-truth only, no inference)

### Message Body Storage
- **Lazy loading**: Email bodies (`html_body`, `text_body`) fetched on-demand when user opens email
- **Storage location**: Bodies stored in `messages` table, not `conversations` table
- **Legacy field**: `email_body` kept for backward compatibility
- **Body fetching**: Bodies fetched via Gmail API (`messages.get`) or Outlook Graph API (`/me/messages/{id}`) when missing

---

## 4. Authentication & Roles

### Authentication Method
- **Primary**: Supabase Auth (JWT tokens)
- **Middleware**: `authenticate` middleware in `src/middleware/auth.ts`
- **Token sources**: 
  - Authorization header: `Bearer <token>`
  - Custom header: `x-user-id` (for development/mock auth)
- **User verification**: Middleware verifies user exists in `profiles` table

### User Roles
- **Roles**: 'admin' | 'sdr' (stored in `user_roles` table)
- **Role assignment**: First user automatically becomes 'admin' on signup. Subsequent signups blocked (must be added by admin)
- **Role checks**: `has_role(user_id, role)` function used in RLS policies

### Multi-User Support
- **Multiple users**: Yes, multiple users can log in
- **Workspace isolation**: Data filtered by `workspace_id` (users in same workspace see same data)
- **Default workspace**: All users assigned to default "My Workspace" on signup

---

## 5. Ownership & Assignment

### Lead Assignment
- **Field**: `assigned_to` (UUID, FK to auth.users) on `conversations` table
- **Nullable**: `assigned_to` can be NULL (unassigned leads visible to all SDRs)
- **Assignment API**: `PATCH /api/conversations/:id/assign` endpoint
- **Bulk reassignment**: `POST /api/conversations/bulk-reassign` endpoint

### Assignment Visibility
- **Admins**: See all conversations (no filtering by assignment)
- **SDRs**: See conversations where `assigned_to = their_user_id` OR `assigned_to IS NULL`
- **RLS enforcement**: Database-level RLS policies enforce this:
  - Policy: "SDRs can view assigned conversations" uses `assigned_to = auth.uid()`
  - Policy: "Admins can view all conversations" uses `has_role(auth.uid(), 'admin')`

### Pipeline Stage Assignment
- **Field**: `custom_stage_id` (UUID, FK to pipeline_stages) on `conversations` table
- **Stage assignment timestamp**: `stage_assigned_at` tracks when stage was assigned
- **API**: `PATCH /api/conversations/:id/stage` endpoint

---

## 6. API & Permission Enforcement

### Backend Permission Enforcement
- **RLS enabled**: All tables have Row Level Security (RLS) enabled
- **RLS policies**:
  - **Profiles**: Users can view all profiles, update own profile
  - **User Roles**: Users can view own roles, admins can manage all roles
  - **Connected Accounts**: Admins can view/manage all connected accounts
  - **Conversations**: 
    - Admins can view/manage all conversations
    - SDRs can view conversations where `assigned_to = auth.uid()` OR `assigned_to IS NULL`
    - SDRs can update conversations where `assigned_to = auth.uid()`
  - **Messages**: Users can view/insert messages from conversations they have access to (via conversation RLS)
  - **Workspaces**: Users can view workspace, admins can manage workspace
  - **LinkedIn tables**: Users can view LinkedIn data in their workspace

### Backend API Access Control
- **Authentication middleware**: Most routes use `authenticate` middleware (some use `optionalAuth`)
- **Role-based routes**: Some routes check `req.user.role` (e.g., admin-only endpoints)
- **Workspace filtering**: Backend APIs filter by `workspace_id` from user's profile
- **SDR filtering**: Backend APIs filter conversations by `assigned_to` when `userRole === 'sdr'`

### Frontend Permission Enforcement
- **UI hiding**: Frontend hides actions based on user role (e.g., SDRs don't see admin settings)
- **Backend validation**: Backend validates permissions even if frontend allows action
- **No client-side security**: All security enforced server-side via RLS and middleware

---

## 7. UI Capabilities (Current)

### Email Inbox
- **View emails**: View email conversations in unified inbox
- **Folder navigation**: Filter by folder (Inbox, Sent, Trash, Archive, Drafts, Important)
- **Email body rendering**: Render HTML and plain text email bodies with sanitization
- **Reply**: Reply to emails (compose UI with rich text editor)
- **Reply All**: Reply all functionality
- **Forward**: Forward emails
- **Send email**: Send emails via Gmail/Outlook APIs (`POST /api/emails/send`)
  - **Gmail**: Uses `gmail.users.messages.send()` API with proper threading headers
  - **Outlook**: Uses Microsoft Graph API `/me/sendMail` or `/me/messages/{id}/reply`
  - **Provider-sync-first**: After sending, relies on syncing sent email from provider's Sent folder (does not create local message immediately)
  - **Token refresh**: Automatically refreshes OAuth tokens if expired during send
- **Mark as read/unread**: Toggle read status
- **Delete conversation**: Delete conversation (soft delete via API)
- **Assign to SDR**: Assign conversation to team member
- **Change pipeline stage**: Update conversation's pipeline stage
- **Favorite**: Toggle favorite flag
- **Update lead profile**: Edit sender name, email, company, location
- **View attachments**: Display email attachments (downloaded on-demand)

### LinkedIn Inbox
- **View LinkedIn messages**: View LinkedIn conversations in unified inbox
- **Send LinkedIn message**: Send messages via Unipile API (stored in messages table)
- **Sync LinkedIn**: Manual sync button to refresh messages from Unipile
- **Mark as read/unread**: Toggle read status
- **Assign to SDR**: Assign conversation to team member
- **Change pipeline stage**: Update conversation's pipeline stage
- **Favorite**: Toggle favorite flag
- **Update lead profile**: Edit sender name, LinkedIn URL, company, location

### Unified Inbox
- **Multi-channel view**: View email and LinkedIn conversations together
- **Channel filtering**: Filter by type ('email' | 'linkedin')
- **Search**: Search conversations (backend search endpoint exists)
- **Sorting**: Conversations sorted by `last_message_at` (newest first)

### Settings
- **Connect Gmail**: OAuth flow to connect Gmail account
- **Connect Outlook**: OAuth flow to connect Outlook account
- **Connect LinkedIn**: Connect LinkedIn via Unipile
- **Disconnect accounts**: Remove connected accounts
- **Reconnect accounts**: Re-authenticate and re-sync accounts
- **Team members**: View/manage team members (admin only)
- **Pipeline stages**: Create/edit/delete pipeline stages (admin only)
- **Email templates**: Create/edit/delete email templates (admin only)
- **Routing rules**: Create/edit/delete routing rules (admin only)

---

## 8. Working Features (Must Not Break)

### Email Sync
- **Gmail sync**: Syncs emails from Gmail API (metadata only, bodies lazy-loaded)
- **Outlook sync**: Syncs emails from Outlook Graph API (metadata only, bodies lazy-loaded)
- **Folder sync**: Syncs multiple folders (inbox, sent, trash, archive, drafts, important)
- **Incremental sync**: Supports incremental sync based on `last_synced_at`
- **Initial sync**: Syncs last 30 days (configurable via `EMAIL_INITIAL_SYNC_DAYS`)
- **Thread grouping**: Groups emails by thread ID (Gmail) or conversation ID (Outlook)
- **Sent folder sync**: Correctly syncs sent emails with proper recipient tracking
- **Trash folder sync**: Syncs deleted/trash folder from Gmail/Outlook

### Email Body Fetching
- **Lazy loading**: Email bodies fetched on-demand when user opens email
- **HTML/Text support**: Stores both `html_body` and `text_body` separately
- **Body rendering**: Frontend renders HTML with sanitization, falls back to plain text
- **Attachment support**: Downloads and displays email attachments

### LinkedIn Integration
- **Unipile integration**: Syncs LinkedIn conversations/messages via Unipile API
- **LinkedIn sending**: Sends LinkedIn messages via Unipile API
- **Manual sync**: Manual sync button to refresh LinkedIn data
- **Dual storage**: Stores LinkedIn data in both unified tables and LinkedIn-specific tables

### Unified Inbox UI
- **Multi-channel display**: Shows email and LinkedIn conversations together
- **Folder filtering**: Email folder filtering works correctly
- **Conversation list**: Displays correct sender/recipient based on folder context
- **Email view**: Displays correct From/To headers based on folder (sent vs inbox)
- **Message threading**: Shows all messages in a conversation thread

### Assignment & Pipeline
- **SDR assignment**: Assign conversations to SDRs
- **Pipeline stages**: Custom pipeline stages with assignment tracking
- **Bulk reassignment**: Bulk reassign conversations when SDR removed
- **Status updates**: Update conversation status (new, engaged, qualified, converted, not_interested)

### Authentication & Authorization
- **User authentication**: Supabase Auth with JWT tokens
- **Role-based access**: Admin/SDR roles enforced via RLS
- **Workspace isolation**: Data filtered by workspace_id
- **Assignment visibility**: SDRs only see assigned/unassigned conversations

---

## 9. Known Constraints or Risks

### Tight Couplings
- **LinkedIn workflow dependency**: User repeatedly emphasized "Do not disturb LinkedIn workflow" - indicates tight coupling between email and LinkedIn features
- **Transformers dependency**: `transformers.ts` must include all fields for frontend to receive data (recently fixed for `html_body`/`text_body`/`folder_*` fields)
- **Workspace fallback**: Backend falls back to first workspace if user has no `workspace_id` (legacy data handling)

### Fragile Areas
- **Email body fetching**: Bodies only fetched if `gmail_message_id` or `outlook_message_id` exists. Old conversations may be missing these IDs.
- **Folder derivation**: Conversation folder derived from latest message's `provider_folder`. If messages missing `provider_folder`, folder filtering fails.
- **Sent email grouping**: Forwarded emails grouped incorrectly if thread ID matches but recipient differs (recently fixed by adding recipient email check)
- **Legacy data**: Old conversations may have missing `workspace_id`, `provider_folder`, or provider message IDs, causing sync/display issues
- **RLS policies**: SDR visibility depends on `assigned_to` field. Unassigned conversations (`assigned_to IS NULL`) visible to all SDRs (may be intentional or risk)

### Incomplete Work
- **Email sending architecture**: Emails ARE sent via Gmail/Outlook APIs (`POST /api/emails/send`), but sent emails are NOT immediately stored locally. They rely on syncing from provider's Sent folder during next sync (provider-sync-first architecture). This may cause delay in seeing sent emails in Sent folder until next sync runs.
- **OAuth token refresh**: Token refresh logic exists but may not be fully tested for all providers
- **Incremental sync**: Incremental sync implemented but may have edge cases with timezone handling
- **Attachment downloading**: Attachments downloaded on-demand but may fail silently if provider API errors

### Data Consistency Risks
- **Dual LinkedIn storage**: LinkedIn data stored in both `conversations`/`messages` and `linkedin_conversations`/`linkedin_messages`. Risk of inconsistency if sync fails partially.
- **Email folder deprecation**: `email_folder` on conversations table is deprecated but still populated for backward compatibility. May cause confusion.
- **Message body fields**: Three fields for email body (`html_body`, `text_body`, `email_body`). Legacy `email_body` may contain stale data.

### TODOs / Comments
- **Auth middleware**: Comment in `src/middleware/auth.ts` says "TODO: Implement proper JWT verification" (currently trusts `x-user-id` header)
- **Workspace creation**: First user signup creates/assigns workspace, but subsequent users blocked (may need admin workflow for adding users)

---

## END OF ANALYSIS

