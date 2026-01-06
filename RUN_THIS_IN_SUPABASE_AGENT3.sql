-- ============================================================================
-- FIX AGENT 3 MIGRATION - RUN THIS IN SUPABASE SQL EDITOR
-- ============================================================================
-- Purpose: Fix the agent_type constraint and create Agent 3 configuration
-- Safe to run: Uses IF EXISTS and ON CONFLICT DO NOTHING
-- ============================================================================

-- STEP 1: Update the constraint to allow 'reply_generation'
-- ----------------------------------------------------------------------------
ALTER TABLE public.agent_configurations 
DROP CONSTRAINT IF EXISTS agent_configurations_agent_type_check;

ALTER TABLE public.agent_configurations 
ADD CONSTRAINT agent_configurations_agent_type_check 
CHECK (agent_type IN (
  'intent_detection',
  'response_generation', 
  'reply_generation',
  'lead_scoring',
  'auto_assignment'
));

-- Expected: Success. No rows returned
-- ============================================================================

-- STEP 2: Create Agent 3 configuration for all workspaces
-- ----------------------------------------------------------------------------
INSERT INTO public.agent_configurations (workspace_id, agent_type, agent_name, is_enabled, config_data, priority)
SELECT 
  id,
  'reply_generation',
  'Reply Generation Agent',
  false, -- Disabled by default until configured
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

-- Expected: Success. X rows inserted (where X = number of workspaces)
-- ============================================================================

-- STEP 3: Verify the fix
-- ----------------------------------------------------------------------------
-- Check constraint
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'agent_configurations_agent_type_check';

-- Check configurations
SELECT 
  workspace_id,
  agent_type,
  agent_name,
  is_enabled,
  config_data->>'mode' as mode,
  config_data->>'allow_sdr_access' as allow_sdr_access,
  created_at
FROM agent_configurations 
WHERE agent_type = 'reply_generation'
ORDER BY created_at DESC;

-- Expected: Should show rows for each workspace with Agent 3 config
-- ============================================================================

-- ✅ DONE! Agent 3 is now ready to use.
-- 
-- Next steps:
-- 1. Enable Agent 3 via API: PUT /api/agents/config/{workspace_id}/reply_generation/toggle
-- 2. Test reply generation: POST /api/agents/generate-reply
-- 3. Run test script: ./test-agent3-reply-generation.sh

