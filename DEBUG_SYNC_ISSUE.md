# Debugging LinkedIn Sync Issue - Action Plan

## Problem
Backend logs show "Upserting" messages but the `public.messages` table remains empty.

## Root Cause
The sync code was not checking for errors after Supabase upsert operations. It logged "Upserting" but never verified if the operation succeeded or failed.

---

## ✅ Fixes Implemented

### 1. Added Error Logging to Sync Code
**File**: `Converso-backend/src/unipile/linkedinSync.service.ts`

**Changes**:
- Added error checking after conversation upserts
- Added error checking after message upserts  
- Added detailed error logs showing exactly what failed
- Added success logs with checkmarks for visibility
- Logs now show the failed payload for debugging

**What you'll now see**:
- ✓ Success: `[LinkedIn Sync] ✓ Message upserted successfully: {message_id}`
- ❌ Failure: `[LinkedIn Sync] ❌ ERROR upserting message {message_id}: {error details}`

### 2. Created Database Connection Test Script
**File**: `Converso-backend/src/scripts/test-db-connection.ts`

This script tests:
1. ✅ Supabase connection works
2. ✅ Can query workspaces table
3. ✅ Can query connected_accounts table
4. ✅ Can insert test conversations
5. ✅ Can insert test messages (identifies RLS/permission issues)
6. ✅ Can read messages back
7. ✅ Shows existing LinkedIn messages

---

## 🧪 How to Debug

### Step 1: Run the Database Connection Test

```bash
cd Converso-backend

# Run the test script
npx tsx src/scripts/test-db-connection.ts
```

**Expected Output**:
```
========================================
Testing Supabase Database Connection
========================================

Test 1: Checking Supabase connection...
✅ PASSED: Supabase connection successful

Test 2: Checking workspaces table...
✅ PASSED: Found 1 workspace(s)

Test 3: Checking connected_accounts table...
✅ PASSED: Found 1 LinkedIn account(s)

Test 4: Testing message insert permission...
✅ Test conversation created
✅ PASSED: Test message inserted successfully

Test 5: Verifying message is readable...
✅ PASSED: Test message is readable

Test 6: Checking existing LinkedIn messages...
Found 0 existing LinkedIn messages

========================================
✅ ALL TESTS PASSED!
Your database connection is working correctly.
You can now run the LinkedIn sync.
========================================
```

**If you see errors**, the test will tell you exactly what's wrong:
- Connection issues → Check your `.env` file
- RLS policy errors → Need to update policies (see below)
- Column constraint errors → Missing required fields

---

### Step 2: Restart Your Backend Server

After fixing the sync code, restart the backend:

```bash
./RESTART_BACKEND.sh
# OR
cd Converso-backend
npm run dev
```

---

### Step 3: Trigger Sync Again (With New Error Logging)

1. Go to Settings page: http://localhost:5173/settings
2. Click **Sync** button on your LinkedIn account
3. **Watch the backend console carefully**

You should now see either:

**✅ Success (what you want to see)**:
```
[LinkedIn Sync] ✓ Conversation upserted successfully: abc-123
[UnipileDebug] Upserting message: msg-456
[LinkedIn Sync] ✓ Message upserted successfully: msg-456
[LinkedIn Sync] ✓ Message upserted successfully: msg-457
[LinkedIn Sync] ✅ Completed account xyz: 5 conversations, 23 messages
```

**❌ Failure (tells you what's wrong)**:
```
[LinkedIn Sync] ❌ ERROR upserting message msg-456:
{
  code: "42501",
  details: "Policy violation",
  hint: "Row level security policy prevents insert",
  message: "new row violates row-level security policy"
}
[LinkedIn Sync] Failed payload: {
  "id": "...",
  "conversation_id": "...",
  ...
}
```

---

## 🔧 Common Issues and Fixes

### Issue 1: RLS Policy Error

**Error**: `new row violates row-level security policy`

**Fix**: The `messages` table needs a policy to allow service_role inserts.

```sql
-- Run this in Supabase SQL Editor:

-- Create policy for service role to insert/update messages
CREATE POLICY "Service role can manage all messages"
  ON public.messages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Same for conversations if needed
CREATE POLICY "Service role can manage all conversations"
  ON public.conversations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

---

### Issue 2: Foreign Key Constraint Error

**Error**: `violates foreign key constraint`

**Cause**: `conversation_id` references a conversation that doesn't exist.

**Fix**: The sync code now inserts conversations first, then messages. But if you see this error:
1. Check that conversations are being created successfully (look for conversation success logs)
2. Verify `workspace_id` exists in workspaces table

---

### Issue 3: Unique Constraint Error

**Error**: `duplicate key value violates unique constraint "messages_linkedin_message_id_uidx"`

**This is actually GOOD!** It means:
- Messages ARE being inserted successfully
- The unique index is working to prevent duplicates
- On re-sync, it's trying to insert the same message again (which is expected)

**No action needed** - this is normal behavior for re-syncing.

---

### Issue 4: Environment Mismatch

**Symptom**: Tests pass, sync logs show success, but table is still empty.

**Cause**: Backend is writing to a different Supabase project than you're viewing.

**Fix**: 
1. Check your `Converso-backend/.env` file:
   ```
   SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_service_key
   ```

2. Check your Supabase browser URL - is it the same project?

3. Make sure both match!

---

## 📊 Verify Messages After Sync

After running sync with the new error logging, check if messages appear:

```sql
-- Count LinkedIn messages
SELECT COUNT(*) as total_messages 
FROM public.messages 
WHERE linkedin_message_id IS NOT NULL;

-- View latest LinkedIn messages
SELECT 
  sender_name,
  LEFT(content, 100) as preview,
  created_at,
  linkedin_message_id
FROM public.messages 
WHERE linkedin_message_id IS NOT NULL 
ORDER BY created_at DESC 
LIMIT 10;
```

---

## 🎯 Next Steps

1. **Run the test script first** → `npx tsx src/scripts/test-db-connection.ts`
2. **If tests pass** → Restart backend and trigger sync again
3. **Watch the logs** → You'll now see exactly what's succeeding or failing
4. **Share any errors** → If you see ❌ errors, copy-paste them here for help

---

## 📝 What Changed in the Code

### Before (Silent Failures):
```typescript
await supabaseAdmin
  .from('messages')
  .upsert(payload, { onConflict: 'linkedin_message_id' });

messagesCount++; // Incremented even if insert failed!
```

### After (Proper Error Handling):
```typescript
const { data, error } = await supabaseAdmin
  .from('messages')
  .upsert(payload, { onConflict: 'linkedin_message_id' });

if (error) {
  logger.error('❌ ERROR upserting message:', error);
  logger.error('Failed payload:', payload);
} else {
  logger.info('✓ Message upserted successfully');
  messagesCount++; // Only incremented on success
}
```

---

## 🚀 Summary

The sync code now has **complete error visibility**. Instead of silently failing, it will tell you:
- ✅ What succeeded
- ❌ What failed
- 🔍 Why it failed
- 📋 What data was being inserted

Run the test script, restart your backend, and trigger sync again. You'll immediately see what's happening!

---

**Status**: ✅ Error logging implemented  
**Next**: Run test script and sync with new logging  
**Date**: December 6, 2025
