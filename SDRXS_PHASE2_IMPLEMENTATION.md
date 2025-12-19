# SDRXS PHASE 2: SDR Write Permissions + Stage Movement

## Overview
This document describes the implementation of PHASE 2 of the SDR Experience System (SDRXS), which enables SDRs to safely update limited fields on their assigned conversations with automatic activity logging.

## Migration File
**File:** `Converso-frontend/supabase/migrations/20251219000002_sdrxs_phase2_sdr_write_permissions.sql`

## Changes Made

### 1. New Table: `conversation_activities`

**Purpose:** Audit log for tracking all conversation changes

**Schema:**
```sql
CREATE TABLE public.conversation_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  actor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

**Indexes:**
- `idx_conversation_activities_conversation_id` - Fast lookup by conversation
- `idx_conversation_activities_workspace_id` - Fast lookup by workspace
- `idx_conversation_activities_created_at` - Fast chronological queries

**RLS Policies:**
1. **"Admins can view workspace activities"** - Admins see all activities in their workspace
2. **"SDRs can view activities for assigned conversations"** - SDRs see activities only for their assigned conversations
3. **"SDRs can insert activities for assigned conversations"** - SDRs can log activities for their conversations
4. **"Admins can manage workspace activities"** - Admins have full control

### 2. Trigger Function: `enforce_sdr_update_restrictions()`

**Purpose:** Enforces field-level restrictions on SDR updates and logs all changes

**Behavior:**

#### For Non-SDR Users (Admins, Service Role):
- ✅ All updates allowed (no restrictions)
- ✅ No activity logging triggered

#### For SDR Users:

**Security Checks:**
1. ✅ Verify `conversations.assigned_to = auth.uid()`
2. ✅ Verify `conversations.workspace_id` matches user's workspace
3. ❌ Raise exception if either check fails

**Allowed Fields:**

**Lead Intelligence Fields:**
- `sender_name` - Lead's full name
- `sender_email` - Lead's email address
- `sender_linkedin_url` - Lead's LinkedIn profile URL
- `company_name` - Lead's company name
- `location` - Lead's location
- `mobile` - Lead's mobile number

**Pipeline Fields:**
- `custom_stage_id` - Pipeline stage assignment
- `stage_assigned_at` - Timestamp of stage assignment

**Blocked Fields (will raise exception if modified):**
- `id` - Primary key
- `conversation_type` - Email/LinkedIn type
- `subject` - Email subject
- `preview` - Message preview
- `assigned_to` - Assignment (SDRs cannot reassign)
- `status` - Lead status
- `is_read` - Read status
- `last_message_at` - Last message timestamp
- `workspace_id` - Workspace assignment
- `gmail_message_id` - Gmail integration ID
- `gmail_thread_id` - Gmail thread ID
- `email_timestamp` - Email timestamp
- `has_full_body` - Email body fetch status
- `is_favorite` - Favorite flag
- `unread_count` - Unread message count
- `last_message_from_lead` - Last lead message flag
- `created_at` - Creation timestamp

**Activity Logging:**

1. **Lead Intelligence Updates:**
   - Activity Type: `lead_updated`
   - Meta Format: `{ field_name: { old: value, new: value } }`
   - Triggered when any lead intelligence field changes

2. **Stage Changes:**
   - Activity Type: `stage_changed`
   - Meta Format: `{ from_stage: uuid, to_stage: uuid }`
   - Triggered when `custom_stage_id` changes

### 3. Trigger: `enforce_sdr_updates`

**Type:** BEFORE UPDATE trigger on `conversations` table
**Executes:** For each row
**Function:** `enforce_sdr_update_restrictions()`

## Example Activity Records

### Example 1: Stage Change

**Scenario:** SDR moves conversation from "New Lead" to "Contacted"

**SQL:**
```sql
UPDATE conversations
SET custom_stage_id = 'contacted-stage-uuid'
WHERE id = 'conversation-123';
```

**Activity Record Created:**
```json
{
  "id": "activity-uuid-1",
  "workspace_id": "workspace-123",
  "conversation_id": "conversation-123",
  "actor_user_id": "sdr-456",
  "activity_type": "stage_changed",
  "meta": {
    "from_stage": "new-lead-stage-uuid",
    "to_stage": "contacted-stage-uuid"
  },
  "created_at": "2025-12-19T10:30:00Z"
}
```

### Example 2: Lead Intelligence Update (Single Field)

**Scenario:** SDR updates lead's company name

**SQL:**
```sql
UPDATE conversations
SET company_name = 'Acme Corporation'
WHERE id = 'conversation-123';
```

**Activity Record Created:**
```json
{
  "id": "activity-uuid-2",
  "workspace_id": "workspace-123",
  "conversation_id": "conversation-123",
  "actor_user_id": "sdr-456",
  "activity_type": "lead_updated",
  "meta": {
    "company_name": {
      "old": null,
      "new": "Acme Corporation"
    }
  },
  "created_at": "2025-12-19T10:35:00Z"
}
```

### Example 3: Lead Intelligence Update (Multiple Fields)

**Scenario:** SDR enriches lead profile with multiple fields

**SQL:**
```sql
UPDATE conversations
SET 
  company_name = 'Acme Corporation',
  location = 'San Francisco, CA',
  mobile = '+1-555-0123'
