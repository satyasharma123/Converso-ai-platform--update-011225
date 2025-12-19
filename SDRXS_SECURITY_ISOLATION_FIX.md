# SDRXS Security & Isolation Fix - Implementation Guide

## Overview
This document tracks the comprehensive security and isolation fixes for the SDRXS system to ensure proper SDR experience and data isolation.

## Current Status

### ✅ COMPLETED

#### STEP 1: Fix Conversation Visibility (Backend) ✅
**File:** `Converso-backend/src/api/conversations.ts`

**Changes Made:**
- Fixed `getConversations()` function (line 120-122)
- Fixed `getEmailConversationsByFolder()` function (line 171-173)
- SDRs now ONLY see conversations where `assigned_to = userId`
- Removed incorrect logic that allowed `assigned_to IS NULL` for SDRs

**Code:**
```typescript
// IMPORTANT:
// supabaseAdmin bypasses RLS.
// SDR filtering here MUST exactly match RLS:
// SDRs can ONLY see conversations where assigned_to = userId
if (userRole === 'sdr') {
  query = query.eq('assigned_to', userId);
}
```

#### STEP 2: Remove "Assign to SDR" for SDR Users (UI) ✅
**Files Already Gated:**
- `AssignmentDropdown.tsx` - Returns `null` for SDR role (line 18-20)
- `BulkActions.tsx` - Hides "Assign to SDR" submenu for SDR role (line 71-94)
- `LeadProfilePanel.tsx` - SDR dropdown read-only for SDRs (line 299)

**Status:** Already implemented in Phase 3

---

### 🚧 IN PROGRESS / PENDING

#### STEP 3: Fix Favorite & Unread State (User-Specific) 🚧
**Problem:** Favorites and unread are stored on conversation table, not per-user

**Current Schema:**
```sql
conversations table:
  - is_favorite (boolean) -- ❌ GLOBAL, not user-specific
  - is_read (boolean) -- ❌ GLOBAL, not user-specific
```

**Required Solution:**
Create `conversation_user_state` table:
```sql
CREATE TABLE conversation_user_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  is_favorite BOOLEAN DEFAULT false,
  is_read BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);
```

**Impact:**
- Admin marking favorite doesn't affect SDR
- SDR marking unread doesn't affect Admin
- Each user has independent conversation state

**Files to Modify:**
1. Create migration: `20251219000003_create_conversation_user_state.sql`
2. Update backend API: `Converso-backend/src/api/conversations.ts`
   - `toggleConversationReadStatus()`
   - `toggleFavoriteConversation()`
   - `getConversations()` - JOIN with user_state
3. Update frontend hooks: `Converso-frontend/src/hooks/useConversations.tsx`
4. Update inbox pages: `EmailInbox.tsx`, `LinkedInInbox.tsx`

---

#### STEP 4: Fix Mailbox Counts (Assignment-Aware) 🚧
**Problem:** Mailbox folder counts are global, not assignment-aware

**Current Behavior:**
- SDR sees same counts as Admin (Inbox: 50, Sent: 20, Trash: 5)
- Counts don't reflect assignment

**Required Behavior:**
- Admin: Counts all workspace conversations
- SDR: Counts ONLY `assigned_to = userId` conversations

**Files to Modify:**
1. Backend: `Converso-backend/src/api/conversations.ts`
   - Add `getMailboxCounts(userId, userRole)` function
2. Frontend: Create hook `useMailboxCounts.tsx`
3. Update: `EmailInbox.tsx` - Use assignment-aware counts

**Example Implementation:**
```typescript
export async function getMailboxCounts(
  userId: string,
  userRole: 'admin' | 'sdr' | null
): Promise<{ inbox: number; sent: number; trash: number }> {
  const workspaceId = await getUserWorkspaceId(userId);
  
  let baseQuery = supabaseAdmin
    .from('conversations')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_type', 'email');
  
  if (workspaceId) {
    baseQuery = baseQuery.or(`workspace_id.eq.${workspaceId},workspace_id.is.null`);
  }
  
  if (userRole === 'sdr') {
    baseQuery = baseQuery.eq('assigned_to', userId);
  }
  
  // Get counts for each folder...
}
```

---

#### STEP 5: Fix "Connect Email" State for SDR 🚧
**Problem:** SDR sees "Connect Email" even though workspace has email connected

**Current Logic:**
```typescript
// WRONG: Checks if email account exists
if (!emailAccounts.length) {
  return <EmptyState message="Connect Email" />;
}
```

**Required Logic:**
```typescript
// CORRECT: For SDR, check if assigned conversations exist
if (userRole === 'sdr' && conversations.length === 0) {
  return <EmptyState message="No assigned conversations" />;
}

// For Admin, check email account
if (userRole === 'admin' && !emailAccounts.length) {
  return <EmptyState message="Connect Email" />;
}
```

**Files to Modify:**
1. `Converso-frontend/src/pages/EmailInbox.tsx`
   - Update empty state logic (around line 700)
