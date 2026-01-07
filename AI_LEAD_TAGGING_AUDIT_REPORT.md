# AI LEAD TAGGING AGENTS - FRONTEND-TO-BACKEND API AUDIT REPORT

**Date**: January 7, 2026  
**Mode**: AUDIT-ONLY (No Code Changes)  
**Scope**: Email Inbox, LinkedIn Inbox, Agent 1 (Intent Detection), Agent 2 (Lead Tagging)

---

## PHASE 1 — FRONTEND API DISCOVERY

### Discovered API Endpoints

#### **1. Conversations Endpoints**

| Endpoint | Method | Called From | Request Payload | Response Payload | Used For |
|----------|--------|-------------|-----------------|------------------|----------|
| `/api/conversations` | GET | `useConversations.tsx:77` | `{ type?: 'email'\|'linkedin', folder?: string }` | `Conversation[]` | Both |
| `/api/conversations/with-intents` | GET | `backend-api.ts:36` (defined but NOT currently called) | `{ type?: 'email'\|'linkedin', folder?: string }` | `Conversation[]` with `intent` field | Both (unused) |
| `/api/conversations/{id}` | GET | `backend-api.ts:50` | None | `Conversation` | Both |
| `/api/conversations/{id}/assign` | PATCH | `useConversations.tsx:118` | `{ sdrId: string \| null }` | `void` | Both |
| `/api/conversations/{id}/stage` | PATCH | `useConversations.tsx:243` | `{ stageId: string \| null }` | `void` | Both |
| `/api/conversations/{id}/read` | PATCH | `useConversations.tsx:173` | `{ isRead: boolean }` | `void` | Both |
| `/api/conversations/{id}/favorite` | PATCH | `useConversations.tsx:261` | `{ isFavorite: boolean }` | `void` | Both |
| `/api/conversations/{id}/status` | PATCH | `useConversations.tsx:142` | `{ status: 'new'\|'engaged'\|'qualified'\|'converted'\|'not_interested' }` | `void` | Both |
| `/api/conversations/{id}/profile` | PATCH | `useConversations.tsx:308` | `{ sender_name?, sender_email?, mobile?, company_name?, location? }` | `void` | Both |
| `/api/conversations/{id}/sync` | POST | `useConversations.tsx:353` | `{}` | `{ message: string, messagesCount?: number }` | LinkedIn only |
| `/api/conversations/{id}` | DELETE | `useConversations.tsx:278` | None | `void` | Both |
| `/api/conversations/bulk-reassign` | POST | `useConversations.tsx:332` | `{ fromSdrId: string, toSdrId: string \| null }` | `{ count: number }` | Both |
| `/api/conversations/email-sender-activities` | GET | `backend-api.ts:158` | `{ workspaceId: string, senderEmail: string }` | `{ activities: any[] }` | Email only |
| `/api/conversations/work-queue-view` | GET | `backend-api.ts:547` | `{ filter: 'all'\|'pending'\|'overdue'\|'idle' }` | `WorkQueueItem[]` | Both |
| `/api/conversations/mailbox-counts` | GET | Not found in frontend | N/A | N/A | N/A |

#### **2. Pipeline Endpoints**

| Endpoint | Method | Called From | Request Payload | Response Payload | Used For |
|----------|--------|-------------|-----------------|------------------|----------|
| `/api/pipeline/email-senders` | GET | `useConversations.tsx:27` | None | `SenderPipelineItem[]` | Email (Pipeline view) |
| `/api/pipeline/email-senders/stage` | PATCH | `useConversations.tsx:239` | `{ sender_email: string, stage_id: string \| null }` | `{ success: boolean, updated_count: number }` | Email (Bulk) |
| `/api/pipeline/email-senders/assign` | PATCH | `useConversations.tsx:114` | `{ sender_email: string, assigned_to: string \| null }` | `{ success: boolean, updated_count: number }` | Email (Bulk) |
| `/api/pipeline-stages` | GET | `usePipelineStages.tsx:10` | None | `PipelineStage[]` | Both |
| `/api/pipeline-stages` | POST | `usePipelineStages.tsx:32` | `PipelineStage` | `PipelineStage` | Both |
| `/api/pipeline-stages/{id}` | PUT | `usePipelineStages.tsx:50` | `Partial<PipelineStage>` | `PipelineStage` | Both |
| `/api/pipeline-stages/{id}` | DELETE | `usePipelineStages.tsx:74` | None | `void` | Both |

