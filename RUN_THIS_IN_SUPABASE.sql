-- ============================================
-- URGENT FIX: Run this in Supabase SQL Editor
-- This fixes the "infinite recursion" error
-- ============================================

-- Step 1: Drop ALL existing policies on profiles
DROP POLICY IF EXISTS "Users can view profiles in their workspace" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Step 2: Create simple policy (no recursion)
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Step 3: Verify conversations have required fields
SELECT 
  COUNT(*) as total_conversations,
  COUNT(chat_id) as with_chat_id,
  COUNT(*) - COUNT(chat_id) as missing_chat_id
FROM public.conversations
WHERE conversation_type = 'linkedin';

-- Step 4: Check connected accounts
SELECT 
  id,
  account_name,
  account_type,
  unipile_account_id,
  CASE 
    WHEN unipile_account_id IS NULL THEN '❌ MISSING'
    ELSE '✅ OK'
  END as status
FROM public.connected_accounts
WHERE account_type = 'linkedin';

-- Step 5: If chat_id is missing, update it (temporary fix)
-- ONLY run this if Step 3 shows missing_chat_id > 0
UPDATE public.conversations
SET chat_id = 'chat-' || id
WHERE conversation_type = 'linkedin'
AND chat_id IS NULL;

-- Step 6: Test the fix
SELECT 
  'RLS Policy Fixed' as status,
  COUNT(*) as total_profiles
FROM public.profiles;

-- ============================================
-- After running this:
-- 1. Go to your terminal
-- 2. Kill the backend: kill -9 $(lsof -ti:3001)
-- 3. Restart backend: npm run dev
-- 4. Hard refresh frontend: Cmd+Shift+R
-- 5. Try sending a message
-- ============================================
