/**
 * API Layer: Agent Actions
 * Database queries for AI agent action logs
 */

import { supabaseAdmin } from '../lib/supabase';
import { AgentAction, CreateAgentActionRequest } from '../types';

/**
 * Create a new agent action log
 */
export async function createAgentAction(
  request: CreateAgentActionRequest
): Promise<AgentAction> {
  const { data, error } = await supabaseAdmin
    .from('agent_actions')
    .insert({
      conversation_id: request.conversation_id,
      workspace_id: request.workspace_id,
      agent_type: request.agent_type,
      action_type: request.action_type,
      action_description: request.action_description || null,
      action_data: request.action_data || {},
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating agent action:', error);
    throw error;
  }

  return data;
}

/**
 * Update agent action status
 */
export async function updateAgentActionStatus(
  actionId: string,
  status: AgentAction['status'],
  errorMessage?: string,
  executionTimeMs?: number
): Promise<AgentAction> {
  const updateData: any = {
    status,
    completed_at: status === 'completed' || status === 'failed' ? new Date().toISOString() : null,
  };

  if (status === 'processing' && !updateData.executed_at) {
    updateData.executed_at = new Date().toISOString();
  }

  if (errorMessage) {
    updateData.error_message = errorMessage;
  }

  if (executionTimeMs !== undefined) {
    updateData.execution_time_ms = executionTimeMs;
  }

  const { data, error } = await supabaseAdmin
    .from('agent_actions')
    .update(updateData)
    .eq('id', actionId)
    .select()
    .single();

  if (error) {
    console.error('Error updating agent action status:', error);
    throw error;
  }

  return data;
}

/**
 * Get all actions for a conversation
 */
export async function getConversationActions(
  conversationId: string
): Promise<AgentAction[]> {
  const { data, error } = await supabaseAdmin
    .from('agent_actions')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('triggered_at', { ascending: false });

  if (error) {
    console.error('Error fetching conversation actions:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get all actions for a workspace
 */
export async function getWorkspaceActions(
  workspaceId: string,
  limit = 100
): Promise<AgentAction[]> {
  const { data, error } = await supabaseAdmin
    .from('agent_actions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('triggered_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching workspace actions:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get actions by agent type
 */
export async function getActionsByAgentType(
  workspaceId: string,
  agentType: AgentAction['agent_type'],
  limit = 50
): Promise<AgentAction[]> {
  const { data, error } = await supabaseAdmin
    .from('agent_actions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('agent_type', agentType)
    .order('triggered_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching actions by agent type:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get actions by status
 */
export async function getActionsByStatus(
  workspaceId: string,
  status: AgentAction['status']
): Promise<AgentAction[]> {
  const { data, error } = await supabaseAdmin
    .from('agent_actions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', status)
    .order('triggered_at', { ascending: false });

  if (error) {
    console.error('Error fetching actions by status:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get action by ID
 */
export async function getAgentActionById(
  actionId: string
): Promise<AgentAction | null> {
  const { data, error } = await supabaseAdmin
    .from('agent_actions')
    .select('*')
    .eq('id', actionId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching agent action:', error);
    throw error;
  }

  return data || null;
}

