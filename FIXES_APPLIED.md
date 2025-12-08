# Fixes Applied - December 8, 2025

## 🐛 Issues Fixed

### Issue 1: NULL sender_name constraint violation
**Error:** `null value in column "sender_name" of relation "conversations" violates not-null constraint`

**Root Cause:** Action 1 was creating conversation records without setting `sender_name`, which has a NOT NULL constraint in the database.

**Fix:** Action 1 now sets `sender_name = 'LinkedIn Contact'` as a default value. Action 2 will then update it with the real name from the attendee API.

### Issue 2: Upsert conflict resolution
**Error:** `there is no unique or exclusion constraint matching the ON CONFLICT specification`

**Root Cause:** Code was using `onConflict: 'chat_id'` but should use `onConflict: 'id'` (primary key).

**Fix:** Changed all conversation upserts to use `onConflict: 'id'` since we generate deterministic UUIDs.

---

## ✨ New Features Added

### Feature 1: Date Range Filtering (Last 30 Days Default)

**What Changed:**
- By default, sync now fetches only last **30 days** of chats
- Reduces initial sync time and API calls
- Prevents overwhelming the system with old chats

**API Parameter:**
```typescript
syncLinkedInChatsForAccount(accountId, unipileAccountId, {
  days: 30,      // Number of days to sync (default 30)
  fullSync: false // Set true to sync ALL chats
})
```

### Feature 2: Full Sync On-Demand

**What Changed:**
- Added `fullSync` option to sync ALL chats (ignoring date filter)
- Use for initial account setup or historical data sync

---

## 🔌 Updated API Endpoints

### POST /api/linkedin/sync/full

**Before:**
```json
{
  "connectedAccountId": "uuid"
}
```

**Now:**
```json
{
  "connectedAccountId": "uuid",
  "days": 30,          // Optional: Number of days (default 30)
  "fullSync": false    // Optional: true to sync ALL chats
}
```

**Examples:**

```bash
# Sync last 30 days (default)
curl -X POST "http://localhost:3001/api/linkedin/sync/full" \
  -H "Content-Type: application/json" \
  -d '{"connectedAccountId":"YOUR_UUID"}'

# Sync last 7 days only
curl -X POST "http://localhost:3001/api/linkedin/sync/full" \
  -H "Content-Type: application/json" \
  -d '{"connectedAccountId":"YOUR_UUID", "days": 7}'

# Sync ALL chats (full historical sync)
curl -X POST "http://localhost:3001/api/linkedin/sync/full" \
  -H "Content-Type: application/json" \
  -d '{"connectedAccountId":"YOUR_UUID", "fullSync": true}'
```

### POST /api/linkedin/sync/action1

Same parameters as above - supports `days` and `fullSync` options.

---

## 🚀 What To Do Now

### Step 1: Restart Backend (10 seconds)

Stop your current backend (Ctrl+C) and restart:

```bash
cd Converso-backend
npm run dev
```

### Step 2: Run Sync (30 seconds)

**Option A: Last 30 Days (Default - Recommended)**
```bash
curl -X POST "http://localhost:3001/api/linkedin/accounts/c3b04bb3-eb4a-4b9b-adbb-751dc2aab1b6/initial-sync" \
  -H "Content-Type: application/json"
```

**Option B: Full Sync (All Chats)**
```bash
curl -X POST "http://localhost:3001/api/linkedin/sync/full" \
  -H "Content-Type: application/json" \
  -d '{"connectedAccountId":"c3b04bb3-eb4a-4b9b-adbb-751dc2aab1b6", "fullSync": true}'
```

**Option C: Last 7 Days Only**
```bash
curl -X POST "http://localhost:3001/api/linkedin/sync/full" \
  -H "Content-Type: application/json" \
  -d '{"connectedAccountId":"c3b04bb3-eb4a-4b9b-adbb-751dc2aab1b6", "days": 7}'
```

### Step 3: Watch the Logs! 🎉

You should now see:

