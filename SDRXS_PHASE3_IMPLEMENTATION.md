# SDRXS PHASE 3: SDR UI Gating + Activity Timeline

## Overview
This document describes the implementation of PHASE 3 of the SDR Experience System (SDRXS), which implements role-based UI controls and adds an Activity Timeline component for tracking conversation activities.

## Files Modified/Created

### 1. New Component: `ActivityTimeline.tsx`
**File:** `Converso-frontend/src/components/Inbox/ActivityTimeline.tsx`

**Purpose:** Displays a chronological timeline of activities for a conversation

**Features:**
- Fetches activities from `conversation_activities` table
- Real-time updates via Supabase subscriptions
- Displays activity type icons (stage changes, lead updates, notes, messages)
- Shows actor name and relative timestamps
- Handles empty states gracefully

**Activity Types Supported:**
- `stage_changed` - Pipeline stage movements
- `lead_updated` - Lead intelligence field updates
- `note_added` - Internal notes
- `email_sent` - Outbound emails
- `linkedin_sent` - Outbound LinkedIn messages
- `message_received` - Inbound messages
- `assigned` - Lead assignments

**Props:**
```typescript
interface ActivityTimelineProps {
  conversationId: string;
  className?: string;
}
```

### 2. Modified: `LeadDetailsModal.tsx`
**File:** `Converso-frontend/src/components/Pipeline/LeadDetailsModal.tsx`

**Changes:**
- Imported `ActivityTimeline` component
- Replaced custom activity log with `ActivityTimeline` component
- Simplified Activities tab to use the new component

**Before:**
```typescript
// Custom activity generation from messages and conversation data
const generateActivityLog = () => { ... }
```

**After:**
```typescript
<ActivityTimeline conversationId={conversation.id} />
```

### 3. Modified: `BulkActions.tsx`
**File:** `Converso-frontend/src/components/Inbox/BulkActions.tsx`

**Changes:**
- Added role-based gating for destructive actions
- SDRs can no longer:
  - Archive conversations
  - Delete conversations

**Code:**
```typescript
{userRole === 'admin' && (
  <>
    <DropdownMenuItem onClick={onArchive}>
      <Archive className="h-4 w-4 mr-2" />
      Archive
    </DropdownMenuItem>

    <DropdownMenuItem onClick={onDelete} className="text-destructive">
      <Trash2 className="h-4 w-4 mr-2" />
      Delete
    </DropdownMenuItem>
  </>
)}
```

### 4. Modified: `Settings.tsx`
**File:** `Converso-frontend/src/pages/Settings.tsx`

**Changes:**
- Added automatic redirect for SDRs trying to access admin-only tabs
- Admin-only tabs already hidden in UI via existing role checks

**Code:**
```typescript
// Redirect SDRs if they try to access admin-only tabs
useEffect(() => {
  if (userRole === 'sdr' && (activeTab === 'rules' || activeTab === 'pipeline' || activeTab === 'workspace')) {
    setSearchParams({ tab: 'profile' });
  }
}, [userRole, activeTab, setSearchParams]);
```

### 5. Already Implemented (No Changes Needed)

#### `AssignmentDropdown.tsx`
- Already hides for SDRs (line 18: `if (userRole === 'sdr') return null;`)

#### `LeadProfilePanel.tsx`
- Already has role-based edit permissions (line 212-213)
- SDRs can edit lead intelligence fields only if assigned to them
- SDRs cannot reassign conversations (line 299: `canEditSDR` check)

#### `Sidebar.tsx`
- Already filters navigation items by role (line 77)
- SDRs see `salesItemsSdr` (only Pipeline), admins see `salesItemsAdmin` (Pipeline + Team)

## UI Gating Summary

### ✅ SDRs CAN:
1. **View & Edit Assigned Leads:**
   - Lead profile fields (sender_name, sender_email, sender_linkedin_url, company_name, location, mobile)
   - Pipeline stage dropdown (for assigned conversations)

2. **Send/Reply:**
   - Email messages
   - LinkedIn messages

3. **Add Notes:**
   - Internal notes on assigned conversations

4. **View Activities:**
   - Activity timeline for assigned conversations

5. **Bulk Actions:**
   - Mark as read/unread
   - Change stage
   - Mark as favorite/unfavorite

6. **Settings Access:**
   - My Profile tab
   - Integrations tab (if admin allows)

### ❌ SDRs CANNOT:
1. **Assignment Controls:**
   - Assign/reassign conversations to other SDRs
   - View unassigned conversations

2. **Destructive Actions:**
   - Delete conversations
   - Delete messages
   - Archive conversations

3. **Admin Settings:**
   - Routing Rules configuration
   - Pipeline Stages configuration
   - Workspace settings

4. **Team Management:**
   - View Team page
   - Add/remove team members
   - Change user roles

5. **Bulk Actions (Restricted):**
   - Bulk assignment changes
   - Bulk delete
   - Bulk archive

## Activity Timeline Implementation

### Data Flow

```
conversation_activities table
         ↓
ActivityTimeline component
         ↓
Real-time subscription (Supabase)
         ↓
UI updates automatically
```

### Example Activity Display

```
┌─────────────────────────────────────────┐
│  🔀  Stage changed                      │
│      Moved from stage to new stage      │
│      John Doe · 2 minutes ago           │
├─────────────────────────────────────────┤
│  ✏️  Company updated                    │
│      Set to: Acme Corporation           │
│      Jane Smith · 5 minutes ago         │
├─────────────────────────────────────────┤
│  📝  Note added                         │
│      Great conversation, follow up...   │
│      John Doe · 10 minutes ago          │
└─────────────────────────────────────────┘
```