2. `Converso-frontend/src/components/Inbox/ConversationList.tsx`
   - Update empty state rendering

---

#### STEP 6: Ensure Email + LinkedIn Behavior Match 🚧
**Status:** Already consistent after Step 1 fix

**Verification Needed:**
- Both use `getConversations()` with same filtering
- Both respect `assigned_to = userId` for SDRs
- Both use same empty state logic

**Files to Verify:**
1. `Converso-backend/src/api/conversations.ts` - ✅ Same function for both
2. `EmailInbox.tsx` vs `LinkedInInbox.tsx` - Check consistency
3. `ConversationList.tsx` vs `LinkedInConversationList.tsx` - Check consistency

---

#### STEP 7: Final Validation Checklist 🚧

**Test Scenarios:**

1. **SDR with Zero Assignments:**
   - [ ] Email Inbox shows "No assigned conversations"
   - [ ] LinkedIn Inbox shows "No assigned conversations"
   - [ ] Inbox count = 0
   - [ ] Sent count = 0
   - [ ] Trash count = 0
   - [ ] Favorites tab empty
   - [ ] Unread tab empty

2. **SDR with 2 Assignments:**
   - [ ] Email Inbox shows exactly 2 conversations
   - [ ] LinkedIn Inbox shows exactly 2 conversations (if assigned)
   - [ ] Counts reflect only assigned conversations
   - [ ] Can mark favorite (doesn't affect Admin)
   - [ ] Can mark unread (doesn't affect Admin)

3. **Admin User:**
   - [ ] Sees all workspace conversations
   - [ ] Sees correct total counts
   - [ ] Can assign/reassign conversations
   - [ ] Favorites independent from SDR
   - [ ] Unread state independent from SDR

4. **UI Controls:**
   - [ ] SDR never sees "Assign to SDR" dropdown
   - [ ] SDR never sees "Assign to SDR" in bulk actions
   - [ ] SDR never sees "Assign to SDR" in kebab menu
   - [ ] Admin sees all assignment controls

5. **Data Isolation:**
   - [ ] Admin favorites don't appear for SDR
   - [ ] SDR favorites don't appear for Admin
   - [ ] Admin unread doesn't affect SDR
   - [ ] SDR unread doesn't affect Admin

---

## Implementation Priority

### High Priority (Blocking SDR Experience)
1. ✅ **Step 1:** Conversation visibility (DONE)
2. ✅ **Step 2:** Remove assignment UI for SDRs (DONE)
3. 🚧 **Step 3:** User-specific favorite/unread state (CRITICAL)
4. 🚧 **Step 5:** Fix "Connect Email" empty state (HIGH)

### Medium Priority (UX Improvements)
5. 🚧 **Step 4:** Assignment-aware mailbox counts
6. ✅ **Step 6:** Email/LinkedIn consistency (DONE via Step 1)

### Final Step
7. 🚧 **Step 7:** Comprehensive validation

---

## Database Changes Required

### New Table: conversation_user_state
```sql
CREATE TABLE IF NOT EXISTS public.conversation_user_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  is_read BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

CREATE INDEX idx_conversation_user_state_conversation ON public.conversation_user_state(conversation_id);
CREATE INDEX idx_conversation_user_state_user ON public.conversation_user_state(user_id);
CREATE INDEX idx_conversation_user_state_unread ON public.conversation_user_state(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_conversation_user_state_favorite ON public.conversation_user_state(user_id, is_favorite) WHERE is_favorite = true;

-- Enable RLS
ALTER TABLE public.conversation_user_state ENABLE ROW LEVEL SECURITY;

-- Users can only see/modify their own state
CREATE POLICY "Users can manage own conversation state"
  ON public.conversation_user_state
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

### Migration Strategy
1. Create new table
2. Migrate existing `is_favorite` and `is_read` from conversations table
3. Update backend to use new table
4. Update frontend to use new table
5. (Optional) Remove old columns from conversations table after verification

---

## Testing Commands

```bash
# Restart backend
cd Converso-backend && npm run dev

# Restart frontend
cd Converso-frontend && npm run dev

# Test as SDR
# 1. Login as SDR user
# 2. Check inbox counts
# 3. Verify no unassigned conversations visible
# 4. Test favorite/unread independence

# Test as Admin
# 1. Login as Admin user
# 2. Verify all conversations visible
# 3. Test assignment controls
# 4. Verify favorite/unread independence
```

---

## Notes

- **DO NOT** delete users during testing
- **DO NOT** rely only on UI hiding for security
- **DO NOT** allow service_role queries without strict role filtering
- **DO NOT** share conversation state across users
- All security must be enforced at database/backend level
- UI hiding is UX only, not security

---

## Next Steps

1. Create migration for `conversation_user_state` table
2. Update backend API to use new table
3. Update frontend hooks and components
4. Test thoroughly with both Admin and SDR users
5. Run final validation checklist
