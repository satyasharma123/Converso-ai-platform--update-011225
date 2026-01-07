/**
 * Lead Action Agent (Agent 2)
 * Applies lead tags, updates pipeline stages, and assigns SDRs based on detected intent
 * 
 * Key Rules:
 * - Consumes Agent 1 output (detected intent)
 * - Applies appropriate lead tags
 * - Updates pipeline stage automatically
 * - Can assign to SDR based on intent type
 * - ALWAYS respects manual overrides
 * - Does NOT send messages or generate replies
 * 
 * Core Principle: AI suggests, humans decide. Manual actions always override AI.
 */

import { supabaseAdmin } from '../lib/supabase';
import { getLatestConversationIntent } from '../api/agentIntents';
import { createAgentAction, updateAgentActionStatus } from '../api/agentActions';
import { getAgentConfiguration } from '../api/agentConfigurations';

/**
 * Intent to Lead Tag mapping
 */
const INTENT_TO_TAG_MAP: Record<string, string[]> = {
  'meeting_request': ['meeting_requested'],
  'demo_request': ['meeting_requested'], // Demo is a type of meeting
  'pricing_inquiry': ['info_requested'],
  'support_question': ['info_requested'],
  'interested': ['lead'],
  'follow_up': ['lead'],
};

/**
 * Intent to Pipeline Stage mapping
 */
const INTENT_TO_STAGE_MAP: Record<string, string> = {
  'meeting_request': 'Contacted',
  'demo_request': 'Contacted',
  'pricing_inquiry': 'Qualified',
  'interested': 'Lead',
  'follow_up': 'Contacted',
};

/**
 * Apply lead tags based on detected intent
 * 
 * @param conversationId - Conversation to tag
 * @param workspaceId - Workspace ID
 * @param detectedIntent - Intent from Agent 1
 * @param manualOverride - Skip if conversation already has manual tags
 */
