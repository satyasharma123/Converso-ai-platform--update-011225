-- Create default Reply Generation (Agent 3) configuration for all workspaces
-- Migration: 20260107000002_create_agent3_reply_generation_config.sql
-- Purpose: Initialize Agent 3 settings with safe defaults

-- Insert default Reply Generation configuration for all existing workspaces
INSERT INTO public.agent_configurations (workspace_id, agent_type, agent_name, is_enabled, config_data, priority)
SELECT 
  id,
  'reply_generation',
  'Reply Generation Agent',
  false, -- Disabled by default until configured by admin
  '{
    "mode": "draft_only",
    "allow_sdr_access": false,
    "required_tags": ["meeting_requested", "info_requested"],
    "safety_rules": {
      "no_commitments": true,
      "no_pricing": true,
      "no_calendar_links": true,
      "no_legal_medical_financial": true
    },
    "tone": "professional",
    "max_draft_length": 1000,
    "include_signature": true
  }'::jsonb,
  2 -- Priority 2 (after intent detection)
FROM public.workspaces
ON CONFLICT (workspace_id, agent_type) DO NOTHING;

-- Add comment explaining the configuration
COMMENT ON COLUMN public.agent_configurations.config_data IS 'JSON configuration for agent behavior. For reply_generation: mode (draft_only|auto_send), allow_sdr_access, required_tags, safety_rules, tone, max_draft_length, include_signature';