```
[Action 1] Starting chat download (last 30 days)
[Action 1] Filtering chats from 2025-11-08T...
[Action 1] Found X chats for account
[Action 1] Successfully synced X chats
[Action 2] Starting sender enrichment...
[Action 2] Successfully enriched X conversations
[Action 3] Starting profile picture enrichment...
[Action 3] Successfully enriched X conversation pictures
[Action 4] Starting messages sync...
[Action 4] Successfully synced Y messages across X conversations
```

---

## ✅ Expected Results

### For Last 30 Days Sync:
- **Faster sync** - Only recent chats
- **Lower API usage** - Fewer API calls
- **Quick start** - See results in 1-2 minutes

### For Full Sync (All Chats):
- **Complete history** - All your LinkedIn DMs
- **Longer sync** - May take 5-10 minutes
- **Higher API usage** - More API calls (rate limited)

---

## 📊 Verify Success

### Check Conversations

```sql
-- Should show your LinkedIn chats
SELECT 
  COUNT(*) as total_chats,
  sender_name,
  chat_id,
  last_message_at
FROM conversations 
WHERE conversation_type = 'linkedin'
ORDER BY last_message_at DESC
LIMIT 10;
```

### Critical Check: No Null Sender Names

```sql
-- MUST return 0!
SELECT COUNT(*) 
FROM messages 
WHERE message_type = 'linkedin' 
  AND sender_name IS NULL;
```

### Check Date Range

```sql
-- Verify chats are within expected range
SELECT 
  MIN(last_message_at) as oldest_chat,
  MAX(last_message_at) as newest_chat,
  COUNT(*) as total_chats
FROM conversations 
WHERE conversation_type = 'linkedin';
```

---

## 🎯 Default Behavior

### On Account Connect (via UI):
- Syncs **last 30 days** automatically
- Fast and efficient
- Good for getting started

### On Manual Sync:
- Specify `days` or `fullSync` as needed
- Flexible based on use case

### Recommendations:

| Use Case | Recommended Setting |
|----------|-------------------|
| New account setup | Last 30 days (default) |
| Daily sync | Last 7 days |
| Historical data | fullSync: true |
| Testing | Last 7 days |
| Production | Last 30 days |

---

## 🔧 Troubleshooting

### Still getting NULL sender_name errors?

Make sure you restarted the backend after the fix. If persists:

```bash
# Clear old data
DELETE FROM messages WHERE message_type = 'linkedin';
DELETE FROM conversations WHERE conversation_type = 'linkedin';

# Re-run sync
curl -X POST "http://localhost:3001/api/linkedin/sync/full" \
  -d '{"connectedAccountId":"YOUR_UUID"}'
```

### Sync too slow?

Reduce the time range:

```bash
# Sync last 7 days only
curl -X POST "http://localhost:3001/api/linkedin/sync/full" \
  -d '{"connectedAccountId":"YOUR_UUID", "days": 7}'
```

### Need older chats?

Use full sync:

```bash
# Sync ALL chats
curl -X POST "http://localhost:3001/api/linkedin/sync/full" \
  -d '{"connectedAccountId":"YOUR_UUID", "fullSync": true}'
```

---

## 📝 Summary of Changes

### Files Modified:
1. `Converso-backend/src/unipile/linkedinSync.4actions.ts`
   - Added `sender_name: 'LinkedIn Contact'` default in Action 1
   - Added date filtering (last 30 days default)
   - Added `fullSync` option
   - Updated function signatures

2. `Converso-backend/src/routes/linkedin.sync.routes.ts`
   - Updated `/full` endpoint to accept `days` and `fullSync`
   - Updated `/action1` endpoint to accept `days` and `fullSync`
   - Added documentation comments

3. `Converso-backend/src/unipile/linkedinWebhook.4actions.ts`
   - Fixed upsert conflict (already done in previous fix)

---

## 🎉 Ready to Test!

Restart your backend and run the sync. You should now see:

✅ No more NULL constraint violations  
✅ Faster sync (last 30 days by default)  
✅ Option for full historical sync on demand  
✅ All conversation records have sender names  
✅ Messages never have null sender_name  

**Let's test it!** 🚀