export async function applyLeadTags(
  conversationId: string,
  workspaceId: string,
  detectedIntent: string,
  manualOverride: boolean = false
): Promise<{ success: boolean; tags_applied?: string[]; error?: string }> {
  const startTime = Date.now();
  
  try {
    // Check if Agent 2 is enabled
    const config = await getAgentConfiguration(workspaceId, 'lead_action');
    
    if (!config || !config.is_enabled) {
      return {
        success: false,
        error: 'Lead Action Agent is disabled for this workspace',
      };
    }
    
    // Get current conversation to check for existing tags
    const { data: conversation, error: fetchError } = await supabaseAdmin
      .from('conversations')
      .select('lead_tags, custom_stage_id, manually_tagged')
      .eq('id', conversationId)
      .single();
    
    if (fetchError || !conversation) {
      return {
        success: false,
        error: 'Conversation not found',
      };
    }
    
    // RULE: Manual override - if user manually tagged, don't auto-tag
    if (conversation.manually_tagged && !manualOverride) {
      console.log(`[Agent 2] Skipping auto-tag - conversation ${conversationId} has manual tags`);
      return {
        success: false,
        error: 'Conversation has manual tags - respecting human override',
      };
    }
    
    // Get tags for this intent
    const tagsToApply = INTENT_TO_TAG_MAP[detectedIntent] || ['lead'];
    
    // Log action
    const action = await createAgentAction({
      conversation_id: conversationId,
      workspace_id: workspaceId,
      agent_type: 'lead_action',
      action_type: 'apply_tags',
      action_description: `Applying tags based on detected intent: ${detectedIntent}`,
      action_data: {
        detected_intent: detectedIntent,
        tags_to_apply: tagsToApply,
      },
    });
    
    await updateAgentActionStatus(action.id, 'processing');
    
    // Apply tags
    const { error: updateError } = await supabaseAdmin
      .from('conversations')
      .update({
        lead_tags: tagsToApply,
        manually_tagged: false, // Mark as AI-tagged
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId);
    
    if (updateError) {
      await updateAgentActionStatus(action.id, 'failed', updateError.message);
      return {
        success: false,
        error: updateError.message,
      };
    }
    
    await updateAgentActionStatus(action.id, 'completed', undefined, Date.now() - startTime);
    
    console.log(`[Agent 2] ✅ Applied tags ${tagsToApply.join(', ')} to conversation ${conversationId}`);
    
    return {
      success: true,
      tags_applied: tagsToApply,
    };
  } catch (error: any) {
    console.error('[Agent 2] Error applying lead tags:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Update pipeline stage based on detected intent
 * 
 * @param conversationId - Conversation to update
 * @param workspaceId - Workspace ID
 * @param detectedIntent - Intent from Agent 1
 */
export async function updatePipelineStage(
  conversationId: string,
  workspaceId: string,
  detectedIntent: string
): Promise<{ success: boolean; stage_name?: string; error?: string }> {
  try {
    // Get current conversation
    const { data: conversation, error: fetchError } = await supabaseAdmin
      .from('conversations')
      .select('custom_stage_id, manually_staged')
      .eq('id', conversationId)
      .single();
    
    if (fetchError || !conversation) {
      return {
        success: false,
        error: 'Conversation not found',
      };
    }
    
    // RULE: Manual override - if user manually set stage, don't auto-update
    if (conversation.manually_staged) {
      console.log(`[Agent 2] Skipping auto-stage - conversation ${conversationId} has manual stage`);
      return {
        success: false,
        error: 'Conversation has manual stage - respecting human override',
      };
    }
    
    // Get stage name for this intent
    const stageName = INTENT_TO_STAGE_MAP[detectedIntent] || 'Lead';
    
    // Find stage ID by name
    const { data: stage, error: stageError } = await supabaseAdmin
      .from('pipeline_stages')
      .select('id, name')
      .eq('name', stageName)
      .eq('workspace_id', workspaceId)
      .single();
    
    if (stageError || !stage) {
      console.warn(`[Agent 2] Pipeline stage "${stageName}" not found for workspace ${workspaceId}`);
      return {
        success: false,
        error: `Pipeline stage "${stageName}" not found`,
      };
    }
    
    // Update conversation stage
    const { error: updateError } = await supabaseAdmin
      .from('conversations')
      .update({
        custom_stage_id: stage.id,
        stage_assigned_at: new Date().toISOString(),
        manually_staged: false, // Mark as AI-staged
      })
      .eq('id', conversationId);
    
    if (updateError) {
      return {
        success: false,
        error: updateError.message,
      };
    }
    
    console.log(`[Agent 2] ✅ Updated pipeline stage to "${stageName}" for conversation ${conversationId}`);
    
    return {
      success: true,
      stage_name: stageName,
    };
  } catch (error: any) {
    console.error('[Agent 2] Error updating pipeline stage:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Main Agent 2 workflow - triggered after Agent 1 detects intent
 * 
 * @param conversationId - Conversation ID
 * @param workspaceId - Workspace ID
 */
export async function runLeadActionAgent(
  conversationId: string,
  workspaceId: string
): Promise<{ success: boolean; actions_taken?: string[]; error?: string }> {
  try {
    console.log(`[Agent 2] Running Lead Action Agent for conversation ${conversationId}`);
    
    // Get latest detected intent from Agent 1
    const intent = await getLatestConversationIntent(conversationId);
    
    if (!intent) {
      console.log(`[Agent 2] No intent detected for conversation ${conversationId} - skipping`);
      return {
        success: false,
        error: 'No intent detected',
      };
    }
    
    const detectedIntent = intent.primary_intent;
    const actionsTaken: string[] = [];
    
    // Only process lead-quality intents
    const leadIntents = ['meeting_request', 'demo_request', 'pricing_inquiry', 'interested', 'follow_up'];
    
    if (!leadIntents.includes(detectedIntent)) {
      console.log(`[Agent 2] Intent "${detectedIntent}" is not a lead-quality intent - skipping`);
      return {
        success: false,
        error: 'Non-lead intent detected',
      };
    }
    
    // Step 1: Apply lead tags
    const tagResult = await applyLeadTags(conversationId, workspaceId, detectedIntent);
    if (tagResult.success) {
      actionsTaken.push(`Applied tags: ${tagResult.tags_applied?.join(', ')}`);
    }
    
    // Step 2: Update pipeline stage
    const stageResult = await updatePipelineStage(conversationId, workspaceId, detectedIntent);
    if (stageResult.success) {
      actionsTaken.push(`Updated stage to: ${stageResult.stage_name}`);
    }
    
    console.log(`[Agent 2] ✅ Completed actions: ${actionsTaken.join('; ')}`);
    
    return {
      success: true,
      actions_taken: actionsTaken,
    };
  } catch (error: any) {
    console.error('[Agent 2] Error in Lead Action Agent:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Manual tag application (user-triggered)
 * Marks conversation as manually tagged to prevent AI override
 */
export async function applyManualTags(
  conversationId: string,
  tags: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    // If tags array is empty, clear tags and reset manually_tagged
    const updateData = tags.length === 0 
      ? {
          lead_tags: null,
          manually_tagged: false,
          updated_at: new Date().toISOString(),
        }
      : {
          lead_tags: tags,
          manually_tagged: true, // Mark as manually tagged
          updated_at: new Date().toISOString(),
        };

    const { error } = await supabaseAdmin
      .from('conversations')
      .update(updateData)
      .eq('id', conversationId);
    
    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }
    
    if (tags.length === 0) {
      console.log(`[Agent 2] ✅ Cleared tags for conversation ${conversationId}`);
    } else {
      console.log(`[Agent 2] ✅ Manually applied tags ${tags.join(', ')} to conversation ${conversationId}`);
    }
    
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Remove tags from conversation
 */
export async function removeTags(
  conversationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('conversations')
      .update({
        lead_tags: null,
        manually_tagged: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId);
    
    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }
    
    console.log(`[Agent 2] ✅ Removed tags from conversation ${conversationId}`);
    
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