WHERE id = 'conversation-123';
```

**Activity Record Created:**
```json
{
  "id": "activity-uuid-3",
  "workspace_id": "workspace-123",
  "conversation_id": "conversation-123",
  "actor_user_id": "sdr-456",
  "activity_type": "lead_updated",
  "meta": {
    "company_name": {
      "old": null,
      "new": "Acme Corporation"
    },
    "location": {
      "old": null,
      "new": "San Francisco, CA"
    },
    "mobile": {
      "old": null,
      "new": "+1-555-0123"
    }
  },
  "created_at": "2025-12-19T10:40:00Z"
}
```

### Example 4: Combined Stage + Lead Update

**Scenario:** SDR moves stage AND updates lead info in one query

**SQL:**
```sql
UPDATE conversations
SET 
  custom_stage_id = 'qualified-stage-uuid',
  company_name = 'Acme Corporation',
  mobile = '+1-555-0123'
WHERE id = 'conversation-123';
```

**Activity Records Created (2 records):**

**Record 1 - Lead Update:**
```json
{
  "id": "activity-uuid-4a",
  "workspace_id": "workspace-123",
  "conversation_id": "conversation-123",
  "actor_user_id": "sdr-456",
  "activity_type": "lead_updated",
  "meta": {
    "company_name": {
      "old": null,
      "new": "Acme Corporation"
    },
    "mobile": {
      "old": null,
      "new": "+1-555-0123"
    }
  },
  "created_at": "2025-12-19T10:45:00Z"
}
```

**Record 2 - Stage Change:**
```json
{
  "id": "activity-uuid-4b",
  "workspace_id": "workspace-123",
  "conversation_id": "conversation-123",
  "actor_user_id": "sdr-456",
  "activity_type": "stage_changed",
  "meta": {
    "from_stage": "contacted-stage-uuid",
    "to_stage": "qualified-stage-uuid"
  },
  "created_at": "2025-12-19T10:45:00Z"
}
```

## Security Examples

### Example 5: SDR Attempts Unauthorized Field Update (BLOCKED)

**Scenario:** SDR tries to change `assigned_to` field

**SQL:**
```sql
UPDATE conversations
SET assigned_to = 'other-sdr-uuid'
WHERE id = 'conversation-123';
```

**Result:**
```
ERROR: SDR is not allowed to modify field: assigned_to
SQLSTATE: P0001
```

**Activity Record:** ❌ None created (update blocked)

### Example 6: SDR Attempts to Update Unassigned Conversation (BLOCKED)

**Scenario:** SDR tries to update conversation not assigned to them

**SQL:**
```sql
-- Conversation is assigned to sdr-789, but current user is sdr-456
UPDATE conversations
SET company_name = 'Test Corp'
WHERE id = 'conversation-999';
```

**Result:**
```
ERROR: SDR can only update conversations assigned to them
SQLSTATE: P0001
```

**Activity Record:** ❌ None created (update blocked)

### Example 7: Admin Updates Any Field (ALLOWED)

**Scenario:** Admin updates any field including restricted ones

**SQL:**
```sql
-- Admin can update ANY field
UPDATE conversations
SET 
  assigned_to = 'new-sdr-uuid',
  status = 'qualified',
  is_read = true
