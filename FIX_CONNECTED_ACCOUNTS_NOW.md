# 🔴 URGENT: Fix Connected Accounts (0 accounts found)

## **THE PROBLEM:**

```
Email Accounts: 0
```

Your Gmail and Outlook accounts are **NOT connected** despite reconnecting them.

This is causing:
- ❌ No sync for Sent/Trash folders (no accounts to sync)
- ❌ Email bodies disappearing (can't fetch full bodies)
- ❌ Everything broken

---

## **STEP 1: Check Database (30 seconds)**

Run this in **Supabase SQL Editor:**

```sql
-- File: CHECK_CONNECTED_ACCOUNTS.sql
-- Copy entire file and run
```

**Send me the output** (especially Check 1 and Check 2)

This will tell us:
1. Are accounts in database but wrong workspace?
2. Are accounts inactive?
3. Are accounts missing entirely?

---

## **STEP 2: Fix Based on Results**

### **SCENARIO A: Accounts exist but wrong workspace_id**

**If Check 1 shows accounts but Check 2 shows different workspace_id:**

```sql
-- Fix workspace_id mismatch
UPDATE connected_accounts
SET workspace_id = 'b60f2c6c-326f-453f-9a7f-2fc80c08413a'
WHERE account_type = 'email'
  AND workspace_id != 'b60f2c6c-326f-453f-9a7f-2fc80c08413a';
```

Then **refresh browser** and run the sync check again.

---

### **SCENARIO B: Accounts are inactive**

**If Check 4 shows is_active = false:**

```sql
-- Reactivate accounts
UPDATE connected_accounts
SET is_active = true
WHERE account_type = 'email'
  AND is_active = false;
```

Then **refresh browser** and run the sync check again.

---

### **SCENARIO C: Accounts don't exist at all**

**If Check 1 shows 0 rows or no email accounts:**

The reconnection didn't work. Let's do it properly:

1. **Open Settings → Integrations** in your app
2. **Look for Gmail/Outlook** - are they listed?
3. **If YES but shows "Connected":**
   - Click "Disconnect"
   - Wait 5 seconds
   - Click "Connect" again
   - **Follow OAuth flow completely**
   - Make sure you see "Successfully connected" message

4. **If NO (not listed at all):**
   - This is a frontend bug
   - We need to check the integration settings page

---

## **STEP 3: Verify Connection (30 seconds)**

After fixing, run this in **browser console:**

```javascript
(async () => {
  const session = JSON.parse(localStorage.getItem('sb-wahvinwuyefmkmgmjspo-auth-token'));
  const userId = session?.user?.id;
  
  const acctResp = await fetch(`http://localhost:3001/api/connected-accounts?userId=${userId}`, {
    headers: { 'x-user-id': userId }
  });
  const acctData = await acctResp.json();
  const emailAccounts = acctData.data.filter(a => a.account_type === 'email');
  
  console.log('✅ Email Accounts:', emailAccounts.length);
  emailAccounts.forEach(acc => {
    console.log(`  - ${acc.account_email} (${acc.oauth_provider}) [${acc.is_active ? 'ACTIVE' : 'INACTIVE'}]`);
  });
  
  if (emailAccounts.length === 0) {
    console.error('❌ STILL NO ACCOUNTS - accounts did not save properly');
  } else {
    console.log('✅ Accounts found! Now trigger sync:');
    console.log(`
for (const account of ${JSON.stringify(emailAccounts.map(a => a.id))}) {
  const resp = await fetch('http://localhost:3001/api/emails/init-sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': '${userId}'
    },
    body: JSON.stringify({ account_id: account })
  });
  console.log(account, await resp.text());
}
    `);
  }
})();
```

**Expected output:**
```
✅ Email Accounts: 2
  - satya@leadnex.co (google) [ACTIVE]
  - satya@example.com (microsoft) [ACTIVE]
```

---

## **STEP 4: Once Accounts Show Up, Trigger Sync**

Copy the sync code from Step 3 output and run it:

```javascript
// Will be generated in Step 3
// Copy and paste the for loop
```

Wait 2-3 minutes, then verify:

```sql
-- Check if sync created messages
SELECT 
  provider_folder,
  COUNT(*) as count
FROM messages m
JOIN conversations c ON c.id = m.conversation_id
WHERE c.conversation_type = 'email'
GROUP BY provider_folder;
```

**Expected:**
```
provider_folder | count
----------------+-------
inbox           | 400+
sent            | 50+
trash           | 10+
```

---

## **STEP 5: If Accounts Still Won't Save**

There's a bug in the OAuth callback or connected_accounts table.

**Check backend logs for OAuth errors:**

```bash
tail -50 /tmp/backend.log | grep -E "oauth|OAuth|connected_accounts|ERROR"
```

**Send me:**
1. Output of CHECK_CONNECTED_ACCOUNTS.sql (Step 1)
2. Screenshot of Settings → Integrations page
3. Backend log errors (Step 5)

---

## **Quick Summary:**

1. ✅ Run `CHECK_CONNECTED_ACCOUNTS.sql` in Supabase
2. ✅ Based on results, either:
   - Fix workspace_id (Scenario A)
   - Activate accounts (Scenario B)  
   - Reconnect properly (Scenario C)
3. ✅ Verify with browser console script
4. ✅ Trigger sync
5. ✅ Verify messages created

**Start with Step 1 and send me the SQL results.** 🚀

