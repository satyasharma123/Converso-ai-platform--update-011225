-- ============================================================================
-- AI AGENT SYSTEM: CORE TABLES
-- ============================================================================
-- Purpose: Create all missing tables for AI Agent System (Agent 1, 2, 3)
-- Date: January 7, 2026
-- CRITICAL: Run this BEFORE using /api/conversations/with-intents endpoint
-- ============================================================================

-- ============================================================================
-- TABLE 1: conversation_intents (Agent 1 - Intent Detection)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.conversation_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,

  -- Intent Detection Results
  primary_intent TEXT NOT NULL CHECK (primary_intent IN (
    'pricing_inquiry',
    'demo_request',
    'support_question',
    'meeting_request',
    'objection',
    'follow_up',
    'interested',
    'not_interested',
    'other'
  )),
  secondary_intents TEXT[],
  confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),

  -- Metadata
  intent_metadata JSONB,
  detected_keywords TEXT[],
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed')),

  -- Agent Info
  detected_by TEXT DEFAULT 'gpt-4o-mini',
  model_version TEXT,

  -- Timestamps
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for conversation_intents
CREATE INDEX IF NOT EXISTS idx_conversation_intents_conversation
ON public.conversation_intents(conversation_id);

CREATE INDEX IF NOT EXISTS idx_conversation_intents_workspace
ON public.conversation_intents(workspace_id);

CREATE INDEX IF NOT EXISTS idx_conversation_intents_primary_intent
ON public.conversation_intents(primary_intent);

CREATE INDEX IF NOT EXISTS idx_conversation_intents_detected_at
ON public.conversation_intents(detected_at DESC);

-- RLS for conversation_intents
ALTER TABLE public.conversation_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversation_intents_admin_select"
ON public.conversation_intents
FOR SELECT USING (
  has_role(auth.uid(), 'admin')
);

CREATE POLICY "conversation_intents_sdr_select"
ON public.conversation_intents
FOR SELECT USING (
  has_role(auth.uid(), 'sdr')
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id
    AND c.assigned_to = auth.uid()
  )
);

-- ============================================================================
-- TABLE 2: agent_actions (Agent Action Logs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,

  -- Agent Info
  agent_type TEXT NOT NULL CHECK (agent_type IN (
    'intent_detection',
    'response_generation',
    'reply_generation',
    'lead_action',
    'lead_scoring',
    'auto_assignment'
  )),
  agent_version TEXT,

  -- Action Details
  action_type TEXT NOT NULL,
  action_description TEXT,
  action_data JSONB,

  -- Execution Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'processing',
    'completed',
    'failed',
    'skipped'
  )),
  error_message TEXT,

  -- Performance
  execution_time_ms INTEGER,

  -- Timestamps
  triggered_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for agent_actions
CREATE INDEX IF NOT EXISTS idx_agent_actions_conversation
ON public.agent_actions(conversation_id);

CREATE INDEX IF NOT EXISTS idx_agent_actions_workspace
ON public.agent_actions(workspace_id);

CREATE INDEX IF NOT EXISTS idx_agent_actions_agent_type
ON public.agent_actions(agent_type);

CREATE INDEX IF NOT EXISTS idx_agent_actions_created_at
ON public.agent_actions(created_at DESC);

-- RLS for agent_actions
ALTER TABLE public.agent_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_actions_admin_all"
ON public.agent_actions
FOR ALL USING (
  has_role(auth.uid(), 'admin')
);

-- ============================================================================
-- TABLE 3: agent_configurations (Workspace Agent Settings)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.agent_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,

  -- Agent Details
  agent_type TEXT NOT NULL CHECK (agent_type IN (
    'intent_detection',
    'response_generation',
    'reply_generation',
    'lead_action',
    'lead_scoring',
    'auto_assignment'
  )),
  agent_name TEXT NOT NULL,

  -- Configuration
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  config_data JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Priority
  priority INTEGER DEFAULT 100,

  -- Trigger Conditions
  trigger_conditions JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint
  UNIQUE(workspace_id, agent_type)
);

-- Indexes for agent_configurations
CREATE INDEX IF NOT EXISTS idx_agent_configurations_workspace
ON public.agent_configurations(workspace_id);

CREATE INDEX IF NOT EXISTS idx_agent_configurations_enabled
ON public.agent_configurations(is_enabled)
WHERE is_enabled = true;

-- RLS for agent_configurations
ALTER TABLE public.agent_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_configurations_admin_all"
ON public.agent_configurations
FOR ALL USING (
  has_role(auth.uid(), 'admin')
);

-- ============================================================================
-- DEFAULT CONFIGURATIONS: Create for all existing workspaces
-- ============================================================================

-- Agent 1: Intent Detection (Disabled by default)
INSERT INTO public.agent_configurations (workspace_id, agent_type, agent_name, is_enabled, config_data, priority)
SELECT
  id,
  'intent_detection',
  'Intent Detection Agent',
  false,
  '{
    "confidence_threshold": 0.7,
    "enable_sentiment_analysis": true,
    "detect_urgency": true,
    "intent_categories": ["pricing_inquiry", "demo_request", "meeting_request", "interested", "follow_up"],
    "model": "gpt-4o-mini"
  }'::jsonb,
  1
FROM public.workspaces
ON CONFLICT (workspace_id, agent_type) DO NOTHING;

-- Agent 2: Lead Action (Disabled by default)
INSERT INTO public.agent_configurations (workspace_id, agent_type, agent_name, is_enabled, config_data, priority)
SELECT
  id,
  'lead_action',
  'Lead Action Agent',
  false,
  '{
    "auto_tag_enabled": true,
    "auto_stage_enabled": true,
    "respect_manual_override": true,
    "tag_confidence_threshold": 0.7
  }'::jsonb,
  2
FROM public.workspaces
ON CONFLICT (workspace_id, agent_type) DO NOTHING;

-- Agent 3: Reply Generation (Disabled by default)
INSERT INTO public.agent_configurations (workspace_id, agent_type, agent_name, is_enabled, config_data, priority)
SELECT
  id,
  'reply_generation',
  'Reply Generation Agent',
  false,
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
    "max_draft_length": 500,
    "include_signature": true
  }'::jsonb,
  3
FROM public.workspaces
ON CONFLICT (workspace_id, agent_type) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE public.conversation_intents IS 'AI-detected intents for conversations (Agent 1)';
COMMENT ON TABLE public.agent_actions IS 'Log of all AI agent actions taken';
COMMENT ON TABLE public.agent_configurations IS 'Workspace-specific AI agent settings';

COMMENT ON COLUMN public.conversation_intents.primary_intent IS 'Primary detected intent category';
COMMENT ON COLUMN public.conversation_intents.confidence_score IS 'AI confidence score (0.0 to 1.0)';
COMMENT ON COLUMN public.agent_configurations.config_data IS 'JSON configuration for the agent';
COMMENT ON COLUMN public.agent_configurations.is_enabled IS 'Whether this agent is active for the workspace';