WHERE id = 'conversation-123';
```

**Result:** ✅ Update succeeds

**Activity Record:** ❌ None created (admins don't trigger activity logging)

## Allowed vs Blocked Fields Summary

### ✅ ALLOWED for SDRs

| Field | Description | Category |
|-------|-------------|----------|
| `sender_name` | Lead's full name | Lead Intelligence |
| `sender_email` | Lead's email | Lead Intelligence |
| `sender_linkedin_url` | LinkedIn profile | Lead Intelligence |
| `company_name` | Company name | Lead Intelligence |
| `location` | Location | Lead Intelligence |
| `mobile` | Mobile number | Lead Intelligence |
| `custom_stage_id` | Pipeline stage | Pipeline |
| `stage_assigned_at` | Stage timestamp | Pipeline |

### ❌ BLOCKED for SDRs

| Field | Reason |
|-------|--------|
| `id` | System field |
| `conversation_type` | System field |
| `subject` | Sync-managed |
| `preview` | Sync-managed |
| `assigned_to` | Admin-only |
| `status` | Admin-only |
| `is_read` | System-managed |
| `last_message_at` | Sync-managed |
| `workspace_id` | System field |
| `gmail_message_id` | Sync-managed |
| `gmail_thread_id` | Sync-managed |
| `email_timestamp` | Sync-managed |
| `has_full_body` | Sync-managed |
| `is_favorite` | Future feature |
| `unread_count` | System-managed |
| `last_message_from_lead` | Sync-managed |
| `created_at` | System field |

## What Was NOT Changed

### ✅ Preserved Functionality
- ✅ Message sync logic (untouched)
- ✅ Inbox queries (untouched)
- ✅ LinkedIn sync (untouched)
- ✅ Email sync (untouched)
- ✅ Admin full access (preserved)
- ✅ Service role full access (preserved)
- ✅ Phase 1 SELECT policies (unchanged)

## Testing Instructions

### Test 1: SDR Updates Allowed Field
```sql
-- As SDR with assigned conversation
UPDATE conversations
SET company_name = 'Test Company'
WHERE id = 'my-assigned-conversation';

-- Expected: ✅ Success
-- Check activity log:
SELECT * FROM conversation_activities 
WHERE conversation_id = 'my-assigned-conversation'
ORDER BY created_at DESC LIMIT 1;
-- Expected: 1 record with activity_type = 'lead_updated'
```

### Test 2: SDR Attempts Blocked Field
```sql
-- As SDR
UPDATE conversations
SET is_read = true
WHERE id = 'my-assigned-conversation';

-- Expected: ❌ ERROR: SDR is not allowed to modify field: is_read
```

### Test 3: SDR Updates Stage
```sql
-- As SDR
UPDATE conversations
SET custom_stage_id = 'new-stage-uuid'
WHERE id = 'my-assigned-conversation';

-- Expected: ✅ Success
-- Check activity log:
SELECT * FROM conversation_activities 
WHERE conversation_id = 'my-assigned-conversation'
  AND activity_type = 'stage_changed'
ORDER BY created_at DESC LIMIT 1;
-- Expected: 1 record with from_stage and to_stage in meta
```

### Test 4: SDR Updates Unassigned Conversation
```sql
-- As SDR, conversation assigned to someone else
UPDATE conversations
SET company_name = 'Test'
WHERE assigned_to != auth.uid();

-- Expected: ❌ ERROR: SDR can only update conversations assigned to them
```

### Test 5: Admin Updates Any Field
```sql
-- As Admin
UPDATE conversations
SET 
  assigned_to = 'sdr-uuid',
  status = 'qualified',
  is_read = true
WHERE id = 'any-conversation';

-- Expected: ✅ Success (no restrictions for admins)
```

## Rollback Instructions

```sql
-- Drop trigger
DROP TRIGGER IF EXISTS enforce_sdr_updates ON public.conversations;

-- Drop trigger function
DROP FUNCTION IF EXISTS public.enforce_sdr_update_restrictions();

-- Drop activity table (WARNING: loses all activity history)
DROP TABLE IF EXISTS public.conversation_activities CASCADE;
```

## Next Steps

### Future Phases:
- **Phase 3:** Admin assignment controls and bulk operations
- **Phase 4:** Advanced activity filtering and reporting
- **Phase 5:** Real-time activity notifications

## Notes
- Activity logging is automatic and cannot be bypassed by SDRs
- All activity records are immutable (SDRs cannot UPDATE or DELETE)
- Admins can view full activity history for audit purposes
- The trigger uses `SECURITY DEFINER` to ensure consistent permission checks
- Field comparison uses `IS DISTINCT FROM` to handle NULL values correctly