#### **3. AI Agent Endpoints**

| Endpoint | Method | Called From | Request Payload | Response Payload | Used For |
|----------|--------|-------------|-----------------|------------------|----------|
| `/api/agents/apply-manual-tags` | POST | `LeadTagSelector.tsx:33,60` | `{ conversation_id: string, tags: string[] \| null }` | Unknown (not documented) | Both (manual tagging) |

**Note**: The following Agent endpoints exist in backend but are NOT called from frontend:
- `/api/agents/generate-reply` (Agent 3)
- `/api/agents/regenerate-reply` (Agent 3)
- `/api/agents/reply-config/:workspaceId` (Agent 3)
- `/api/agents/run-lead-action` (Agent 2 trigger)
- `/api/agents/remove-tags` (Agent 2)
- `/api/agents/config/:workspaceId/:agentType` (Agent config)

#### **4. Team Member Endpoints**

| Endpoint | Method | Called From | Request Payload | Response Payload | Used For |
|----------|--------|-------------|-----------------|------------------|----------|
| `/api/team-members` | GET | `useTeamMembers.tsx:10` | None | `TeamMember[]` | Both |
| `/api/team-members/{id}` | GET | `useTeamMembers.tsx:18` | None | `TeamMember` | Both |
| `/api/team-members` | POST | `useTeamMembers.tsx:20` | `TeamMember` | `TeamMember` | Both |
| `/api/team-members/{id}` | PATCH | `useTeamMembers.tsx:53` | `Partial<TeamMember>` | `TeamMember` | Both |
| `/api/team-members/{id}/role` | PATCH | `useTeamMembers.tsx:79` | `{ role: 'admin'\|'sdr' }` | `void` | Both |
| `/api/team-members/{id}` | DELETE | `useTeamMembers.tsx:105` | None | `void` | Both |

#### **5. Messages Endpoints**

| Endpoint | Method | Called From | Request Payload | Response Payload | Used For |
|----------|--------|-------------|-----------------|------------------|----------|
| `/api/messages/conversation/{conversationId}` | GET | `useMessages.tsx:13` | None | `Message[]` | Both |
| `/api/messages` | POST | `useMessages.tsx:30` | `{ conversationId: string, content: string, userId: string }` | `Message` | Both |
| `/api/messages/{id}` | GET | `backend-api.ts:193` | None | `Message` | Both |

---

## PHASE 2 — AI AGENT ENDPOINT VERIFICATION

### **Agent 1: Intent Detection**

**Frontend Trigger**: ❌ **NONE**
- Frontend does NOT trigger intent detection directly
- Intent detection is backend-only, triggered automatically on message arrival
- Frontend only CONSUMES intent data if present in conversation object

**Data Flow**:
1. Backend: New message arrives → Agent 1 runs automatically → Creates `conversation_intents` row
2. Frontend: Calls `/api/conversations` → Receives `Conversation[]` → Checks for `intent` field
3. Frontend: If `intent` exists, displays `IntentBadge` component

**Polling/Push**: 
- ❌ No polling for intent detection
- ❌ No push notifications for intent detection
- ✅ Frontend relies on conversation list refresh to see new intents

**Async Completion**:
- Frontend does NOT wait for intent detection
- Intent detection happens in background (`setImmediate` in backend)
- Frontend may display conversation before intent is detected

### **Agent 2: Lead Tagging**

