-- Fix RLS Policies for LinkedIn Sync
-- Run this in Supabase SQL Editor if you get RLS policy errors

-- ============================================
-- 1. Add service_role policies for messages table
-- ============================================

-- Allow service role to manage all messages
CREATE POLICY IF NOT EXISTS "Service role can manage all messages"
  ON public.messages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 2. Add service_role policies for conversations table
-- ============================================

-- Allow service role to manage all conversations
CREATE POLICY IF NOT EXISTS "Service role can manage all conversations"
  ON public.conversations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 3. Verify policies exist
-- ============================================

-- Check messages policies
SELECT 
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'messages';

-- Check conversations policies
SELECT 
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'conversations';

-- ============================================
-- Expected Output:
-- ============================================
-- You should see at least one policy for service_role on each table:
-- 
-- messages:
--   - "Service role can manage all messages" (ALL) for service_role
--   - Other policies for authenticated users
--
-- conversations:
--   - "Service role can manage all conversations" (ALL) for service_role
--   - Other policies for authenticated users
