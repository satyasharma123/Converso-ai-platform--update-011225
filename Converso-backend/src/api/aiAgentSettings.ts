import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../utils/logger';
import { resolveActiveWorkspace } from '../utils/resolveWorkspace';

export interface AIAgentSettings {
  id: string;
  workspace_id: string;
  agents_enabled: boolean;
  agent1_enabled: boolean;
  agent1_channels: string[];
  agent1_min_confidence: number;
  agent2_enabled: boolean;
  agent2_channels: string[];
  agent3_enabled: boolean;
  agent3_channels: string[];
  agent3_mode: 'off' | 'draft' | 'assisted' | 'auto';
  allow_sdr_manage_agents: boolean;
  allow_sdr_manage_agent3: boolean;
  created_at: string;
  updated_at: string;
}

export interface AIAgentSettingsUpdate {
  agents_enabled?: boolean;
  agent1_enabled?: boolean;
  agent1_channels?: string[];
  agent1_min_confidence?: number;
  agent2_enabled?: boolean;
  agent2_channels?: string[];
  agent3_enabled?: boolean;
  agent3_channels?: string[];
  agent3_mode?: 'off' | 'draft' | 'assisted' | 'auto';
  allow_sdr_manage_agents?: boolean;
  allow_sdr_manage_agent3?: boolean;
}

/**
 * Get AI Agent Settings for a workspace
 * Creates default row if it doesn't exist
 */
export async function getAIAgentSettings(userId: string): Promise<AIAgentSettings> {
  // Resolve workspace
  const { workspaceId } = await resolveActiveWorkspace({ userId });

  // Try to get existing settings
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('ai_agent_settings')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (fetchError && fetchError.code !== 'PGRST116') {
    // PGRST116 = no rows returned (expected if not exists)
    logger.error('[AI Agent Settings] Error fetching settings:', fetchError);
    throw fetchError;
  }

  // If exists, return it
  if (existing) {
    return existing as AIAgentSettings;
  }

  // Create default row
  const defaultSettings: Partial<AIAgentSettings> = {
    workspace_id: workspaceId,
    agents_enabled: false,
    agent1_enabled: false,
    agent1_channels: ['email', 'linkedin'],
    agent1_min_confidence: 0.80,
    agent2_enabled: false,
    agent2_channels: ['email', 'linkedin'],
    agent3_enabled: false,
    agent3_channels: ['email'],
    agent3_mode: 'draft',
    allow_sdr_manage_agents: false,
    allow_sdr_manage_agent3: false,
  };

  const { data: newSettings, error: insertError } = await supabaseAdmin
    .from('ai_agent_settings')
    .insert(defaultSettings)
    .select()
    .single();

  if (insertError) {
    logger.error('[AI Agent Settings] Error creating default settings:', insertError);
    throw insertError;
  }

  logger.info(`[AI Agent Settings] Created default settings for workspace ${workspaceId}`);
  return newSettings as AIAgentSettings;
}

/**
 * Update AI Agent Settings
 * Validates input and performs partial update
 */
export async function updateAIAgentSettings(
  userId: string,
  payload: AIAgentSettingsUpdate
): Promise<AIAgentSettings> {
  // Resolve workspace
  const { workspaceId } = await resolveActiveWorkspace({ userId });

  // Validate agent3_mode
  if (payload.agent3_mode !== undefined) {
    if (!['off', 'draft', 'assisted', 'auto'].includes(payload.agent3_mode)) {
      throw new Error('Invalid agent3_mode. Must be one of: off, draft, assisted, auto');
    }
  }

  // Validate channels (must be subset of allowed channels)
  const allowedChannels = ['email', 'linkedin'];
  if (payload.agent1_channels !== undefined) {
    if (!Array.isArray(payload.agent1_channels) || 
        !payload.agent1_channels.every(ch => allowedChannels.includes(ch))) {
      throw new Error('Invalid agent1_channels. Must be array of: email, linkedin');
    }
  }
  if (payload.agent2_channels !== undefined) {
    if (!Array.isArray(payload.agent2_channels) || 
        !payload.agent2_channels.every(ch => allowedChannels.includes(ch))) {
      throw new Error('Invalid agent2_channels. Must be array of: email, linkedin');
    }
  }
  if (payload.agent3_channels !== undefined) {
    if (!Array.isArray(payload.agent3_channels) || 
        !payload.agent3_channels.every(ch => allowedChannels.includes(ch))) {
      throw new Error('Invalid agent3_channels. Must be array of: email, linkedin');
    }
  }

  // Validate confidence threshold
  if (payload.agent1_min_confidence !== undefined) {
    if (typeof payload.agent1_min_confidence !== 'number' ||
        payload.agent1_min_confidence < 0.5 ||
        payload.agent1_min_confidence > 0.95) {
      throw new Error('Invalid agent1_min_confidence. Must be between 0.5 and 0.95');
    }
  }

  // Check if row exists first
  const { data: existing, error: checkError } = await supabaseAdmin
    .from('ai_agent_settings')
    .select('id')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (checkError && checkError.code !== 'PGRST116') {
    logger.error('[AI Agent Settings] Error checking existing settings:', checkError);
    throw checkError;
  }

  // Prepare update payload
  const updateData: Partial<AIAgentSettings> = {
    ...payload,
    updated_at: new Date().toISOString(),
  };

  let result: AIAgentSettings;

  if (existing) {
    // Update existing row
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('ai_agent_settings')
      .update(updateData)
      .eq('workspace_id', workspaceId)
      .select()
      .single();

    if (updateError) {
      logger.error('[AI Agent Settings] Error updating settings:', updateError);
      throw updateError;
    }

    result = updated as AIAgentSettings;
    logger.info(`[AI Agent Settings] Updated settings for workspace ${workspaceId}`);
  } else {
    // Create new row with defaults + updates
    const defaultSettings: Partial<AIAgentSettings> = {
      workspace_id: workspaceId,
      agents_enabled: false,
      agent1_enabled: false,
      agent1_channels: ['email', 'linkedin'],
      agent1_min_confidence: 0.80,
      agent2_enabled: false,
      agent2_channels: ['email', 'linkedin'],
      agent3_enabled: false,
      agent3_channels: ['email'],
      agent3_mode: 'draft',
      allow_sdr_manage_agents: false,
      allow_sdr_manage_agent3: false,
      ...updateData,
    };

    const { data: newSettings, error: insertError } = await supabaseAdmin
      .from('ai_agent_settings')
      .insert(defaultSettings)
      .select()
      .single();

    if (insertError) {
      logger.error('[AI Agent Settings] Error creating settings:', insertError);
      throw insertError;
    }

    result = newSettings as AIAgentSettings;
    logger.info(`[AI Agent Settings] Created settings for workspace ${workspaceId}`);
  }

  return result;
}