**Frontend Trigger**: ⚠️ **PARTIAL**
- ✅ Frontend CAN trigger manual tagging via `/api/agents/apply-manual-tags`
- ❌ Frontend does NOT trigger automatic Agent 2 execution
- ❌ Frontend does NOT call `/api/agents/run-lead-action` to manually trigger Agent 2

**Data Flow**:
1. Backend: Agent 1 detects intent → Agent 2 runs automatically → Updates `conversations.lead_tags`
2. Frontend: Calls `/api/conversations` → Receives `Conversation[]` → Checks for `lead_tags` field
3. Frontend: If `lead_tags` exists, displays `LeadTagPill` components

**Manual Tagging**:
- ✅ Frontend CAN manually apply tags via `LeadTagSelector` component
- ✅ Frontend sends `manually_tagged` flag implicitly (backend sets it)
- ⚠️ Frontend does NOT explicitly pass `is_manual_override` flag

**Polling/Push**:
- ❌ No polling for tag updates
- ❌ No push notifications for tag updates
- ✅ Frontend relies on conversation list refresh to see new tags

---

## PHASE 3 — DATA MODEL AUDIT (READ-ONLY)

### **Conversation Interface Fields**

#### **Fields That EXIST and ARE USED**

| Field | Origin | Consumed In | Required/Optional | Notes |
|-------|--------|-------------|-------------------|-------|
| `id` | API response | All components | Required | Primary identifier |
| `sender_name` | API response | `ConversationList.tsx`, `EmailView.tsx`, `LinkedInInbox.tsx` | Required | Display name |
| `sender_email` | API response | `ConversationList.tsx`, `EmailInbox.tsx` | Optional | Email only |
| `conversation_type` | API response | `useConversations.tsx`, filtering logic | Required | `'email' \| 'linkedin'` |
| `assigned_to` | API response | `ConversationList.tsx:335,342`, `EmailInbox.tsx:399`, `LinkedInInbox.tsx:447` | Optional | SDR assignment |
| `custom_stage_id` | API response | `ConversationList.tsx:413`, `EmailInbox.tsx:406`, `LinkedInInbox.tsx:443` | Optional | Pipeline stage |
| `lead_tags` | API response | `ConversationList.tsx:312-322` | Optional | Array of tag strings |
| `manually_tagged` | API response | `ConversationList.tsx:318` | Optional | Boolean flag |
| `intent` | API response | `ConversationList.tsx:300-309` | Optional | Object with `primary_intent`, `confidence_score`, etc. |
| `intent.primary_intent` | API response | `IntentBadge.tsx` | Optional | String |
| `intent.confidence_score` | API response | `IntentBadge.tsx:304` | Optional | Number (0-1) |
| `intent.detected_keywords` | API response | `IntentBadge.tsx:305` | Optional | String array |
| `intent.sentiment` | API response | `IntentBadge.tsx:306` | Optional | `'positive' \| 'neutral' \| 'negative' \| 'mixed'` |

#### **Fields That EXIST but Are NOT USED for AI Agents**

| Field | Origin | Used For | Notes |
|-------|--------|----------|-------|
| `status` | API response | Legacy status system | Not related to AI agents |
| `is_read` | API response | Read/unread state | Not related to AI agents |
| `is_favorite` | API response | Favorite flag | Not related to AI agents |
| `stage_assigned_at` | API response | Stage assignment timestamp | Not displayed in UI |

#### **Fields That DO NOT EXIST in Frontend Types**

| Field | Backend Has? | Frontend Has? | Notes |
|-------|--------------|---------------|-------|
| `manually_staged` | ✅ Yes (backend) | ❌ No | Backend tracks manual stage override, frontend doesn't use it |
| `ai_confidence` | ✅ Yes (in `intent.confidence_score`) | ✅ Yes | Exists as nested field |
| `channel` | ✅ Yes (as `conversation_type`) | ✅ Yes | Exists but named differently |

### **Type Definitions**

