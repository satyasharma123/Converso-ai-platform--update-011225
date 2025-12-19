# 🔄 TRIGGER SENT FOLDER SYNC

## 🎯 **Problem:**
Sent folder shows "No Emails" because Gmail/Outlook sent folder hasn't been synced yet.

---

## ✅ **SOLUTION 1: Trigger Sync via UI (Easiest)**

### **Step 1: Go to Email Inbox**
Already there ✅

### **Step 2: Look for Sync Button**
Check top-right area for a sync/refresh icon button

### **Step 3: Click Sync Button**
This will trigger full email sync including sent folder

### **Step 4: Wait 10-30 seconds**
Sent folder should populate with emails from Gmail/Outlook

---

## ✅ **SOLUTION 2: Auto-Sync (If No Manual Button)**

The system auto-syncs every 15 minutes. Just wait and sent folder will populate automatically.

**Check sync status:**
1. Open browser console (F12)
2. Look for sync messages
3. Should see: "Email sync initiated" or "Email sync completed"

---

## ✅ **SOLUTION 3: Trigger Sync via API (If UI Button Missing)**

### **In Browser Console (F12):**

```javascript
// Get your workspace ID and user ID from localStorage
const session = JSON.parse(localStorage.getItem('sb-wahvinwuyefmkmgmjspo-auth-token'));
const userId = session?.user?.id;

// Trigger sync for all email accounts
fetch('http://localhost:3001/api/connected-accounts?userId=' + userId)
  .then(r => r.json())
  .then(data => {
    const emailAccounts = data.data.filter(a => a.account_type === 'email');
    emailAccounts.forEach(account => {
      fetch('http://localhost:3001/api/emails/init-sync', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': userId 
        },
        body: JSON.stringify({ account_id: account.id })
      }).then(() => console.log('Sync triggered for:', account.account_email));
    });
  });
```

---

## 🔍 **VERIFY SENT EMAILS EXIST IN GMAIL/OUTLOOK**

### **Important Check:**
Before syncing, verify you actually have sent emails in Gmail/Outlook:

**For Gmail:**
1. Go to https://mail.google.com
2. Click "Sent" label
3. Check if emails exist

**For Outlook:**
1. Go to https://outlook.com
2. Click "Sent Items" folder
3. Check if emails exist

**If NO sent emails in provider:**
- Nothing to sync!
- Send a test email first
- Then trigger sync

---

## 📊 **CHECK DATABASE (Optional)**

Run this SQL in Supabase to check sync status:

```sql
-- File: CHECK_SENT_SYNC_STATUS.sql
-- (Already created for you)
```

---

## 🎯 **EXPECTED RESULT**

After sync completes:
- ✅ Sent folder shows emails
- ✅ Emails show original sender (not your name)
- ✅ All metadata correct
- ✅ No duplicates

---

## ⏱️ **TIMELINE**

| Action | Time | Result |
|--------|------|--------|
| Trigger sync | Immediate | Sync starts |
| Sync running | 10-30 sec | Processing |
| Sync complete | After ~30 sec | Sent folder populates |

---

## 🚨 **IF SYNC FAILS**

### **Check Console for Errors:**
1. F12 → Console tab
2. Look for errors mentioning "401", "token", "expired"
3. If token expired: Reconnect account in Settings

### **Check Backend Logs:**
1. Terminal running backend
2. Look for sync errors
3. Check for authentication issues

### **Reconnect Account:**
1. Go to Settings → Integrations
2. Disconnect email account
3. Reconnect it
4. Trigger sync again

---

## ✅ **QUICK SUMMARY**

**Easiest way:**
1. Click sync button in UI (if available)
2. Wait 30 seconds
3. Refresh page
4. Check Sent folder

**No sync button?**
- Wait 15 minutes for auto-sync
- OR run JavaScript in console (Solution 3 above)

---

**Your sent emails WILL appear after sync completes!** 🎯


