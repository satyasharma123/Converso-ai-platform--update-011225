-- ============================================
-- SDRXS PHASE 2: SDR Write Permissions + Stage Movement
-- ============================================
-- This migration implements:
-- 1. conversation_activities table for audit logging
-- 2. SDR safe update trigger that restricts field modifications
-- 3. Automatic activity logging for stage changes and lead updates
--
-- IMPORTANT: This does NOT modify sync logic or inbox queries

-- ============================================
-- TASK 1: Create conversation_activities table
-- ============================================

CREATE TABLE IF NOT EXISTS public.conversation_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  actor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversation_activities_conversation_id 
  ON public.conversation_activities(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_activities_workspace_id 
  ON public.conversation_activities(workspace_id);
CREATE INDEX IF NOT EXISTS idx_conversation_activities_created_at 
  ON public.conversation_activities(created_at DESC);

-- Enable RLS
ALTER TABLE public.conversation_activities ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies for conversation_activities
-- ============================================

-- Policy 1: Admins can view all activities in their workspace
CREATE POLICY "Admins can view workspace activities"
  ON public.conversation_activities FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND workspace_id = public.get_user_workspace_id(auth.uid())
  );

-- Policy 2: SDRs can view activities for their assigned conversations
CREATE POLICY "SDRs can view activities for assigned conversations"
  ON public.conversation_activities FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'sdr')
    AND EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = conversation_activities.conversation_id
        AND conversations.assigned_to = auth.uid()
        AND conversations.workspace_id = public.get_user_workspace_id(auth.uid())
    )
  );

-- Policy 3: SDRs can insert activities for their assigned conversations
CREATE POLICY "SDRs can insert activities for assigned conversations"
  ON public.conversation_activities FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'sdr')
    AND actor_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = conversation_id
        AND conversations.assigned_to = auth.uid()
        AND conversations.workspace_id = public.get_user_workspace_id(auth.uid())
    )
  );

-- Policy 4: Admins can manage all activities in their workspace
CREATE POLICY "Admins can manage workspace activities"
  ON public.conversation_activities FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND workspace_id = public.get_user_workspace_id(auth.uid())
  );

-- ============================================
-- TASK 2: SDR Safe Update Trigger Function
-- ============================================

CREATE OR REPLACE FUNCTION public.enforce_sdr_update_restrictions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_sdr BOOLEAN;
  user_workspace_id UUID;
  old_stage_id UUID;
  new_stage_id UUID;
  field_changes JSONB := '{}'::jsonb;
