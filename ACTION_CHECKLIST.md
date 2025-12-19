# ✅ ACTION CHECKLIST - Unified Folder Sync

## 🎯 **Implementation Status: COMPLETE**

All code changes are done. Now you need to **apply migration and test**.

---

## 📋 **Your Action Items**

### **☐ Step 1: Apply Database Migration** (2 minutes)

1. Open Supabase SQL Editor:
   - Go to: https://supabase.com/dashboard/project/wahvinwuyefmkmgmjspo/sql/new

2. Copy contents of: `APPLY_MIGRATION_NOW.sql`

3. Click **"Run"**

4. Verify success:
   ```sql
   SELECT column_name 
   FROM information_schema.columns 
   WHERE table_name = 'messages' 
     AND column_name IN ('provider_folder', 'provider_message_id');
   ```
   
   **Expected:** 2 rows returned ✅

---

### **☐ Step 2: Refresh Frontend** (10 seconds)

1. Go to your Converso tab in browser
2. Hard refresh: **Cmd+Shift+R** (Mac) or **Ctrl+Shift+R** (Windows)

---

### **☐ Step 3: Trigger Email Sync** (30 seconds)

**In browser console (F12 → Console):**

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

**Press Enter**

---

### **☐ Step 4: Wait** (30 seconds)

Sync is running in background. You'll see backend logs:

```bash
tail -f /tmp/backend.log | grep "Created message"
```

Expected output:
```
Created message: Subject 1 in inbox folder
Created message: Subject 2 in sent folder
Created message: Subject 3 in archive folder
```

---

### **☐ Step 5: Refresh & Test** (1 minute)

1. **Refresh page** (Cmd+R)

2. **Test folders:**
   - ✅ Click **"Inbox"** → Should show inbox emails
   - ✅ Click **"Sent"** → Should show sent emails from Gmail/Outlook
   - ✅ Click **"Archive"** → Should show archived emails
   - ✅ Click **"Deleted"** → Should show trashed emails (if any)

3. **Verify sent folder populated:**
   - If empty, check if Gmail/Outlook has sent emails
   - If still empty, run Step 3 again

---

### **☐ Step 6: Verify Database** (Optional)

```sql
-- Check messages with provider_folder
SELECT 
  provider_folder, 
  COUNT(*) as count,
  MAX(created_at) as most_recent
FROM messages
WHERE provider_folder IS NOT NULL
GROUP BY provider_folder
ORDER BY count DESC;
```

**Expected output:**
```
provider_folder | count | most_recent
-----------------+-------+-------------------
inbox            | 437   | 2025-12-17 09:51:00
sent             | 50    | 2025-12-17 09:50:00
archive          | 10    | 2025-12-16 10:00:00
```

---

## ✅ **Success Criteria**

- [x] Migration applied (provider_folder column exists)
- [ ] Sent folder shows emails from Gmail/Outlook Sent folder
- [ ] Inbox folder still works (no regression)
- [ ] No duplicate emails appear
- [ ] LinkedIn inbox unaffected

---

## 🚨 **Troubleshooting**

### **Problem: Sent folder empty**

**Solution 1: Check Gmail/Outlook**
- Log in to Gmail/Outlook web
- Verify Sent folder has emails

**Solution 2: Re-trigger sync**
- Run Step 3 again
- Wait 30 seconds
- Refresh page

**Solution 3: Check backend logs**
```bash
tail -f /tmp/backend.log | grep -i "sent\|error"
```

---

### **Problem: Migration fails**

**Error: "column already exists"**
- ✅ Safe to ignore - column was already added
- Continue to Step 2

**Error: "permission denied"**
- Log in to Supabase dashboard as project admin
- Verify project: `wahvinwuyefmkmgmjspo`

---

### **Problem: Backend not responding**

**Check if running:**
```bash
curl http://localhost:3001/ || echo "Backend not running"
```

**Restart backend:**
```bash
lsof -ti:3001 | xargs kill -9
cd Converso-backend && npm run dev
```

---

## 📚 **Documentation Reference**

| File | Purpose |
|------|---------|
| `ACTION_CHECKLIST.md` | **This file** - Step-by-step actions |
| `QUICK_START_UNIFIED_SYNC.md` | Quick start guide |
| `UNIFIED_FOLDER_SYNC_IMPLEMENTATION.md` | Full technical documentation |
| `FILES_CHANGED_UNIFIED_SYNC.md` | Code changes summary |
| `APPLY_MIGRATION_NOW.sql` | Database migration script |

---

## 🎯 **Timeline**

| Step | Time | Status |
|------|------|--------|
| Code changes | Done ✅ | Complete |
| Apply migration | 2 min | **← YOU ARE HERE** |
| Trigger sync | 30 sec | Waiting |
| Verify folders | 1 min | Waiting |
| **Total** | **~4 min** | |

---

## 🚀 **Next Step**

**→ Go to Step 1: Apply Migration** ⬆️

Open Supabase SQL Editor and run `APPLY_MIGRATION_NOW.sql`

---

**Questions? Check `UNIFIED_FOLDER_SYNC_IMPLEMENTATION.md` for full details!**


