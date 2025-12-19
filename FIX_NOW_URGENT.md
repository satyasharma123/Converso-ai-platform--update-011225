# 🚨 URGENT FIX - Email Body & Sent/Trash Sync

## **Problems:**
1. ❌ Email body disappearing (showing "No email content available")
2. ❌ Sent folder only shows emails sent from Converso (not from Gmail/Outlook server)
3. ❌ Trash folder not syncing

## **Root Cause:**
The new sync creates `messages` records but email bodies are still in `conversations` table. Frontend might be confused about where to read from.

---

## **STEP 1: Diagnose (30 seconds)** ⚠️

**Run in Supabase SQL Editor:**

```sql
-- File: EMERGENCY_DIAGNOSTICS.sql
-- Copy and run the entire file
```

**Expected output:**
- Check 1: Should show email conversations have bodies (html_length > 0)
- Check 3: Shows sent emails in conversations table
- Check 4: Shows sent messages in messages table (should be > 0 if sync worked)
- Check 5: Shows trash messages (should be > 0 if sync worked)

**If Check 4 or 5 shows 0:** Sent/Trash sync is NOT running or failing

---

## **STEP 2: Check Sync Errors (30 seconds)**

**Run in Browser Console (F12):**

```javascript
// File: CHECK_SYNC_ERRORS.js
// Copy and run the entire file
```

**This will show:**
- Sync status for each account
- Any sync errors
- Last sync time

**Look for:**
- `Status: error` - Sync failed
- `Error: ...` - Specific error message

---

## **STEP 3: Fix Based on Diagnosis**

### **If email bodies ARE in conversations table (Check 1 shows lengths > 0):**

**Problem:** Frontend is not reading correctly

**Fix:** The frontend code looks correct. Issue might be caching.

**Try:**
1. Hard refresh: **Cmd+Shift+R** (clears cache)
2. Open DevTools → Application → Clear Storage → Clear site data
3. Refresh again

---

### **If Sent/Trash messages = 0 (Check 4/5 show 0):**

**Problem:** Sync is not running for sent/trash folders

**Possible causes:**
1. Sync errored out before reaching sent/trash folders
2. Gmail/Outlook API error
3. OAuth token expired

**Fix:**

**A) Check sync errors from Step 2**

If you see errors, they'll tell us what's wrong.

**B) Trigger sync again manually:**

```javascript
// In browser console
(async () => {
  const session = JSON.parse(localStorage.getItem('sb-wahvinwuyefmkmgmjspo-auth-token'));
  const userId = session?.user?.id;
  
  const acctResp = await fetch(`http://localhost:3001/api/connected-accounts?userId=${userId}`, {
    headers: { 'x-user-id': userId }
  });
  const acctData = await acctResp.json();
  const emailAccounts = acctData.data.filter(a => a.account_type === 'email');
  
  for (const account of emailAccounts) {
    console.log(`Syncing ${account.account_email}...`);
    const response = await fetch('http://localhost:3001/api/emails/init-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId
      },
      body: JSON.stringify({ account_id: account.id })
    });
    
    if (response.ok) {
      console.log(`✅ Sync started for ${account.account_email}`);
    } else {
      const error = await response.text();
      console.error(`❌ SYNC FAILED for ${account.account_email}:`);
      console.error(error);
    }
  }
  
  console.log('⏳ Wait 2-3 minutes, then run EMERGENCY_DIAGNOSTICS.sql again');
})();
```

**Wait 2-3 minutes**, then run Step 1 SQL again to check if counts increased.

---

## **STEP 4: If Sync Keeps Failing**

**Check backend logs in terminal:**

```bash
# In a terminal
tail -f /tmp/backend.log | grep -v "Binary" | grep -E "error|Error|ERROR|failed|Failed"
```

**Then trigger sync again** (Step 3B) and watch for errors in real-time.

**Common errors:**
- `401 Unauthorized` → OAuth token expired, reconnect account
- `403 Forbidden` → Permission denied, reconnect account
- `429 Rate limit` → Wait 5 minutes, try again
- `Network error` → Check internet connection

---

## **STEP 5: Nuclear Option - Reconnect Accounts**

If sync keeps failing:

1. **Go to:** Settings → Integrations
2. **Disconnect** Gmail account
3. **Disconnect** Outlook account  
4. **Wait 10 seconds**
5. **Reconnect** Gmail
6. **Reconnect** Outlook
7. **Run Step 3B** to trigger sync
8. **Wait 3 minutes**
9. **Run Step 1** to verify

---

## **Expected Results After Fix:**

**In Supabase (Step 1 SQL):**
```
Check 1: Email conversations with bodies
total | has_html_body | has_text_body
------+---------------+--------------
 443  |      443      |     443        ✅ Bodies exist

Check 4: Sent messages (new arch)
count
------
  52   ✅ Sent emails synced

Check 5: Trash messages
count
------
  8    ✅ Trash emails synced
```

**In Frontend:**
- Inbox emails show content ✅
- Sent folder shows emails from Gmail/Outlook ✅
- Trash folder shows deleted emails ✅

---

## **If Still Not Working:**

**Send me:**
1. Output of Step 1 (SQL diagnostics)
2. Output of Step 2 (sync status)
3. Any error messages from Step 3B (manual sync)
4. Backend log errors from Step 4

**With this info, I can pinpoint the exact issue and fix it immediately.**

---

## **Quick Summary:**

1. Run `EMERGENCY_DIAGNOSTICS.sql` in Supabase
2. Run `CHECK_SYNC_ERRORS.js` in browser console
3. Based on output, either:
   - Hard refresh browser (if bodies exist but not showing)
   - Trigger sync manually (if sent/trash counts are 0)
   - Reconnect accounts (if sync keeps failing)
4. Send me diagnostic outputs if still broken

---

**Start with Step 1 NOW and send me the results.** 🚀