**Frontend Conversation Interface** (`ConversationList.tsx:17-63`):
```typescript
interface Conversation {
  // ... standard fields ...
  intent?: {
    primary_intent: string;
    secondary_intents?: string[];
    confidence_score: number;
    detected_keywords?: string[];
    sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed';
  };
  lead_tags?: string[];
  manually_tagged?: boolean;
}
```

**Backend Conversation Type** (`types/index.ts:13-63`):
```typescript
interface Conversation {
  // ... standard fields ...
  assigned_to?: string;
  custom_stage_id?: string;
  // Note: Backend type does NOT include intent or lead_tags fields
  // These are added by the /with-intents endpoint
}
```

**Gap Identified**: Backend type definition does not include `intent` or `lead_tags` fields, but the `/with-intents` endpoint adds them.

---

## PHASE 4 — EMAIL vs LINKEDIN FLOW TRACE

### **Email Inbox Flow**

**1. Data Fetching**:
- **Hook**: `useConversations('email', folder)` (`EmailInbox.tsx:21`)
- **API Call**: `GET /api/conversations?type=email&folder={folder}`
- **Endpoint**: `conversationsApi.list('email', folder)` (`backend-api.ts:26`)
- **Response**: `Conversation[]` (standard format, NO intent/tags unless backend adds them)

**2. Component Hierarchy**:
```
EmailInbox.tsx
  └─ ConversationList.tsx (shared component)
      └─ Renders: IntentBadge, LeadTagPill (if data exists)
```

**3. Rendering Logic**:
- **Intent Badge**: Renders if `conversation.intent` exists (`ConversationList.tsx:300`)
- **Lead Tags**: Renders if `conversation.lead_tags` exists (`ConversationList.tsx:312`)
- **Stage Display**: Shows `custom_stage_id` in dropdown menu (`ConversationList.tsx:413`)
- **SDR Assignment**: Shows `assigned_to` in dropdown menu (`ConversationList.tsx:335,342`)

**4. Manual Actions Available**:
- ✅ Assign SDR: `PATCH /api/conversations/{id}/assign` (`ConversationList.tsx:130`)
- ✅ Change Stage: `PATCH /api/conversations/{id}/stage` (`ConversationList.tsx:134`)
- ✅ Manual Tagging: `POST /api/agents/apply-manual-tags` (via `LeadTagSelector`, but NOT integrated in EmailInbox)

### **LinkedIn Inbox Flow**

**1. Data Fetching**:
- **Hook**: `useConversations('linkedin')` (`LinkedInInbox.tsx:20`)
- **API Call**: `GET /api/conversations?type=linkedin`
- **Endpoint**: `conversationsApi.list('linkedin')` (`backend-api.ts:26`)
- **Response**: `Conversation[]` (standard format, NO intent/tags unless backend adds them)

**2. Component Hierarchy**:
```
LinkedInInbox.tsx
  └─ LinkedInConversationList.tsx (different component)
      └─ Uses ConversationList.tsx internally
          └─ Renders: IntentBadge, LeadTagPill (if data exists)
```

**3. Rendering Logic**:
- **Intent Badge**: Same as Email (uses shared `ConversationList.tsx`)
- **Lead Tags**: Same as Email (uses shared `ConversationList.tsx`)
- **Stage Display**: Shows `custom_stage_id` (`LinkedInInbox.tsx:443`)
- **SDR Assignment**: Shows `assigned_to` (`LinkedInInbox.tsx:447`)

**4. Manual Actions Available**:
- ✅ Assign SDR: `PATCH /api/conversations/{id}/assign` (via shared hooks)
- ✅ Change Stage: `PATCH /api/conversations/{id}/stage` (via shared hooks)
- ✅ Manual Tagging: `POST /api/agents/apply-manual-tags` (via `LeadTagSelector`, but NOT integrated in LinkedInInbox)

### **Key Differences**

