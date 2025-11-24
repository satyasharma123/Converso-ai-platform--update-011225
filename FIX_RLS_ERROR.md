# 🔧 Fix: RLS Policy Error for Connected Accounts

## ❌ Error
**"new row violates row-level security policy for table 'connected_accounts'"**

This happens because the RLS policy only allows **admins** to create connected accounts, but **users** should be able to connect their own Gmail accounts.

---

## ✅ Solution

### Option 1: Run SQL Script (Recommended)

Run this SQL script in **Supabase SQL Editor** to update the RLS policies:

**File:** `FIX_CONNECTED_ACCOUNTS_RLS.sql`

This will:
- Allow users to create their own connected accounts
- Allow users to view/update/delete their own accounts
- Keep admin policies for managing all accounts

### Option 2: Manual SQL

Copy and paste this in Supabase SQL Editor:

```sql
-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Admins can manage connected accounts" ON public.connected_accounts;

-- Allow users to view their own connected accounts
CREATE POLICY IF NOT EXISTS "Users can view own connected accounts"
  ON public.connected_accounts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow users to insert their own connected accounts
CREATE POLICY IF NOT EXISTS "Users can create own connected accounts"
  ON public.connected_accounts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own connected accounts
CREATE POLICY IF NOT EXISTS "Users can update own connected accounts"
  ON public.connected_accounts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own connected accounts
CREATE POLICY IF NOT EXISTS "Users can delete own connected accounts"
  ON public.connected_accounts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Keep admin policy for viewing all accounts
CREATE POLICY IF NOT EXISTS "Admins can view all connected accounts"
  ON public.connected_accounts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Keep admin policy for managing all accounts
CREATE POLICY IF NOT EXISTS "Admins can manage all connected accounts"
  ON public.connected_accounts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
```

---

## 🚀 Steps

1. **Open Supabase Dashboard:**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor:**
   - Click on **"SQL Editor"** in the left sidebar
   - Click **"New query"**

3. **Run the SQL Script:**
   - Copy the SQL from `FIX_CONNECTED_ACCOUNTS_RLS.sql`
   - Paste it in the SQL Editor
   - Click **"Run"** (or press Cmd/Ctrl + Enter)

4. **Verify:**
   - Should see "Success. No rows returned"

5. **Test Again:**
   - Go to Settings → Integrations
   - Click "Connect Gmail"
   - Complete OAuth flow
   - Should work now! ✅

---

## ✅ What This Does

- **Users can create** their own connected accounts (for their own user_id)
- **Users can view** their own connected accounts
- **Users can update** their own connected accounts
- **Users can delete** their own connected accounts
- **Admins can still** view and manage all accounts

---

## 🔒 Security

This is secure because:
- Users can only manage accounts where `user_id = auth.uid()`
- Users cannot see or modify other users' accounts
- Admins still have full access

---

**After running the SQL script, try connecting Gmail again!** 🚀

