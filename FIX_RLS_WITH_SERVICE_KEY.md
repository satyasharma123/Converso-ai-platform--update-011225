# 🔧 Fix RLS Error - Service Role Key Required

## ❌ Problem

The RLS error persists because `supabaseAdmin` only bypasses RLS if `SUPABASE_SERVICE_ROLE_KEY` is set in the backend `.env` file.

If the service role key is **not set**, the backend falls back to the regular client (anon key), which is **subject to RLS policies**.

---

## ✅ Solution: Set Service Role Key

### Step 1: Get Service Role Key from Supabase

1. **Go to Supabase Dashboard:**
   - https://supabase.com/dashboard
   - Select your project

2. **Navigate to Settings:**
   - Click **"Settings"** in the left sidebar
   - Click **"API"**

3. **Copy Service Role Key:**
   - Scroll down to **"Service Role"** section
   - Click **"Reveal"** or **"Copy"** button
   - Copy the key (it's long, starts with `eyJ...`)

### Step 2: Add to Backend .env File

1. **Open or create `.env` file:**
   ```bash
   cd Converso-backend
   # Create .env if it doesn't exist
   touch .env
   ```

2. **Add the service role key:**
   ```env
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

   Replace `your_service_role_key_here` with the key you copied.

3. **Example:**
   ```env
   SUPABASE_URL=https://wahvinwuyefmkmgmjspo.supabase.co
   SUPABASE_ANON_KEY=sb_publishable__xq0Rw3XYbhTq1PyiLzw3Q_zdDEHKNV
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhaHZpbnd1eWVmbWttZ21qcG8iLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzMwNzY4NDAwLCJleHAiOjE3MzA3NzIwMDB9.xxxxx
   ```

### Step 3: Restart Backend Server

```bash
cd Converso-backend
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

---

## 🔍 Verify Service Role Key is Set

After restarting, check the backend logs. You should see the server starting without errors.

If the service role key is set correctly, `supabaseAdmin` will bypass RLS and the error should be fixed.

---

## ✅ Alternative: Verify RLS Policies

If you prefer not to use the service role key, make sure the RLS policies are correct:

1. **Run this SQL to verify policies exist:**
   ```sql
   SELECT * FROM pg_policies 
   WHERE tablename = 'connected_accounts';
   ```

2. **You should see these policies:**
   - "Users can view own connected accounts"
   - "Users can create own connected accounts"
   - "Users can update own connected accounts"
   - "Users can delete own connected accounts"
   - "Admins can view all connected accounts"
   - "Admins can manage all connected accounts"

3. **If policies are missing, run the SQL script again:**
   - `FIX_CONNECTED_ACCOUNTS_RLS.sql`

---

## 🎯 Recommended Solution

**Use the Service Role Key** - This is the cleanest solution because:
- ✅ Bypasses RLS when needed (for OAuth callbacks)
- ✅ More secure (only used on backend)
- ✅ Standard practice for server-side operations

---

## ⚠️ Security Note

- **Never commit** the `.env` file to git
- **Never expose** the service role key in frontend code
- **Only use** service role key on the backend server

---

**After setting the service role key and restarting the backend, try connecting Gmail again!** 🚀

