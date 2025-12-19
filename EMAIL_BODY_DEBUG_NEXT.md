# 🔍 EMAIL BODY DEBUG - Next Steps

## **Current Status:**

✅ API is being called (`GET /api/emails/:id`)
✅ API returns 200 OK
❌ Body is empty (HTML length: 0)

## **Possible Causes:**

1. **Missing Message ID** - Emails don't have `gmail_message_id` or `outlook_message_id`
2. **Missing Account** - `received_account` is null
3. **OAuth Token Expired** - Can't fetch from Gmail/Outlook
4. **Backend Not Calling Fetch** - Condition prevents body fetch

---

## **STEP 1: Check Message IDs (30 sec)**

Run in **Supabase SQL Editor:**

```sql
-- File: CHECK_MESSAGE_IDS.sql
SELECT 
  id,
  subject,
  gmail_message_id,
  outlook_message_id,
  received_on_account_id,
  CASE 
    WHEN gmail_message_id IS NOT NULL THEN 'Has Gmail ID ✅'
    WHEN outlook_message_id IS NOT NULL THEN 'Has Outlook ID ✅'
    ELSE 'NO MESSAGE ID ❌'
  END as message_id_status
FROM conversations
WHERE conversation_type = 'email'
  AND subject LIKE '%meeting recap%'
LIMIT 5;
```

**If all show "NO MESSAGE ID ❌":** The sync didn't store message IDs - this is the problem!

---

## **STEP 2: Test Again With Logs (1 min)**

1. **Click on an email** in the frontend
2. **Check backend logs**:

```bash
tail -20 /tmp/backend.log | grep -E "GET /api/emails|DEBUG:"
```

**Look for:**
```
[GET /api/emails/xxx] Fetching email body for...
[GET /api/emails/xxx] DEBUG: gmail_message_id=..., outlook_message_id=..., received_account=...
```

**If you see:**
- `gmail_message_id=null, outlook_message_id=null` → **Message IDs missing!**
- `received_account=false` → **Account missing!**

---

## **STEP 3: If Message IDs Are Missing**

The new sync architecture creates `messages` records but doesn't store message IDs in `conversations` table.

**We need to either:**

**Option A:** Update sync to store message IDs in conversations
**Option B:** Fetch body from messages table instead

**I recommend Option B** - store bodies in messages table, not conversations.

---

## **DO THIS NOW:**

1. Run SQL from Step 1
2. Click an email and check logs from Step 2
3. Send me:
   - Screenshot of SQL results
   - Backend log output

**Then I'll know exactly what's missing and how to fix it!** 🚀

