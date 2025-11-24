-- ============================================
-- Fix RLS Policy for Connected Accounts
-- Allow users to create and manage their own connected accounts
-- ============================================

-- Drop existing policies first (to avoid conflicts)
DROP POLICY IF EXISTS "Admins can manage connected accounts" ON public.connected_accounts;
DROP POLICY IF EXISTS "Admins can view all connected accounts" ON public.connected_accounts;
DROP POLICY IF EXISTS "Users can view own connected accounts" ON public.connected_accounts;
DROP POLICY IF EXISTS "Users can create own connected accounts" ON public.connected_accounts;
DROP POLICY IF EXISTS "Users can update own connected accounts" ON public.connected_accounts;
DROP POLICY IF EXISTS "Users can delete own connected accounts" ON public.connected_accounts;
DROP POLICY IF EXISTS "Admins can manage all connected accounts" ON public.connected_accounts;

-- Allow users to view their own connected accounts
CREATE POLICY "Users can view own connected accounts"
  ON public.connected_accounts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow users to insert their own connected accounts
CREATE POLICY "Users can create own connected accounts"
  ON public.connected_accounts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own connected accounts
CREATE POLICY "Users can update own connected accounts"
  ON public.connected_accounts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own connected accounts
CREATE POLICY "Users can delete own connected accounts"
  ON public.connected_accounts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Keep admin policy for viewing all accounts (optional, for admin dashboard)
CREATE POLICY "Admins can view all connected accounts"
  ON public.connected_accounts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Keep admin policy for managing all accounts (optional, for admin dashboard)
CREATE POLICY "Admins can manage all connected accounts"
  ON public.connected_accounts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