### Real-Time Updates

The `ActivityTimeline` component subscribes to Supabase real-time changes:

```typescript
const channel = supabase
  .channel(`activities:${conversationId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'conversation_activities',
    filter: `conversation_id=eq.${conversationId}`
  }, (payload) => {
    // Add new activity to timeline
  })
  .subscribe();
```

## Screens Where Activity Timeline Appears

### 1. Sales Pipeline - Lead Details Modal
**Location:** `src/components/Pipeline/LeadDetailsModal.tsx`

**Access:**
- Click on any lead card in the Pipeline view
- Opens modal with two tabs: "Activities" and "Conversation History"
- Activities tab shows the `ActivityTimeline` component

**Visibility:**
- Admins: Can view activities for all leads in workspace
- SDRs: Can view activities only for assigned leads

### 2. Future Integration Points (Not Implemented Yet)
- Email Inbox conversation view
- LinkedIn Inbox conversation view
- Lead profile sidebar

## What Was NOT Changed

### ✅ Preserved Functionality
- ✅ Email sync logic (untouched)
- ✅ LinkedIn sync logic (untouched)
- ✅ Message storage (untouched)
- ✅ Inbox queries (untouched)
- ✅ Conversation fetching logic (untouched)
- ✅ Existing inbox layout (untouched)
- ✅ Backend API endpoints (untouched)
- ✅ RLS policies (untouched - no changes to database)
- ✅ Triggers (untouched - no changes to database)

### 📊 Data Flow
- Activities are read directly from `conversation_activities` table via Supabase client
- No duplication of activity data in frontend state
- Real-time updates via Supabase subscriptions
- No custom API endpoints needed

## Testing Instructions

### Test 1: SDR Cannot See Admin Tabs
1. Log in as SDR
2. Navigate to Settings
3. **Expected:** Only see "My Profile" tab (and "Integrations" if admin allows)
4. Try to manually navigate to `/settings?tab=rules`
5. **Expected:** Automatically redirected to `/settings?tab=profile`

### Test 2: SDR Cannot Delete Conversations
1. Log in as SDR
2. Go to Email Inbox
3. Select multiple conversations
4. Click "Actions" dropdown
5. **Expected:** No "Delete" or "Archive" options visible

### Test 3: SDR Cannot Reassign Conversations
1. Log in as SDR
2. View an assigned conversation
3. Open lead profile panel
4. **Expected:** SDR dropdown is read-only (shows assigned SDR name, no dropdown)

### Test 4: Activity Timeline Shows Real-Time Updates
1. Open Lead Details Modal for a conversation
2. Go to "Activities" tab
3. In another browser/tab, update the lead's company name
4. **Expected:** New "Lead updated" activity appears in timeline automatically

### Test 5: Activity Timeline Shows Correct Icons
1. Open Lead Details Modal
2. View Activities tab
3. **Expected:**
   - Stage changes show GitBranch icon
   - Lead updates show FileEdit icon
   - Notes show StickyNote icon
   - Messages show MessageSquare icon

### Test 6: SDR Can Edit Assigned Lead Fields
1. Log in as SDR
2. Open an assigned conversation
3. Click on company name, location, mobile, or email fields
4. **Expected:** Fields become editable
5. Make changes
6. **Expected:** Changes save successfully and appear in Activity Timeline

### Test 7: SDR Cannot Edit Unassigned Lead
1. Log in as SDR
2. Try to view an unassigned conversation (via direct URL if possible)
3. **Expected:** Conversation not visible due to RLS (Phase 1)
4. If somehow accessible, fields should be read-only

## Component Hierarchy

```
LeadDetailsModal
├── Tabs
│   ├── Activities Tab
│   │   └── ActivityTimeline ← NEW COMPONENT
│   └── Conversation History Tab
│       └── Messages List
└── LeadProfilePanel
    ├── Profile Fields (role-gated editing)
    ├── Stage Dropdown (role-gated)
    ├── SDR Dropdown (admin-only)
    └── Notes Section
```

## Role-Based UI Controls Summary

| Feature | Admin | SDR (Assigned) | SDR (Unassigned) |
|---------|-------|----------------|------------------|
| View conversation | ✅ | ✅ | ❌ |
| Edit lead fields | ✅ | ✅ | ❌ |
| Change stage | ✅ | ✅ | ❌ |
| Assign/Reassign | ✅ | ❌ | ❌ |
| Delete conversation | ✅ | ❌ | ❌ |
| Archive conversation | ✅ | ❌ | ❌ |
| View activities | ✅ | ✅ | ❌ |
| Add notes | ✅ | ✅ | ❌ |
| Send/Reply | ✅ | ✅ | ❌ |
| Routing Rules | ✅ | ❌ | ❌ |
| Pipeline Config | ✅ | ❌ | ❌ |
| Team Management | ✅ | ❌ | ❌ |

## Notes

### Frontend-Only Changes
- All changes in this phase are frontend-only
- No backend API modifications
- No database schema changes
- No RLS policy changes
- No trigger modifications

### Activity Data Source
- Activities are fetched directly from `conversation_activities` table
- This table is populated by Phase 2 triggers
- Real-time updates via Supabase subscriptions
- No caching or state duplication in frontend

### Performance Considerations
- Activity timeline uses `ScrollArea` for efficient rendering
- Real-time subscriptions are scoped to specific conversation
- Subscriptions are cleaned up when component unmounts
- Activities are ordered by `created_at DESC` for chronological display

### Future Enhancements
- Add activity filtering (by type, date range, actor)
- Add activity search
- Add export activities feature
- Integrate activity timeline into inbox conversation view
- Add activity notifications/alerts