BEGIN
  -- Check if user is an SDR
  is_sdr := public.has_role(auth.uid(), 'sdr');
  
  -- If not an SDR, allow all updates (admins, service_role, etc.)
  IF NOT is_sdr THEN
    RETURN NEW;
  END IF;

  -- Get user's workspace
  user_workspace_id := public.get_user_workspace_id(auth.uid());

  -- SECURITY CHECK 1: Ensure conversation is assigned to this SDR
  IF OLD.assigned_to IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'SDR can only update conversations assigned to them'
      USING ERRCODE = 'P0001';
  END IF;

  -- SECURITY CHECK 2: Ensure workspace matches
  IF OLD.workspace_id IS DISTINCT FROM user_workspace_id THEN
    RAISE EXCEPTION 'SDR can only update conversations in their workspace'
      USING ERRCODE = 'P0001';
  END IF;

  -- ALLOWED FIELDS for SDR updates:
  -- Lead intelligence: sender_name, sender_email, sender_linkedin_url, company_name, location, mobile
  -- Pipeline: custom_stage_id, stage_assigned_at

  -- Check for unauthorized field changes
  IF OLD.id IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'SDR is not allowed to modify field: id' USING ERRCODE = 'P0001';
  END IF;

  IF OLD.conversation_type IS DISTINCT FROM NEW.conversation_type THEN
    RAISE EXCEPTION 'SDR is not allowed to modify field: conversation_type' USING ERRCODE = 'P0001';
  END IF;

  IF OLD.subject IS DISTINCT FROM NEW.subject THEN
    RAISE EXCEPTION 'SDR is not allowed to modify field: subject' USING ERRCODE = 'P0001';
  END IF;

  IF OLD.preview IS DISTINCT FROM NEW.preview THEN
    RAISE EXCEPTION 'SDR is not allowed to modify field: preview' USING ERRCODE = 'P0001';
  END IF;

  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    RAISE EXCEPTION 'SDR is not allowed to modify field: assigned_to' USING ERRCODE = 'P0001';
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    RAISE EXCEPTION 'SDR is not allowed to modify field: status' USING ERRCODE = 'P0001';
  END IF;

  IF OLD.is_read IS DISTINCT FROM NEW.is_read THEN
    RAISE EXCEPTION 'SDR is not allowed to modify field: is_read' USING ERRCODE = 'P0001';
  END IF;

  IF OLD.last_message_at IS DISTINCT FROM NEW.last_message_at THEN
    RAISE EXCEPTION 'SDR is not allowed to modify field: last_message_at' USING ERRCODE = 'P0001';
  END IF;

  IF OLD.workspace_id IS DISTINCT FROM NEW.workspace_id THEN
    RAISE EXCEPTION 'SDR is not allowed to modify field: workspace_id' USING ERRCODE = 'P0001';
  END IF;

  IF OLD.gmail_message_id IS DISTINCT FROM NEW.gmail_message_id THEN
    RAISE EXCEPTION 'SDR is not allowed to modify field: gmail_message_id' USING ERRCODE = 'P0001';
  END IF;

  IF OLD.gmail_thread_id IS DISTINCT FROM NEW.gmail_thread_id THEN
    RAISE EXCEPTION 'SDR is not allowed to modify field: gmail_thread_id' USING ERRCODE = 'P0001';
  END IF;

  IF OLD.email_timestamp IS DISTINCT FROM NEW.email_timestamp THEN
    RAISE EXCEPTION 'SDR is not allowed to modify field: email_timestamp' USING ERRCODE = 'P0001';
  END IF;

  IF OLD.has_full_body IS DISTINCT FROM NEW.has_full_body THEN
    RAISE EXCEPTION 'SDR is not allowed to modify field: has_full_body' USING ERRCODE = 'P0001';
  END IF;

  IF OLD.is_favorite IS DISTINCT FROM NEW.is_favorite THEN
    RAISE EXCEPTION 'SDR is not allowed to modify field: is_favorite' USING ERRCODE = 'P0001';
  END IF;

  IF OLD.unread_count IS DISTINCT FROM NEW.unread_count THEN
    RAISE EXCEPTION 'SDR is not allowed to modify field: unread_count' USING ERRCODE = 'P0001';
  END IF;

  IF OLD.last_message_from_lead IS DISTINCT FROM NEW.last_message_from_lead THEN
    RAISE EXCEPTION 'SDR is not allowed to modify field: last_message_from_lead' USING ERRCODE = 'P0001';
  END IF;

  IF OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'SDR is not allowed to modify field: created_at' USING ERRCODE = 'P0001';
  END IF;

  -- Track allowed field changes for activity logging
  
  -- Lead intelligence fields
  IF OLD.sender_name IS DISTINCT FROM NEW.sender_name THEN
    field_changes := jsonb_set(field_changes, '{sender_name}', 
      jsonb_build_object('old', OLD.sender_name, 'new', NEW.sender_name));
  END IF;

  IF OLD.sender_email IS DISTINCT FROM NEW.sender_email THEN
    field_changes := jsonb_set(field_changes, '{sender_email}', 
      jsonb_build_object('old', OLD.sender_email, 'new', NEW.sender_email));
  END IF;

  IF OLD.sender_linkedin_url IS DISTINCT FROM NEW.sender_linkedin_url THEN
    field_changes := jsonb_set(field_changes, '{sender_linkedin_url}', 
      jsonb_build_object('old', OLD.sender_linkedin_url, 'new', NEW.sender_linkedin_url));
  END IF;

  IF OLD.company_name IS DISTINCT FROM NEW.company_name THEN
    field_changes := jsonb_set(field_changes, '{company_name}', 
      jsonb_build_object('old', OLD.company_name, 'new', NEW.company_name));
  END IF;

  IF OLD.location IS DISTINCT FROM NEW.location THEN
    field_changes := jsonb_set(field_changes, '{location}', 
      jsonb_build_object('old', OLD.location, 'new', NEW.location));
  END IF;

  IF OLD.mobile IS DISTINCT FROM NEW.mobile THEN
    field_changes := jsonb_set(field_changes, '{mobile}', 
      jsonb_build_object('old', OLD.mobile, 'new', NEW.mobile));
  END IF;

  -- Log lead intelligence updates
  IF field_changes != '{}'::jsonb THEN
    INSERT INTO public.conversation_activities (
      workspace_id,
      conversation_id,
      actor_user_id,
      activity_type,
      meta
    ) VALUES (
      NEW.workspace_id,
      NEW.id,
      auth.uid(),
      'lead_updated',
      field_changes
    );
  END IF;

  -- Log stage changes
  IF OLD.custom_stage_id IS DISTINCT FROM NEW.custom_stage_id THEN
    INSERT INTO public.conversation_activities (
      workspace_id,
      conversation_id,
      actor_user_id,
      activity_type,
      meta
    ) VALUES (
      NEW.workspace_id,
      NEW.id,
      auth.uid(),
      'stage_changed',
      jsonb_build_object(
        'from_stage', OLD.custom_stage_id,
        'to_stage', NEW.custom_stage_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_sdr_update_restrictions() IS 
'SDRXS Phase 2: Enforces SDR update restrictions and logs activities. SDRs can only update: sender_name, sender_email, sender_linkedin_url, company_name, location, mobile, custom_stage_id, stage_assigned_at';

-- ============================================
-- Create Trigger
-- ============================================

DROP TRIGGER IF EXISTS enforce_sdr_updates ON public.conversations;

CREATE TRIGGER enforce_sdr_updates
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_sdr_update_restrictions();

COMMENT ON TRIGGER enforce_sdr_updates ON public.conversations IS 
'SDRXS Phase 2: Enforces field-level restrictions for SDR updates and logs all changes to conversation_activities';

-- ============================================
-- Add UPDATE policy for SDRs
-- ============================================

-- Note: The existing "SDRs can update assigned conversations" policy allows UPDATE
-- but the trigger enforces field-level restrictions

-- Verify the policy exists (it should from the initial migration)
-- If not, create it:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'conversations' 
    AND policyname = 'SDRs can update assigned conversations'
  ) THEN
    CREATE POLICY "SDRs can update assigned conversations"
      ON public.conversations FOR UPDATE
      TO authenticated
      USING (assigned_to = auth.uid());
  END IF;
END $$;

-- ============================================
-- Documentation Comments
-- ============================================

COMMENT ON TABLE public.conversation_activities IS 
'SDRXS Phase 2: Audit log for conversation changes. Tracks stage changes and lead intelligence updates.';

COMMENT ON COLUMN public.conversation_activities.activity_type IS 
'Activity type: stage_changed, lead_updated, or other activity types';

COMMENT ON COLUMN public.conversation_activities.meta IS 
'Activity metadata in JSONB format. For stage_changed: {from_stage, to_stage}. For lead_updated: {field_name: {old, new}}';
