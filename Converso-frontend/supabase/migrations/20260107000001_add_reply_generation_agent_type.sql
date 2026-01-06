-- Add 'reply_generation' to the agent_type check constraint
-- Migration: 20260107000001_add_reply_generation_agent_type.sql
-- Purpose: Update the CHECK constraint to allow 'reply_generation' as a valid agent type
-- This must run BEFORE the agent 3 configuration migration

-- Drop the existing constraint
ALTER TABLE public.agent_configurations 
DROP CONSTRAINT IF EXISTS agent_configurations_agent_type_check;

-- Add the updated constraint with 'reply_generation' included
ALTER TABLE public.agent_configurations 
ADD CONSTRAINT agent_configurations_agent_type_check 
CHECK (agent_type IN (
  'intent_detection',
  'response_generation', 
  'reply_generation',
  'lead_scoring',
  'auto_assignment'
));

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT agent_configurations_agent_type_check ON public.agent_configurations 
IS 'Ensures agent_type is one of the supported agent types: intent_detection, response_generation, reply_generation, lead_scoring, auto_assignment';

