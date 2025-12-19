# Email Fix Plan - Simple & Clear

## Problem Identified

**In Supabase:** All 577 email conversations have `sender_email = satya@leadnex.co` (YOUR email)

**Why:** The sync code sets:
```typescript
sender_name: parsed.from.name,  // ← BUG: For SENT emails, this is YOU
sender_email: parsed.from.email // ← BUG: For SENT emails, this is YOU
```

**Result:** Sent emails appear as if you received them (wrong direction)

## The Fix

### Concept
- **Inbox emails:** Conversation sender = Email from (the person who sent TO you)
- **Sent emails:** Conversation sender = Email to (the person you sent TO)

### Implementation

**File:** `Converso-backend/src/services/emailSync.ts`

**Change lines 306-309 from:**
```typescript
const conversationData: any = {
  conversation_type: 'email',
  sender_name: parsed.from.name,      // ← WRONG for sent emails
  sender_email: parsed.from.email,    // ← WRONG for sent emails
```

**To:**
```typescript
// Determine who the "other person" is in this conversation
const isSentEmail = normalizedFolder === 'sent' || normalizedFolder === 'drafts';
const otherPerson = isSentEmail 
  ? parsed.to?.[0] || parsed.from  // Sent: store recipient
  : parsed.from;                    // Inbox: store sender

const conversationData: any = {
  conversation_type: 'email',
  sender_name: otherPerson.name,
  sender_email: otherPerson.email,
```

## Steps to Fix

### 1. Clean Database (Run SQL)
```sql
-- File: CLEAN_DATABASE_NOW.sql
-- Deletes backup tables and bad email data
-- LinkedIn is SAFE (not touched)
```

### 2. Fix Sync Code
- Update `emailSync.ts` with correct sender/recipient logic
- Test compilation

### 3. Reconnect Emails
- Settings → Integrations → Disconnect email accounts
- Reconnect them
- Wait for sync

### 4. Verify
- Inbox: Shows emails FROM others
- Sent: Shows emails you sent TO others
- Deleted: Shows deleted emails

## Files to Change

1. ✅ `CLEAN_DATABASE_NOW.sql` - Already created
2. ⏳ `Converso-backend/src/services/emailSync.ts` - Fix sender logic
3. ⏳ `Converso-backend/src/services/gmailIntegration.ts` - Ensure `to` field is parsed
4. ⏳ `Converso-backend/src/services/outlookIntegration.ts` - Ensure `to` field is parsed

## LinkedIn Safety ✅

All changes explicitly exclude LinkedIn:
- SQL: `WHERE provider IN ('gmail', 'outlook')`
- SQL: `WHERE conversation_type = 'email'`
- Code: Only touches Gmail/Outlook sync

**Your LinkedIn workflow is 100% safe.**

## Timeline

1. **Now:** Run `CLEAN_DATABASE_NOW.sql` in Supabase
2. **5 min:** Fix sync code
3. **2 min:** Restart backend
4. **10 min:** Reconnect emails + wait for sync
5. **Done:** Emails properly categorized in folders

Simple, clean, done.
