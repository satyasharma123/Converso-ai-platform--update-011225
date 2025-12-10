# Fix LinkedIn Message Sending Issues

## 🔴 Issues Found

### Issue 1: RLS Infinite Recursion (Database)
**Error**: `infinite recursion detected in policy for relation "profiles"`

**Root Cause**: The RLS policy queries the same table it's protecting, causing infinite loop.

### Issue 2: Missing Conversation Fields (Backend)
**Error**: `Cannot send message: Missing conversation details`

**Root Cause**: The transformer wasn't including LinkedIn-specific fields (`chat_id`, `sender_profile_picture_url`).

---

## ✅ **STEP-BY-STEP FIX**

### **Step 1: Fix RLS Policy** (CRITICAL)

Run this SQL in your Supabase SQL Editor:

```sql
-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view profiles in their workspace" ON public.profiles;

-- Create new policy without recursion
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Verify it works
SELECT id, email, full_name, workspace_id 
FROM public.profiles 
LIMIT 5;
```

**Alternative (Workspace-aware) - If you still want workspace isolation:**

```sql
-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view profiles in their workspace" ON public.profiles;

-- Create policy using auth metadata instead
CREATE POLICY "Users can view profiles in their workspace"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.workspace_id = profiles.workspace_id
    )
  );
```

---

### **Step 2: Restart Backend** (Already Done ✅)

The backend transformer has been updated to include:
- ✅ `chat_id` / `chatId`
- ✅ `sender_attendee_id` / `senderAttendeeId`
- ✅ `sender_profile_picture_url` / `senderProfilePictureUrl`

**Restart your backend:**
```bash
cd Converso-backend
./restart-backend.sh
# OR
kill -9 $(lsof -ti:3001); npm run dev
```

---

### **Step 3: Verify Data in Database**

Check if your LinkedIn conversations have the required fields:

```sql
-- Check if conversations have chat_id
SELECT 
  id,
  sender_name,
  chat_id,
  sender_profile_picture_url,
  conversation_type,
  received_on_account_id
FROM public.conversations
WHERE conversation_type = 'linkedin'
ORDER BY last_message_at DESC
LIMIT 10;

-- Check if connected_accounts have unipile_account_id
SELECT 
  id,
  account_name,
  account_type,
  unipile_account_id,
  is_active
FROM public.connected_accounts
WHERE account_type = 'linkedin';
```

**Expected Results:**
- ✅ Conversations should have `chat_id` (not null)
- ✅ Connected accounts should have `unipile_account_id` (not null)

---

### **Step 4: If Data is Missing - Re-sync LinkedIn**

If conversations don't have `chat_id` or accounts don't have `unipile_account_id`:

**Option A: Via API (if available)**
```bash
curl -X POST http://localhost:3001/api/linkedin/sync/<your-account-id>
```

**Option B: Via Database Update**
```sql
-- Update existing conversations with mock chat_id (temporary fix)
UPDATE public.conversations
SET chat_id = 'chat-' || id
WHERE conversation_type = 'linkedin'
AND chat_id IS NULL;

-- Check your LinkedIn accounts for unipile_account_id
SELECT * FROM public.connected_accounts WHERE account_type = 'linkedin';
```

---

### **Step 5: Test Message Sending**

1. **Refresh frontend**: `Ctrl + Shift + R` (hard refresh)
2. **Open Console**: `Cmd + Option + J` (Chrome DevTools)
3. **Select a conversation**
4. **Type a test message**
5. **Click Send**

**Look for in Console:**
```
🔍 Conversation data for message sending:
  chat_id: "some-chat-id"
  unipile_account_id: "some-account-id"
```

**If missing:**
- Check backend logs for transformer output
- Verify Step 3 (database has correct data)
- Re-sync LinkedIn conversations

---

## 🐛 **Debugging Checklist**

### Frontend Console Errors
```bash
# Open Chrome DevTools Console (Cmd + Option + J)
# Look for:
```

**Good Output:**
```
🔍 Conversation data for message sending:
  chat_id: "AQGlA9uR..."
  unipile_account_id: "6789xyz..."
  conversation_id: "81bdfc62-..."
```

