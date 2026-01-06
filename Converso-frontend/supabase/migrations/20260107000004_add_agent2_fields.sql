-- Add fields to support Agent 2 (Lead Action Agent) manual override tracking
-- Migration: 20260107000004_add_agent2_fields.sql
-- Purpose: Add columns for lead tags and manual override tracking

-- Add manually_tagged field to track manual vs AI tagging
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS manually_tagged BOOLEAN DEFAULT false;

-- Add manually_staged field to track manual vs AI pipeline updates
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS manually_staged BOOLEAN DEFAULT false;

-- Add lead_tags array field if it doesn't exist
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS lead_tags TEXT[];

-- Create index for lead_tags for faster filtering
CREATE INDEX IF NOT EXISTS idx_conversations_lead_tags 
ON public.conversations USING GIN (lead_tags);

-- Comment the columns
COMMENT ON COLUMN public.conversations.manually_tagged IS 'True if user manually applied tags, prevents AI override';
COMMENT ON COLUMN public.conversations.manually_staged IS 'True if user manually set pipeline stage, prevents AI override';
COMMENT ON COLUMN public.conversations.lead_tags IS 'Array of lead tags: meeting_requested, info_requested, lead';

-- Create default Agent 2 configuration for all workspaces
INSERT INTO public.agent_configurations (workspace_id, agent_type, agent_name, is_enabled, config_data, priority)
SELECT 
  id,
  'lead_action',
  'Lead Action Agent',
  false, -- Disabled by default until configured
  '{
    "auto_tag_enabled": true,
    "auto_stage_enabled": true,
    "respect_manual_override": true,
    "tag_confidence_threshold": 0.7
  }'::jsonb,
  3 -- Priority 3 (after intent detection and reply generation)
FROM public.workspaces
ON CONFLICT (workspace_id, agent_type) DO NOTHING;

