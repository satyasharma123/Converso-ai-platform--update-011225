# 🚀 QUICK START: Unified Folder Sync

## 🎯 **Goal**
Inbox, Sent, and Trash folders now use the SAME sync pipeline with folder info stored at message level.

---

## ⚡ **3-Step Quick Start**

### **Step 1: Apply Database Migration** (2 minutes) ⚠️

**Open Supabase SQL Editor:**
https://supabase.com/dashboard/project/wahvinwuyefmkmgmjspo/sql/new

**Copy and run:** `APPLY_MIGRATION_NOW.sql`

**Verify:**
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'messages' 
  AND column_name = 'provider_folder';
```
Expected: 1 row (✅ Migration successful)

---

### **Step 2: Trigger Email Sync** (30 seconds)

**Option A: Browser Console (Fastest)**

1. Open Converso frontend in browser
2. Press **F12** → **Console** tab
3. Paste this code:

```javascript
(async () => {
  const session = JSON.parse(localStorage.getItem('sb-wahvinwuyefmkmgmjspo-auth-token'));
  const userId = session?.user?.id;
  
  const accounts = await fetch(`http://localhost:3001/api/connected-accounts?userId=${userId}`, {
    headers: { 'x-user-id': userId }
  }).then(r => r.json());
  
  const emailAccounts = accounts.data.filter(a => a.account_type === 'email');
  
  for (const account of emailAccounts) {
    await fetch('http://localhost:3001/api/emails/init-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId
      },
      body: JSON.stringify({ account_id: account.id })
    });
    console.log('✅ Sync triggered:', account.account_email);
  }
  
  console.log('⏳ Wait 30 seconds then refresh page...');
})();
```

4. Press **Enter**
5. **Wait 30 seconds**
6. **Refresh page** (Cmd+R or F5)

---

### **Step 3: Verify Folders** (1 minute)

**Check frontend:**
- ✅ Click **"Sent"** folder → Should show sent emails
- ✅ Click **"Inbox"** folder → Should show inbox emails  
- ✅ Click **"Archive"** folder → Should show archived emails

**Check database (optional):**
```sql
SELECT 
  provider_folder, 
  COUNT(*) as count
FROM messages
WHERE provider_folder IS NOT NULL
GROUP BY provider_folder;
```

Expected output:
```
provider_folder | count
-----------------+-------
inbox            | 437
sent             | 50
archive          | 10
```

---

## ✅ **Success!**

If you see emails in Sent folder, **implementation is working!** 🎉

---

## 🚨 **Troubleshooting**

### **Sent folder still empty?**

**Check Gmail/Outlook:**
- Log in to Gmail/Outlook web
- Verify you have sent emails

**Re-trigger sync:**
- Run Step 2 again
- Wait 30 seconds
- Refresh page

**Check backend logs:**
```bash
tail -f /tmp/backend.log | grep "Created message"
```

Expected: 
```
Created message: Email subject in sent folder
Created message: Another subject in inbox folder
```

### **Migration failed?**

**Error: "column already exists"**
- ✅ This is fine! Column was already added.
- Just continue to Step 2.

**Error: "permission denied"**
- Ensure you're logged in to Supabase dashboard as admin
- Check project: `wahvinwuyefmkmgmjspo`

---

## 📚 **What Changed?**

**Backend:**
- Emails now stored as **messages with provider_folder**
- One conversation per THREAD (not per message)
- Folder derived from latest message

**Frontend:**
- Uses `derived_folder` from backend
- Filters conversations by folder

**Database:**
- `messages.provider_folder` = 'inbox' | 'sent' | 'trash'
- `messages.provider_message_id` = Unique Gmail/Outlook ID
- Prevents duplicate messages

---

## 🔒 **Safety Guarantees**

✅ LinkedIn: **NOT TOUCHED**  
✅ Email Send API: **NOT TOUCHED**  
✅ Inbox sync: **STILL WORKS**  

Only **ADDED** support for Sent and Trash folders.

---

## 📖 **Full Documentation**

See: `UNIFIED_FOLDER_SYNC_IMPLEMENTATION.md`

---

**Ready to test? Start with Step 1!** 🚀


