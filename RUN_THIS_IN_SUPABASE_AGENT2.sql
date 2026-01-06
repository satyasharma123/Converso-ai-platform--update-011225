-- ============================================================================
-- AGENT 2: LEAD ACTION AGENT - DATABASE MIGRATION
-- ============================================================================
-- Purpose: Add fields to support Agent 2 (Lead Action Agent) manual override tracking
-- Date: January 7, 2026
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Step 1: Update agent_configurations constraint to include 'lead_action'
-- ============================================================================

ALTER TABLE public.agent_configurations 
DROP CONSTRAINT IF EXISTS agent_configurations_agent_type_check;

ALTER TABLE public.agent_configurations 
ADD CONSTRAINT agent_configurations_agent_type_check 
CHECK (agent_type IN (
  'intent_detection',
  'response_generation', 
  'reply_generation',
  'lead_action',
  'lead_scoring',
  'auto_assignment'
));

-- Step 2: Add new columns to conversations table
-- ============================================================================

-- Add manually_tagged field to track manual vs AI tagging
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS manually_tagged BOOLEAN DEFAULT false;

-- Add manually_staged field to track manual vs AI pipeline updates
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS manually_staged BOOLEAN DEFAULT false;

-- Add lead_tags array field if it doesn't exist
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS lead_tags TEXT[];

-- Step 3: Create index for lead_tags for faster filtering
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_conversations_lead_tags 
ON public.conversations USING GIN (lead_tags);

-- Step 4: Add column comments
-- ============================================================================

COMMENT ON COLUMN public.conversations.manually_tagged IS 'True if user manually applied tags, prevents AI override';
COMMENT ON COLUMN public.conversations.manually_staged IS 'True if user manually set pipeline stage, prevents AI override';
COMMENT ON COLUMN public.conversations.lead_tags IS 'Array of lead tags: meeting_requested, info_requested, lead';

-- Step 5: Create default Agent 2 configuration for all workspaces
-- ============================================================================

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
  3
FROM public.workspaces
ON CONFLICT (workspace_id, agent_type) DO NOTHING;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify constraint was updated
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname = 'agent_configurations_agent_type_check';

-- Verify new columns exist
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'conversations'
  AND column_name IN ('manually_tagged', 'manually_staged', 'lead_tags')
ORDER BY column_name;

-- Verify index was created
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'conversations'
  AND indexname = 'idx_conversations_lead_tags';

-- Verify Agent 2 configurations were created
SELECT 
  w.name AS workspace_name,
  ac.agent_name,
  ac.is_enabled,
  ac.config_data,
  ac.priority
FROM agent_configurations ac
JOIN workspaces w ON w.id = ac.workspace_id
WHERE ac.agent_type = 'lead_action'
ORDER BY w.name;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Agent 2 (Lead Action Agent) migration completed successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Enable Agent 2 for your workspace:';
  RAISE NOTICE '   UPDATE agent_configurations SET is_enabled = true WHERE agent_type = ''lead_action'';';
  RAISE NOTICE '';
  RAISE NOTICE '2. Test with curl:';
  RAISE NOTICE '   curl -X PUT http://localhost:3001/api/agents/config/WORKSPACE_ID/lead_action/toggle';
  RAISE NOTICE '';
  RAISE NOTICE '3. Verify in console logs when new messages arrive';
END $$;

