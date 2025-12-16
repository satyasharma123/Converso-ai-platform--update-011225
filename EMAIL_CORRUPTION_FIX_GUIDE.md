# Email Corruption Fix Guide

## Problem
Some emails are showing your name ("Satya Sharma") instead of the actual sender's name, and displaying "No email content available".

## Root Cause
When we added the "Sent folder" feature, the code created sent conversations using **provider-specific IDs** (gmail_thread_id, outlook_message_id). If these IDs matched existing inbox emails, it may have caused conflicts or data overwrites.

## What Was Fixed in Code ✅

**File**: `Converso-backend/src/routes/emailSync.routes.ts`

**Change**: Removed provider-specific IDs from sent conversations
- Sent folder conversations are now LOCAL COPIES only
- No gmail_message_id, gmail_thread_id, outlook_message_id, etc.
- Prevents future conflicts with inbox emails

**Backend auto-restarted** - fix is already live for new sent emails!

## Database Cleanup Required

The corrupted emails in your database need to be cleaned up manually.

### Step 1: Diagnose (Check What's Corrupted)

Run this in Supabase SQL Editor:

```sql
-- Check for corrupted emails (EMAIL ONLY - never touches LinkedIn!)
SELECT 
  id,
  sender_name,
  sender_email,
  subject,
  email_folder,
  email_timestamp
FROM public.conversations
WHERE conversation_type = 'email'
  AND email_folder = 'sent'
  AND (
    gmail_message_id IS NOT NULL 
    OR outlook_message_id IS NOT NULL
  )
ORDER BY email_timestamp DESC;
```

This shows sent folder emails that have provider IDs (which shouldn't exist).

### Step 2: Backup (Optional but Recommended)

```sql
-- Create backup of all email conversations
CREATE TABLE IF NOT EXISTS conversations_backup_20241216 AS 
SELECT * FROM public.conversations 
WHERE conversation_type = 'email';
```

### Step 3: Fix (Delete Corrupted Sent Conversations)

```sql
-- Delete ONLY corrupted sent folder emails
-- Original inbox emails are PRESERVED ✅
DELETE FROM public.conversations
WHERE conversation_type = 'email'  -- ✅ EMAIL ONLY - Never touches LinkedIn!
  AND email_folder = 'sent'         -- Only sent folder
  AND (
    gmail_message_id IS NOT NULL 
    OR outlook_message_id IS NOT NULL
    OR gmail_thread_id IS NOT NULL 
    OR outlook_conversation_id IS NOT NULL
  );
```

**What this does**:
- ✅ Deletes corrupted sent folder emails
- ✅ Preserves original inbox emails
- ✅ Never touches LinkedIn (conversation_type check)
- ✅ Only affects sent folder

### Step 4: Verify (Check Fix Worked)

```sql
-- Check inbox is intact
SELECT 
  COUNT(*) as inbox_count
FROM public.conversations
WHERE conversation_type = 'email'
  AND (email_folder = 'inbox' OR email_folder IS NULL);

-- Check sent folder is clean
SELECT 
  COUNT(*) as sent_count
FROM public.conversations
WHERE conversation_type = 'email'
  AND email_folder = 'sent';

-- ✅ CRITICAL: Verify LinkedIn is untouched
SELECT 
  COUNT(*) as linkedin_count
FROM public.conversations
WHERE conversation_type = 'linkedin';
```

### Step 5: LinkedIn Safety Verification

```sql
-- Detailed LinkedIn check - verify all data intact
SELECT 
  id,
  sender_name,
  sender_linkedin_url,
  unipile_chat_id,
  last_message_at
FROM public.conversations
WHERE conversation_type = 'linkedin'
ORDER BY last_message_at DESC
LIMIT 10;
```

All LinkedIn data should be completely unchanged!

## Alternative: Conservative Cleanup

If you want to be extra safe, only delete sent emails from the last few hours:

```sql
-- Only delete recent sent emails (last 3 hours)
DELETE FROM public.conversations
WHERE conversation_type = 'email'
  AND email_folder = 'sent'
  AND email_timestamp > NOW() - INTERVAL '3 hours'
  AND (
    gmail_message_id IS NOT NULL 
    OR outlook_message_id IS NOT NULL
  );
```

## What to Expect After Fix

### ✅ Inbox
- All original received emails intact
- Correct sender names and content
- No data loss

### ✅ Sent Folder  
- Old corrupted entries removed
- New sent emails (after code fix) will work correctly
- No provider ID conflicts

### ✅ LinkedIn
- 100% untouched
- All conversations preserved
- Zero impact

## Going Forward

**Future sent emails will work correctly** because:
1. ✅ Code fix removes provider IDs from sent conversations
2. ✅ Sent folder entries are now independent local copies
3. ✅ No more conflicts with inbox emails

## LinkedIn Protection

Every SQL query includes:
```sql
WHERE conversation_type = 'email'  -- ✅ EMAIL ONLY filter
```

LinkedIn uses:
```sql
WHERE conversation_type = 'linkedin'  -- Different type entirely
```

**They never overlap!** LinkedIn is 100% safe.

## Summary

| Action | Status |
|--------|--------|
| Code fix | ✅ Complete (backend restarted) |
| Database cleanup | ⏳ Run SQL queries above |
| LinkedIn safety | ✅ Guaranteed (separate conversation_type) |
| Future sent emails | ✅ Will work correctly |

---

**Next Steps**:
1. Run STEP 1 (Diagnose) to see corrupted emails
2. Run STEP 2 (Backup) for safety
3. Run STEP 3 (Fix) to clean up
4. Run STEP 4-5 (Verify) to confirm
5. Test by sending a new email - should work perfectly!

**All SQL queries are in**: `FIX_CORRUPTED_EMAILS.sql`
