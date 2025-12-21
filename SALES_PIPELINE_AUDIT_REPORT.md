# SALES PIPELINE AUDIT REPORT

**Date:** December 19, 2025  
**Purpose:** Understand current Sales Pipeline architecture before redesigning Email pipeline to show one tile per sender (not per conversation)

---

## 1. Frontend Files & Components

| File | Component | Purpose | Data Source | Card ID Type |
|------|-----------|---------|-------------|--------------|
| `Converso-frontend/src/pages/SalesPipeline.tsx` | `SalesPipeline` | Main pipeline page, manages filters & modal state | `useConversations()`, `usePipelineStages()`, `useTeamMembers()` | `conversation.id` |
| `Converso-frontend/src/components/Pipeline/KanbanBoard.tsx` | `KanbanBoard` | Renders kanban columns, handles drag/drop, filters conversations | `useConversations()` (all conversations), `usePipelineStages()` | `conversation.id` |
| `Converso-frontend/src/components/Pipeline/KanbanColumn.tsx` | `KanbanColumn` | Renders single stage column with conversation cards | Receives filtered `Conversation[]` from parent | `conversation.id` |
| `Converso-frontend/src/components/Pipeline/LeadTile.tsx` | `LeadTile` | Renders individual pipeline card/tile | Receives single `Conversation` object | `conversation.id` |
| `Converso-frontend/src/components/Pipeline/LeadDetailsModal.tsx` | `LeadDetailsModal` | Modal showing Activities & Conversation History tabs | `useMessages(conversationId)`, `ActivityTimeline(conversationId)` | `conversation.id` |
| `Converso-frontend/src/components/Pipeline/PipelineFilters.tsx` | `PipelineFilters` | Filter UI (search, channel, assigned to, stages, date range) | Receives filters object, no direct data fetch | N/A |

### Card Object Shape (from `LeadTile.tsx` and `KanbanBoard.tsx`)

**Fields Used in UI:**
- `conversation.id` - Unique identifier (used for drag/drop, click handlers)
- `conversation.sender_name` - Displayed as card title
- `conversation.subject` - Displayed below sender name
- `conversation.preview` - Email preview (2 lines max)
- `conversation.conversation_type` - 'email' or 'linkedin' (determines icon)
- `conversation.assigned_to` - SDR user ID (used to show assigned SDR name)
- `conversation.custom_stage_id` - Pipeline stage ID (determines which column)
- `conversation.stage_assigned_at` - Date shown on card (fallback to `last_message_at`)
- `conversation.received_account` - Account name shown on card
- `conversation.last_message_at` - Fallback date if `stage_assigned_at` missing

---

## 2. API Endpoints Used

| Endpoint | Method | Frontend Caller | Backend Route | Service | DB Tables |
|----------|--------|-----------------|---------------|---------|-----------|
| `/api/conversations` | GET | `conversationsApi.list()` | `conversations.routes.ts:16` | `conversationsService.getConversations()` | `conversations` (via `conversationsApi.getConversations()`) |
| `/api/conversations/:id/stage` | PATCH | `conversationsApi.updateStage()` | `conversations.routes.ts:156` | `conversationsService.updateStage()` | `conversations` (updates `custom_stage_id`, `stage_assigned_at`) |
| `/api/pipeline-stages` | GET | `pipelineStagesApi.list()` | `pipeline-stages.routes.ts` | `pipelineStagesService.list()` | `pipeline_stages` |
| `/api/messages/conversation/:id` | GET | `messagesApi.getByConversation()` | `messages.routes.ts` | `messagesService.getByConversation()` | `messages` (filtered by `conversation_id`) |
| `/api/conversations/:id/assign` | PATCH | `conversationsApi.assign()` | `conversations.routes.ts:77` | `conversationsService.assignConversation()` | `conversations` (updates `assigned_to`) |

### Request/Response Shapes

**GET `/api/conversations`:**
- **Request Params:** `type?`, `folder?`, `userId` (from header), `userRole` (from header)
- **Response:** `{ data: Conversation[] }`
- **Important Fields:** `id`, `sender_name`, `sender_email`, `custom_stage_id`, `assigned_to`, `conversation_type`, `last_message_at`, `stage_assigned_at`

