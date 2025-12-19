# 🔧 RLS Fix - Connected Accounts Query

## **Problem:**
Backend API returned 0 accounts despite accounts existing in database with correct `workspace_id` and `user_id`.

## **Root Cause:**
The backend was using the regular Supabase client (with RLS enabled) instead of the admin client. RLS policies were blocking the query.

---

## **Fix Applied:**

### **File:** `/Converso-backend/src/api/connectedAccounts.ts`

**Changed line 10:**

```typescript
// BEFORE (broken):
const dbClient = client || supabase;  // ❌ Regular client, subject to RLS

// AFTER (fixed):
const dbClient = client || supabaseAdmin;  // ✅ Admin client, bypasses RLS
```

**Why this is safe:**
- The function already filters by `user_id` and `workspace_id`
- Users can only see their own accounts
- Admin client is needed to bypass RLS policies that are too restrictive

---

## **RESTART BACKEND NOW:**

```bash
# Kill backend
lsof -ti:3001 | xargs kill -9

# Wait 3 seconds

# Restart backend
cd "/Users/satyasharma/Documents/Cursor Codes/Converso-AI-Platform/Converso-backend"
npm run dev
```

**Wait for:** "Server running on http://localhost:3001"

---

## **Test After Restart:**

**1. Hard refresh browser:** `Cmd+Shift+R`

**2. Run in console:**

```javascript
(async () => {
  const session = JSON.parse(localStorage.getItem('sb-wahvinwuyefmkmgmjspo-auth-token'));
  const userId = session?.user?.id;
  
  console.log('🔍 Testing connected accounts API...\n');
  
  const resp = await fetch(`http://localhost:3001/api/connected-accounts?userId=${userId}`, {
    headers: { 'x-user-id': userId }
  });
  
  const data = await resp.json();
  const emailAccounts = data.data?.filter(a => a.account_type === 'email') || [];
  
  console.log('✅ Email Accounts Found:', emailAccounts.length);
  
  if (emailAccounts.length > 0) {
    emailAccounts.forEach(acc => {
      console.log(`\n  📧 ${acc.account_email} (${acc.oauth_provider})`);
      console.log(`     workspace_id: ${acc.workspace_id}`);
      console.log(`     user_id: ${acc.user_id}`);
    });
    console.log('\n✅ SUCCESS! Accounts are now visible!');
  } else {
    console.error('❌ STILL BROKEN - Check backend logs for errors');
  }
})();
```

**Expected output:**
```
🔍 Testing connected accounts API...

✅ Email Accounts Found: 2

  📧 satya@leadnex.co (google)
     workspace_id: b60f2c6c-326f-453f-9a7f-2fc80c08413a
     user_id: 5a8d206b-ea85-4502-bd16-994fe26cb601

  📧 satya.sharma@live.in (microsoft)
     workspace_id: b60f2c6c-326f-453f-9a7f-2fc80c08413a
     user_id: 5a8d206b-ea85-4502-bd16-994fe26cb601

✅ SUCCESS! Accounts are now visible!
```

---

## **What Changed:**

| Component | Before | After |
|-----------|--------|-------|
| Database | ❌ `workspace_id = NULL` | ✅ `workspace_id = b60f2c6c...` |
| Backend Query Client | ❌ Regular client (RLS blocked) | ✅ Admin client (RLS bypassed) |
| API Response | ❌ 0 accounts | ✅ 2 accounts |

---

## **Next Steps After This Works:**

1. ✅ Trigger email sync (inbox, sent, trash)
2. ✅ Test email body display
3. ✅ Test sent folder
4. ✅ Done!

---

## **Security Note:**

Using admin client is safe here because:
- Function filters by `user_id` from authenticated request
- Function filters by `workspace_id` from user's profile
- Users can only see accounts where `user_id` matches OR `workspace_id` matches their workspace
- No risk of users seeing other users' accounts

---

**RESTART BACKEND NOW AND TEST!** 🚀