| Aspect | Email | LinkedIn |
|--------|-------|----------|
| **Folder Support** | ✅ Yes (`inbox`, `sent`, `drafts`, etc.) | ❌ No |
| **Polling** | ❌ No (manual refresh) | ✅ Yes (15s interval) |
| **Sync Endpoint** | ❌ No | ✅ Yes (`/api/conversations/{id}/sync`) |
| **Component** | `ConversationList.tsx` | `LinkedInConversationList.tsx` → `ConversationList.tsx` |
| **Intent/Tags Display** | ✅ Same | ✅ Same |

---

## PHASE 5 — MANUAL TAGGING CAPABILITY AUDIT

### **Existing Manual Actions**

#### **1. SDR Assignment**
- **Location**: 3-dot menu → "Assign to SDR" (`ConversationList.tsx:374-391`)
- **Endpoint**: `PATCH /api/conversations/{conversationId}/assign`
- **Payload**: `{ sdrId: string | null }`
- **Manual Override**: ❌ Does NOT pass `is_manual_override` flag
- **Used For**: Both Email and LinkedIn

#### **2. Stage Change**
- **Location**: 3-dot menu → "Change Stage" (`ConversationList.tsx:400-420`)
- **Endpoint**: `PATCH /api/conversations/{conversationId}/stage`
- **Payload**: `{ stageId: string | null }`
- **Manual Override**: ❌ Does NOT pass `manually_staged` flag
- **Used For**: Both Email and LinkedIn

#### **3. Lead Tagging (Component Exists, NOT Integrated)**
- **Component**: `LeadTagSelector.tsx` (exists but NOT used in inbox views)
- **Location**: ❌ NOT integrated into `ConversationList.tsx` or inbox pages
- **Endpoint**: `POST /api/agents/apply-manual-tags`
- **Payload**: `{ conversation_id: string, tags: string[] | null }`
- **Manual Override**: ✅ Backend sets `manually_tagged = true` automatically
- **Status**: Component created but NOT wired into UI

### **Missing Manual Tagging Integration**

**Gap Identified**:
- ✅ `LeadTagSelector` component exists
- ✅ `LeadTagPill` component exists
- ✅ API endpoint exists (`/api/agents/apply-manual-tags`)
- ❌ Component is NOT integrated into `ConversationList.tsx`
- ❌ No UI trigger to open tag selector
- ❌ Tags are displayed but NOT editable in inbox views

**Current Tag Display**:
- Tags are displayed as read-only pills (`ConversationList.tsx:314-320`)
- No remove button shown (component supports it but not used)
- No "+ Add Tag" button shown

---

## PHASE 6 — STATE MANAGEMENT AUDIT

### **State Management System**

**Primary System**: **React Query (TanStack Query)**

**Source of Truth**: **Server State** (via React Query cache)

**Key Hooks**:
- `useConversations()` - Fetches conversation list
- `useAssignConversation()` - Mutation for SDR assignment
- `useUpdateConversationStage()` - Mutation for stage changes
- `useToggleRead()` - Mutation for read/unread
- `useToggleFavoriteConversation()` - Mutation for favorites

### **Sync Behavior After Mutation**

**Pattern**: **Pessimistic Updates with Invalidation**

