/**
 * API Layer: Agent Configurations
 * Database queries for workspace AI agent settings
 */

import { supabaseAdmin } from '../lib/supabase';
import { AgentConfiguration } from '../types';

/**
 * Get agent configuration for a workspace
 */
export async function getAgentConfiguration(
  workspaceId: string,
  agentType: AgentConfiguration['agent_type']
): Promise<AgentConfiguration | null> {
  const { data, error } = await supabaseAdmin
    .from('agent_configurations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('agent_type', agentType)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching agent configuration:', error);
    throw error;
  }

  return data || null;
}

/**
 * Get all agent configurations for a workspace
 */
export async function getWorkspaceAgentConfigurations(
  workspaceId: string
): Promise<AgentConfiguration[]> {
  const { data, error } = await supabaseAdmin
    .from('agent_configurations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('priority', { ascending: false });

  if (error) {
    console.error('Error fetching workspace agent configurations:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get all enabled agent configurations for a workspace
 */
export async function getEnabledAgentConfigurations(
  workspaceId: string
): Promise<AgentConfiguration[]> {
  const { data, error } = await supabaseAdmin
    .from('agent_configurations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('is_enabled', true)
    .order('priority', { ascending: false });

  if (error) {
    console.error('Error fetching enabled agent configurations:', error);
    throw error;
  }

  return data || [];
}

/**
 * Update agent configuration
 */
export async function updateAgentConfiguration(
  configId: string,
  updates: Partial<Omit<AgentConfiguration, 'id' | 'workspace_id' | 'agent_type' | 'created_at'>>
): Promise<AgentConfiguration> {
  const { data, error } = await supabaseAdmin
    .from('agent_configurations')
    .update(updates)
    .eq('id', configId)
    .select()
    .single();

  if (error) {
    console.error('Error updating agent configuration:', error);
    throw error;
  }

  return data;
}

/**
 * Toggle agent enabled status
 */
export async function toggleAgentEnabled(
  workspaceId: string,
  agentType: AgentConfiguration['agent_type'],
  isEnabled: boolean
): Promise<AgentConfiguration> {
  const { data, error } = await supabaseAdmin
    .from('agent_configurations')
    .update({ is_enabled: isEnabled })
    .eq('workspace_id', workspaceId)
    .eq('agent_type', agentType)
    .select()
    .single();

  if (error) {
    console.error('Error toggling agent enabled status:', error);
    throw error;
  }

  return data;
}

/**
 * Update agent config data
 */
export async function updateAgentConfigData(
  workspaceId: string,
  agentType: AgentConfiguration['agent_type'],
  configData: Record<string, any>
): Promise<AgentConfiguration> {
  const { data, error } = await supabaseAdmin
    .from('agent_configurations')
    .update({ config_data: configData })
    .eq('workspace_id', workspaceId)
    .eq('agent_type', agentType)
    .select()
    .single();

  if (error) {
    console.error('Error updating agent config data:', error);
    throw error;
  }

  return data;
}

/**
 * Create agent configuration (for new workspaces)
 */
export async function createAgentConfiguration(
  config: Omit<AgentConfiguration, 'id' | 'created_at' | 'updated_at'>
): Promise<AgentConfiguration> {
  const { data, error } = await supabaseAdmin
    .from('agent_configurations')
    .insert(config)
    .select()
    .single();

  if (error) {
    console.error('Error creating agent configuration:', error);
    throw error;
  }

  return data;
}