**PATCH `/api/conversations/:id/stage`:**
- **Request Body:** `{ stageId: string | null }`
- **Response:** `{ message: 'Stage updated successfully' }`
- **DB Updates:** `conversations.custom_stage_id`, `conversations.stage_assigned_at` (via trigger)

---

## 3. Current Pipeline Card Schema

### Exact Fields Used (from `transformConversation` and UI components)

**Identity:**
- `id` (UUID) - Primary key, used as card identifier
- `conversation_type` ('email' | 'linkedin') - Determines icon and channel

**Sender/Lead Info:**
- `sender_name` (TEXT) - Card title
- `sender_email` (TEXT) - Lead email address
- `sender_linkedin_url` (TEXT) - LinkedIn profile (LinkedIn only)
- `company_name` (TEXT) - Company name
- `location` (TEXT) - Location
- `mobile` (TEXT) - Phone number

**Conversation Metadata:**
- `subject` (TEXT) - Email subject line
- `preview` (TEXT) - Email preview snippet
- `last_message_at` (TIMESTAMPTZ) - Last message timestamp

**Pipeline State:**
- `custom_stage_id` (UUID) - References `pipeline_stages.id`
- `stage_assigned_at` (TIMESTAMPTZ) - When assigned to stage (auto-set by trigger)
- `assigned_to` (UUID) - References `auth.users.id` (SDR assignment)

**Account Info:**
- `received_account` (object) - Connected account info
  - `account_name` (TEXT)
  - `account_email` (TEXT)

**Filtering Fields:**
- `workspace_id` (UUID) - Workspace isolation
- `is_read` (BOOLEAN) - Read status
- `is_favorite` (BOOLEAN) - Favorite status

---

## 4. EMAIL Conversation Model

### How Conversations Are Created

**File:** `Converso-backend/src/services/emailSync.ts` (lines 276-354)

**Process:**
1. **Email sync** receives email metadata (from Gmail/Outlook API)
2. **Thread matching:** Looks for existing conversation by:
   - `gmail_thread_id` (Gmail) OR `outlook_conversation_id` (Outlook)
   - For **sent emails**, also matches by `sender_email` (recipient email)
3. **If found:** Updates `last_message_at` only (conversation immutability rule)
4. **If not found:** Creates new conversation record with:
   - `sender_name` = other person's name (recipient for sent, sender for inbox)
   - `sender_email` = other person's email
   - `subject` = email subject
   - `gmail_thread_id` OR `outlook_conversation_id` = thread ID
   - `workspace_id` = user's workspace

### Why Multiple Conversations Exist Per Sender

**Root Cause:** **One conversation per email thread** (not per sender)

**Explanation:**
- Gmail/Outlook group emails by **thread** (conversation chain)
- Each thread gets its own `gmail_thread_id` or `outlook_conversation_id`
- If sender sends **multiple separate email threads**, each thread becomes a **separate conversation**
- Example:
  - Thread 1: "Re: Product Inquiry" → Conversation A
  - Thread 2: "New Question" → Conversation B
  - Thread 3: "Follow-up" → Conversation C
  - **Result:** 3 conversations for same sender email

**Uniqueness Criteria:**
- **Primary:** `gmail_thread_id` OR `outlook_conversation_id` (thread ID)
- **Secondary (sent only):** `sender_email` (recipient email)
- **Workspace:** `workspace_id` (isolation)

**No Grouping Concept:**
- ❌ No `group_id`, `lead_id`, `contact_id`, `conversation_group`
- ❌ No `sender_email_normalized` normalization
- ❌ No sender-level aggregation exists

---

## 5. Stage & Assignment Write Path

### Stage Update Chain

**Frontend:**
1. User drags card to new column → `KanbanBoard.handleDrop()`
2. Calls `updateStage.mutate({ conversationId, stageId })`
3. Hook: `useUpdateConversationStage()` → `conversationsApi.updateStage()`

**Backend:**
1. **Route:** `PATCH /api/conversations/:id/stage` (`conversations.routes.ts:156`)
2. **Service:** `conversationsService.updateStage()` (`conversations.ts:87`)
3. **API:** `conversationsApi.updateConversationStage()` (`conversations.ts`)
4. **DB Update:** `supabaseAdmin.from('conversations').update({ custom_stage_id: stageId })`

**Database:**
- **Table:** `conversations`
- **Columns Updated:**
  - `custom_stage_id` (UUID) - Set to new stage ID or NULL
  - `stage_assigned_at` (TIMESTAMPTZ) - **Auto-set by trigger** when `custom_stage_id` changes