**Example Flow** (`useAssignConversation.tsx:120-122`):
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['conversations'] });
  toast.success('Conversation assigned successfully');
}
```

**Steps**:
1. Mutation executes
2. On success: Invalidate `['conversations']` query cache
3. React Query refetches data from server
4. UI updates with fresh data

**Optimistic Updates**: ✅ **YES** (only for read/unread toggle)

**Example** (`useToggleRead.tsx:175-199`):
- Updates cache immediately (optimistic)
- Reverts on error
- Invalidates on settle

### **Query Keys**

**Conversations**: `['conversations', workspaceId, type, folder, userId]`
- Cache is workspace-scoped
- Cache is type-scoped (email vs linkedin)
- Cache is folder-scoped (for email)

**Messages**: `['messages', conversationId]`
- Cache is conversation-scoped

**Pipeline Stages**: `['pipeline-stages']`
- Global cache (not workspace-scoped)

**Team Members**: `['team-members']`
- Global cache (not workspace-scoped)

### **Cache Invalidation Strategy**

**After Assignment**: Invalidates all `['conversations']` queries
**After Stage Change**: Invalidates all `['conversations']` queries
**After Tag Change**: ❌ **NOT IMPLEMENTED** (no invalidation hook exists for tag mutations)

**Gap Identified**: Tag mutations in `LeadTagSelector.tsx` do NOT invalidate React Query cache, so UI may show stale data.

---

## PHASE 7 — GAPS OR MISSING VISIBILITY

### **Factual Gaps (No Suggestions)**

#### **1. Intent Detection Visibility**
- ✅ UI components exist (`IntentBadge.tsx`)
- ✅ Display logic exists (`ConversationList.tsx:300-309`)
- ❌ Frontend does NOT call `/api/conversations/with-intents` (currently uses `/api/conversations`)
- ❌ Intent data may NOT be present in conversation objects
- ❌ No polling or push mechanism to detect new intents

#### **2. Lead Tag Visibility**
- ✅ UI components exist (`LeadTagPill.tsx`, `LeadTagSelector.tsx`)
- ✅ Display logic exists (`ConversationList.tsx:312-322`)
- ❌ Frontend does NOT call `/api/conversations/with-intents` (currently uses `/api/conversations`)
- ❌ Tag data may NOT be present in conversation objects
- ❌ No polling or push mechanism to detect new tags

#### **3. Manual Tagging Capability**
- ✅ Component exists (`LeadTagSelector.tsx`)
- ✅ API endpoint exists (`/api/agents/apply-manual-tags`)
- ❌ Component is NOT integrated into inbox views
- ❌ No UI trigger to open tag selector
- ❌ Tags displayed as read-only

#### **4. Manual Override Tracking**
- ✅ Backend tracks `manually_tagged` flag
- ✅ Backend tracks `manually_staged` flag
- ✅ Frontend receives `manually_tagged` in conversation object
- ❌ Frontend does NOT receive `manually_staged` in conversation object
- ❌ Frontend does NOT display manual override indicators for stage changes

#### **5. AI Agent Configuration**
- ✅ Backend endpoints exist (`/api/agents/config/:workspaceId/:agentType`)
- ❌ Frontend does NOT call these endpoints
- ❌ Frontend does NOT display agent enable/disable controls
- ❌ Frontend does NOT show agent status

#### **6. State Management for Tags**
- ✅ React Query used for conversations
- ❌ Tag mutations do NOT invalidate conversation cache
- ❌ Tag updates may show stale data until manual refresh

#### **7. Real-Time Updates**
- ❌ No WebSocket or SSE connection for intent/tag updates
- ❌ No polling mechanism for intent/tag changes
- ❌ Frontend relies on manual refresh or page navigation

#### **8. Error Handling**
- ✅ API errors are caught and logged (`LeadTagSelector.tsx:46,72`)
- ❌ No user-facing error messages for tag failures
- ❌ No retry mechanism for failed tag operations

---

## SUMMARY

### **What Works**
1. ✅ Conversation fetching works for both Email and LinkedIn
2. ✅ SDR assignment works (manual action)
3. ✅ Stage changes work (manual action)
4. ✅ UI components exist for intent badges and lead tags
5. ✅ Display logic exists (renders if data present)

### **What Doesn't Work**
1. ❌ Intent badges NOT visible (data not fetched)
2. ❌ Lead tags NOT visible (data not fetched)
3. ❌ Manual tagging NOT accessible (component not integrated)
4. ❌ No real-time updates for AI agent results
5. ❌ No agent configuration UI

### **What's Partially Working**
1. ⚠️ Tag API exists but component not integrated
2. ⚠️ Intent endpoint exists but not called
3. ⚠️ Manual override tracking exists but not fully utilized

---

**END OF AUDIT REPORT**

**No code changes made. No suggestions provided. Audit-only mode completed.**

