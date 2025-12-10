# 🔧 Fix: Add Service Role Key

## Problem Found ✅
The test revealed **2 critical issues**:

1. ❌ **SUPABASE_SERVICE_ROLE_KEY not set** - Backend can't bypass RLS policies
2. ❌ **No workspaces found** - Need at least one workspace

---

## Solution (5 minutes)

### **Step 1: Get Your Service Role Key** (2 min)

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **Settings** → **API**
4. Under "Project API keys", find **`service_role`**
5. Click **Copy** (⚠️ Keep this secret!)

---

### **Step 2: Add Key to .env File** (1 min)

Open your `.env` file:
```bash
open -e "/Users/satyasharma/Documents/Cursor Codes/Converso-AI-Platform/Converso-backend/.env"
```

Add this line (paste your actual key):
```env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...your-actual-key
```

**Your .env should look like**:
```env
SUPABASE_URL=https://wahvinwuyefmkmgmjspo.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...   # ← ADD THIS

UNIPILE_API_KEY=your-unipile-key
UNIPILE_BASE_URL=https://api23.unipile.com:15315/api/v1
```

Save and close the file.

---

### **Step 3: Create a Workspace** (1 min)

```bash
cd /Users/satyasharma/Documents/Cursor\ Codes/Converso-AI-Platform/Converso-backend

npm run create:workspace
```

You should see:
```
✅ Workspace created successfully!
   Name: Default Workspace
   ID: abc-123-xyz
```

---

### **Step 4: Run Test Again** (1 min)

```bash
npm run test:db
```

**Expected output** (should now pass all tests):
```
✅ PASSED: Supabase connection successful
✅ PASSED: Found 1 workspace(s)
✅ PASSED: Found X LinkedIn account(s)
✅ PASSED: Test message inserted successfully
✅ PASSED: Test message is readable
✅ ALL TESTS PASSED!
```

---

### **Step 5: Restart Backend & Sync** (2 min)

```bash
# Restart backend
cd ..
./RESTART_BACKEND.sh

# Wait for server to start, then:
# Go to http://localhost:5173/settings
# Click "Sync" button
```

**Watch the console** - you should now see:
```
[LinkedIn Sync] ✓ Conversation upserted successfully
[LinkedIn Sync] ✓ Message upserted successfully: msg-456
[LinkedIn Sync] ✅ Completed: 5 conversations, 23 messages
```

---

## ✅ Verification

After sync completes, check Supabase:

```sql
SELECT COUNT(*) FROM public.messages WHERE linkedin_message_id IS NOT NULL;
```

Should show your LinkedIn messages! 🎉

---

## 🐛 If Still Having Issues

Share:
1. Output from `npm run test:db`
2. Backend console logs after clicking Sync
3. Any error messages with ❌

---

## 📋 Quick Command Reference

```bash
# 1. Add service key to .env (manual)
open -e "/Users/satyasharma/Documents/Cursor Codes/Converso-AI-Platform/Converso-backend/.env"

# 2. Create workspace
npm run create:workspace

# 3. Test connection
npm run test:db

# 4. Restart backend
cd .. && ./RESTART_BACKEND.sh

# 5. Trigger sync in UI
# http://localhost:5173/settings → Click "Sync"
```

---

**Status**: Service key is the root cause  
**Fix time**: ~5 minutes  
**Difficulty**: Easy - just copy/paste a key! 🔑