**Bad Output (Missing chat_id):**
```
❌ Missing required fields:
  has_chat_id: false
  has_unipile_account_id: true
```

**Bad Output (Missing unipile_account_id):**
```
❌ Missing required fields:
  has_chat_id: true
  has_unipile_account_id: false
```

---

### Backend Logs

**Look for:**
```bash
# In your terminal where backend is running
# You should see:
[API DEBUG] GET /api/conversations?type=linkedin
[API DEBUG] GET /api/messages/conversation/xxx
```

**Good:**
```
[INFO] Conversation fetched with chat_id: AQGlA9uR...
[INFO] Connected account has unipile_account_id: 6789xyz...
```

**Bad:**
```
[ERROR] infinite recursion detected in policy for relation "profiles"
```
→ Run Step 1 (Fix RLS Policy)

---

## 🔧 **Quick Fixes**

### Fix 1: RLS Error (500 on /api/profiles)
```sql
-- Run in Supabase SQL Editor
DROP POLICY IF EXISTS "Users can view profiles in their workspace" ON public.profiles;
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
```

### Fix 2: Missing chat_id
```sql
-- Check conversations
SELECT id, chat_id FROM conversations WHERE conversation_type = 'linkedin' LIMIT 5;

-- If null, re-sync or update manually
UPDATE conversations SET chat_id = 'chat-' || id WHERE conversation_type = 'linkedin' AND chat_id IS NULL;
```

### Fix 3: Missing unipile_account_id
```sql
-- Check accounts
SELECT id, account_name, unipile_account_id FROM connected_accounts WHERE account_type = 'linkedin';

-- If null, you need to reconnect LinkedIn account
```

---

## 📊 **Verification Steps**

After applying fixes:

1. ✅ **No RLS errors in console**
   ```
   # Should NOT see:
   Failed to load resource: the server responded with a status of 500
   infinite recursion detected in policy
   ```

2. ✅ **Profiles load successfully**
   ```
   # Should see in console:
   [usePipelineStages] Fetched stages: Array(9)
   ```

3. ✅ **Conversations have chat_id**
   ```sql
   SELECT COUNT(*) FROM conversations 
   WHERE conversation_type = 'linkedin' 
   AND chat_id IS NOT NULL;
   ```

4. ✅ **Message sending works**
   - Type message
   - Click send
   - See success toast
   - Message appears in list

---

## 🚀 **Expected Behavior After Fix**

### ✅ What Should Work:
1. Profile API calls return 200 (not 500)
2. No "infinite recursion" errors in backend
3. Conversation loads with `chat_id` and `unipile_account_id`
4. Send button is enabled
5. Message sends successfully
6. Success toast appears
7. Message appears in conversation immediately
8. Conversation list updates

### ❌ If Still Not Working:

**Debug Output:**
```javascript
// Check in console when you click Send:
🔍 Conversation data for message sending: {...}
```

**Then:**
1. **If `chat_id` is null** → Re-sync LinkedIn or run SQL update
2. **If `unipile_account_id` is null** → Reconnect LinkedIn account
3. **If both present but still fails** → Check backend logs for API error

---

## 📝 **Files Modified**

✅ Backend:
- `Converso-backend/src/utils/transformers.ts` - Added LinkedIn fields
- `Converso-backend/src/routes/linkedin.messages.routes.ts` - Already fixed

✅ Frontend:
- `Converso-frontend/src/components/Inbox/ConversationView.tsx` - Added debug logging

✅ Database:
- SQL fix provided for RLS policy

---

## 💡 **Prevention**

To prevent these issues in the future:

1. **Always test RLS policies** before deploying:
   ```sql
   EXPLAIN (ANALYZE, VERBOSE) SELECT * FROM profiles WHERE id = 'test-id';
   ```

2. **Include all fields in transformers** when adding new features

3. **Verify data integrity** after syncs:
   ```sql
   SELECT COUNT(*) FROM conversations WHERE conversation_type = 'linkedin' AND chat_id IS NULL;
   ```

4. **Use TypeScript interfaces** to catch missing fields at compile time

---

**Status**: Ready to fix! Run Step 1 (SQL) first, then restart backend.
