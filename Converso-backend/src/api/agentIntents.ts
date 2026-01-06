/**
 * API Layer: Conversation Intents
 * Database queries for AI-detected conversation intents
 */

import { supabaseAdmin } from '../lib/supabase';
import { ConversationIntent } from '../types';

/**
 * Create a new conversation intent record
 */
export async function createConversationIntent(
  intent: Omit<ConversationIntent, 'id' | 'created_at' | 'detected_at'>
): Promise<ConversationIntent> {
  const { data, error } = await supabaseAdmin
    .from('conversation_intents')
    .insert({
      conversation_id: intent.conversation_id,
      workspace_id: intent.workspace_id,
      primary_intent: intent.primary_intent,
      secondary_intents: intent.secondary_intents || null,
      confidence_score: intent.confidence_score,
      intent_metadata: intent.intent_metadata || {},
      detected_keywords: intent.detected_keywords || null,
      sentiment: intent.sentiment || null,
      detected_by: intent.detected_by || 'intent_detection_v1',
      model_version: intent.model_version || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating conversation intent:', error);
    throw error;
  }

  return data;
}

/**
 * Get all intents for a specific conversation
 */
export async function getConversationIntents(
  conversationId: string
): Promise<ConversationIntent[]> {
  const { data, error } = await supabaseAdmin
    .from('conversation_intents')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('detected_at', { ascending: false });

  if (error) {
    console.error('Error fetching conversation intents:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get the latest intent for a conversation
 */
export async function getLatestConversationIntent(
  conversationId: string
): Promise<ConversationIntent | null> {
  const { data, error } = await supabaseAdmin
    .from('conversation_intents')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('detected_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows returned
    console.error('Error fetching latest conversation intent:', error);
    throw error;
  }

  return data || null;
}

/**
 * Get all intents for a workspace
 */
export async function getWorkspaceIntents(
  workspaceId: string,
  limit = 100
): Promise<ConversationIntent[]> {
  const { data, error } = await supabaseAdmin
    .from('conversation_intents')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('detected_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching workspace intents:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get intents by primary intent type
 */
export async function getIntentsByType(
  workspaceId: string,
  intentType: string,
  limit = 50
): Promise<ConversationIntent[]> {
  const { data, error } = await supabaseAdmin
    .from('conversation_intents')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('primary_intent', intentType)
    .order('detected_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching intents by type:', error);
    throw error;
  }

  return data || [];
}

/**
 * Delete intent by ID
 */
export async function deleteConversationIntent(
  intentId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('conversation_intents')
    .delete()
    .eq('id', intentId);

  if (error) {
    console.error('Error deleting conversation intent:', error);
    throw error;
  }
}