- **Trigger:** `trigger_update_stage_assigned_at` (`20251215000001_add_stage_assigned_at.sql`)
- **Activity Log:** `conversation_activities` table (via `enforce_sdr_updates` trigger)

### Assignment Update Chain

**Frontend:**
1. User assigns SDR → `conversationsApi.assign(conversationId, sdrId)`

**Backend:**
1. **Route:** `PATCH /api/conversations/:id/assign` (`conversations.routes.ts:77`)
2. **Service:** `conversationsService.assignConversation()` (`conversations.ts:29`)
3. **API:** `conversationsApi.assignConversation()` (`conversations.ts`)
4. **DB Update:** `supabaseAdmin.from('conversations').update({ assigned_to: sdrId })`

**Database:**
- **Table:** `conversations`
- **Column Updated:** `assigned_to` (UUID) - References `auth.users.id`

---

## 6. Lead Details Modal

### How It Loads Activities

**Component:** `LeadDetailsModal.tsx` (line 104)

**Implementation:**
- Uses `<ActivityTimeline conversationId={conversation.id} />` component
- **ActivityTimeline** (`ActivityTimeline.tsx`):
  - **Direct Supabase Query:** `supabase.from('conversation_activities').select(...).eq('conversation_id', conversationId)`
  - **No backend API endpoint** - queries database directly via Supabase client
  - **Real-time subscription:** `postgres_changes` on `conversation_activities` table
  - **Join:** Joins with `profiles` table to get `actor_name`

**Data Source:**
- **Table:** `conversation_activities`
- **Fields:** `id`, `activity_type`, `meta`, `created_at`, `actor_user_id`
- **Filter:** `conversation_id = conversation.id`
- **Order:** `created_at DESC`

### How It Loads Conversation History

**Component:** `LeadDetailsModal.tsx` (line 26)

**Implementation:**
- Uses `useMessages(conversation?.id || null)` hook
- **Hook:** `useMessages.tsx` → `messagesApi.getByConversation(conversationId)`
- **API:** `GET /api/messages/conversation/:id`
- **Backend:** `messages.routes.ts` → `messagesService.getByConversation()`
- **DB Query:** `messages` table filtered by `conversation_id`

**Rendering:**
- Shows full message `content` (email body)
- Displays `sender_name`, `created_at` timestamp
- Shows `is_from_lead` flag (styling difference)

**Why Full Email Body Shows:**
- `messages.content` contains full email body text
- No truncation or preview logic in modal
- Each message in thread is displayed sequentially

---

## 7. Activities Failure Cause

### Current Implementation

**Component:** `ActivityTimeline.tsx` (lines 154-198)

**Query Method:**
- **Direct Supabase client** query (not via backend API)
- Query: `supabase.from('conversation_activities').select(...).eq('conversation_id', conversationId)`

**RLS Policies (from migration `20251219000002_sdrxs_phase2_sdr_write_permissions.sql`):**

1. **Admin Policy:** Can view all activities in workspace
   ```sql
   USING (
     public.has_role(auth.uid(), 'admin')
     AND workspace_id = public.get_user_workspace_id(auth.uid())
   )
   ```

2. **SDR Policy:** Can view activities for assigned conversations only
   ```sql
   USING (
     public.has_role(auth.uid(), 'sdr')
     AND EXISTS (
       SELECT 1 FROM public.conversations
       WHERE conversations.id = conversation_activities.conversation_id
         AND conversations.assigned_to = auth.uid()
         AND conversations.workspace_id = public.get_user_workspace_id(auth.uid())
     )
   )
   ```

### Likely Failure Reasons

**Best Guess:** **RLS Policy Blocking**

**Evidence:**
1. **Direct Supabase query** uses authenticated user context (`auth.uid()`)
2. **SDR policy** requires:
   - User has 'sdr' role
   - Conversation is assigned to user (`conversations.assigned_to = auth.uid()`)
   - Workspace matches (`workspace_id = get_user_workspace_id(auth.uid())`)
3. **Admin policy** requires:
   - User has 'admin' role
   - Workspace matches

