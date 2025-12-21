-- =====================================================
-- SDRXS PHASE 3.5 — USER-SPECIFIC CONVERSATION STATE
-- =====================================================
-- 
-- Problem:
-- - is_favorite and is_read are stored on conversations table (global)
-- - Admin marking favorite affects SDR view
-- - SDR marking unread affects Admin view
--
-- Solution:
-- - Create conversation_user_state table for per-user state
-- - Migrate existing data
-- - Each user has independent favorite/unread state
--
-- =====================================================

-- Create conversation_user_state table
CREATE TABLE IF NOT EXISTS public.conversation_user_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  is_read BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- Create indexes for performance
CREATE INDEX idx_conversation_user_state_conversation ON public.conversation_user_state(conversation_id);
CREATE INDEX idx_conversation_user_state_user ON public.conversation_user_state(user_id);
CREATE INDEX idx_conversation_user_state_unread ON public.conversation_user_state(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_conversation_user_state_favorite ON public.conversation_user_state(user_id, is_favorite) WHERE is_favorite = true;

-- Enable RLS
ALTER TABLE public.conversation_user_state ENABLE ROW LEVEL SECURITY;

-- Users can only see/modify their own state
CREATE POLICY "Users can manage own conversation state"
  ON public.conversation_user_state
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- MIGRATE EXISTING DATA
-- =====================================================
-- 
-- Strategy:
-- For each conversation with is_favorite=true or is_read=false,
-- create a user_state record for the assigned_to user
-- (if assigned_to is not null)
--
-- Note: This is a best-effort migration. Global state will become
-- user-specific state for the assigned user.
-- =====================================================

-- Migrate favorite conversations
INSERT INTO public.conversation_user_state (conversation_id, user_id, is_favorite, is_read)
SELECT 
  c.id AS conversation_id,
  c.assigned_to AS user_id,
  COALESCE(c.is_favorite, false) AS is_favorite,
  COALESCE(c.is_read, true) AS is_read
FROM public.conversations c
WHERE c.assigned_to IS NOT NULL
  AND (c.is_favorite = true OR c.is_read = false)
ON CONFLICT (conversation_id, user_id) DO NOTHING;

-- =====================================================
-- HELPER FUNCTION: Get or Create User State
-- =====================================================
-- 
-- This function ensures a user_state record exists for a conversation
-- Returns the current state or creates a default one
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_or_create_user_state(
  p_conversation_id UUID,
  p_user_id UUID
)
RETURNS public.conversation_user_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state public.conversation_user_state;
BEGIN
  -- Try to get existing state
  SELECT * INTO v_state
  FROM public.conversation_user_state
  WHERE conversation_id = p_conversation_id
    AND user_id = p_user_id;
  
  -- If not found, create default state
  IF NOT FOUND THEN
    INSERT INTO public.conversation_user_state (conversation_id, user_id, is_favorite, is_read)
    VALUES (p_conversation_id, p_user_id, false, true)
    RETURNING * INTO v_state;
  END IF;
  
  RETURN v_state;
END;
$$;

-- =====================================================
-- HELPER FUNCTION: Toggle Favorite
-- =====================================================

CREATE OR REPLACE FUNCTION public.toggle_conversation_favorite(
  p_conversation_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_value BOOLEAN;
BEGIN
  -- Insert or update user state
  INSERT INTO public.conversation_user_state (conversation_id, user_id, is_favorite, is_read, updated_at)
  VALUES (p_conversation_id, p_user_id, true, true, now())
  ON CONFLICT (conversation_id, user_id) 
  DO UPDATE SET 
    is_favorite = NOT conversation_user_state.is_favorite,
    updated_at = now()
  RETURNING is_favorite INTO v_new_value;
  
  RETURN v_new_value;
END;
$$;

-- =====================================================
-- HELPER FUNCTION: Toggle Read Status
-- =====================================================

CREATE OR REPLACE FUNCTION public.toggle_conversation_read(
  p_conversation_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_value BOOLEAN;
BEGIN
  -- Insert or update user state
  INSERT INTO public.conversation_user_state (conversation_id, user_id, is_favorite, is_read, updated_at)
  VALUES (p_conversation_id, p_user_id, false, false, now())
  ON CONFLICT (conversation_id, user_id) 
  DO UPDATE SET 
    is_read = NOT conversation_user_state.is_read,
    updated_at = now()
  RETURNING is_read INTO v_new_value;
  
  RETURN v_new_value;
END;
$$;

-- =====================================================
-- HELPER FUNCTION: Mark as Read
-- =====================================================

CREATE OR REPLACE FUNCTION public.mark_conversation_read(
  p_conversation_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert or update user state to mark as read
  INSERT INTO public.conversation_user_state (conversation_id, user_id, is_favorite, is_read, updated_at)
  VALUES (p_conversation_id, p_user_id, false, true, now())
  ON CONFLICT (conversation_id, user_id) 
  DO UPDATE SET 
    is_read = true,
    updated_at = now();
END;
$$;

-- =====================================================
-- HELPER FUNCTION: Mark as Unread
-- =====================================================

CREATE OR REPLACE FUNCTION public.mark_conversation_unread(
  p_conversation_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert or update user state to mark as unread
  INSERT INTO public.conversation_user_state (conversation_id, user_id, is_favorite, is_read, updated_at)
  VALUES (p_conversation_id, p_user_id, false, false, now())
  ON CONFLICT (conversation_id, user_id) 
  DO UPDATE SET 
    is_read = false,
    updated_at = now();
END;
$$;

-- =====================================================
-- NOTE: Do NOT drop is_favorite and is_read columns yet
-- =====================================================
-- 
-- Keep the old columns for now to ensure backward compatibility
-- After verifying the new system works, we can:
-- 1. Stop writing to old columns
-- 2. Eventually drop them in a future migration
-- 
-- For now, the backend will use conversation_user_state exclusively
-- =====================================================