**Possible Issues:**
- ❌ User role not set correctly in `user_roles` table
- ❌ `workspace_id` mismatch between conversation and user profile
- ❌ Conversation not assigned (for SDR users)
- ❌ `get_user_workspace_id()` function returning wrong workspace
- ❌ Supabase client not authenticated properly

**No Backend Endpoint:**
- ❌ No `/api/conversations/:id/activities` endpoint exists
- ❌ Activities are queried directly from frontend
- ✅ Table exists (`conversation_activities`)
- ✅ RLS policies exist

**Error Handling:**
- Component shows "Failed to load activities" if `fetchError` occurs
- Error logged to console: `[ActivityTimeline] Error fetching activities:`

---

## 8. What We Can Safely Change Without Breaking Inbox

### Safe Extension Points

✅ **Frontend Pipeline Components:**
- `KanbanBoard.tsx` - Can modify filtering/grouping logic
- `LeadTile.tsx` - Can change card display (but keep `conversation.id` for now)
- `SalesPipeline.tsx` - Can add new filters or grouping UI

✅ **Backend API:**
- Can add new endpoint: `GET /api/conversations/by-sender` (grouped by sender_email)
- Can add new field to response: `sender_conversation_count` (number of conversations per sender)
- Can add aggregation endpoint: `GET /api/conversations/grouped-by-sender`

✅ **Database:**
- Can add computed view: `conversations_by_sender` (groups by sender_email)
- Can add helper function: `get_sender_conversations(sender_email)`
- **DO NOT** modify `conversations` table structure (breaks sync)

✅ **Frontend Hooks:**
- Can create new hook: `useConversationsBySender()` (groups by sender_email)
- Can modify `useConversations()` to accept grouping parameter

### What NOT to Change

❌ **Email Sync Logic:**
- `emailSync.ts` - Conversation creation logic must remain thread-based
- Thread ID matching (`gmail_thread_id`, `outlook_conversation_id`)
- Conversation immutability rule (sender_name, sender_email, subject)

❌ **Database Schema:**
- `conversations` table columns (breaks sync and existing queries)
- `messages` table structure (breaks message display)
- RLS policies on `conversations` (breaks SDR visibility)

❌ **Backend Routes:**
- `/api/conversations` GET endpoint signature (used by inbox)
- `/api/conversations/:id/stage` PATCH endpoint (used by pipeline drag/drop)
- `/api/messages/conversation/:id` GET endpoint (used by modal)

### Recommended Approach

**Phase 1: Add Grouping Layer (Non-Breaking)**
1. Create new backend endpoint: `GET /api/conversations/by-sender?type=email`
2. Returns grouped data: `{ sender_email, sender_name, conversations: Conversation[] }`
3. Frontend pipeline uses this endpoint instead of `/api/conversations`
4. Inbox continues using `/api/conversations` (unchanged)

**Phase 2: Update Pipeline UI**
1. Modify `KanbanBoard` to group by sender_email
2. Show one tile per sender (aggregate latest conversation data)
3. On click, show all conversations from that sender
4. Stage/assignment updates apply to all conversations for that sender

**Phase 3: Backend Bulk Updates**
1. Add endpoint: `PATCH /api/conversations/by-sender/:senderEmail/stage`
2. Updates `custom_stage_id` for all conversations with that `sender_email`
3. Add endpoint: `PATCH /api/conversations/by-sender/:senderEmail/assign`
4. Updates `assigned_to` for all conversations with that `sender_email`

---

## Summary

### Current Architecture
- **Pipeline shows:** One card per conversation (thread)
- **Data source:** `conversations` table directly
- **Grouping:** None (each thread = separate conversation)
- **Stage updates:** Per conversation (`custom_stage_id`)
- **Assignment:** Per conversation (`assigned_to`)

### Key Findings
1. ✅ Email conversations are created per **thread** (not per sender)
2. ✅ Multiple threads from same sender = multiple conversations
3. ✅ No sender-level grouping exists
4. ✅ Activities query directly from Supabase (RLS may be blocking)
5. ✅ Conversation History shows full email body (from `messages.content`)

### Safe Change Path
- ✅ Add sender-grouping endpoint (non-breaking)
- ✅ Modify pipeline UI to group by sender_email
- ✅ Add bulk update endpoints for stage/assignment
- ❌ Do NOT modify email sync logic or conversation creation
- ❌ Do NOT change database schema or RLS policies

---

**END OF AUDIT REPORT**

