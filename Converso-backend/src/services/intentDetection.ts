/**
 * Intent Detection Service (OpenAI-Powered)
 * Analyzes conversation messages to detect user intent using GPT-4o-mini
 */

import {
  createConversationIntent,
  getLatestConversationIntent,
} from '../api/agentIntents';
import {
  createAgentAction,
  updateAgentActionStatus,
} from '../api/agentActions';
import { getAgentConfiguration } from '../api/agentConfigurations';
import {
  DetectIntentRequest,
  DetectIntentResponse,
  ConversationIntent,
  IntentDetectionConfig,
} from '../types';
import { detectIntentWithAI } from '../utils/openai';

/**
 * Detect intent from message content using OpenAI
 */
export async function detectIntent(
  request: DetectIntentRequest
): Promise<DetectIntentResponse> {
  const startTime = Date.now();
  let action: { id: string } | null = null;

  try {
    // Get agent configuration for this workspace
    const config = await getAgentConfiguration(
      request.workspace_id,
      'intent_detection'
    );

    // Check if intent detection is enabled
    if (!config || !config.is_enabled) {
      return {
        success: false,
        error: 'Intent detection agent is not enabled for this workspace',
        processing_time_ms: Date.now() - startTime,
      };
    }

    const intentConfig = config.config_data as IntentDetectionConfig;

    // Log agent action start
    try {
      action = await createAgentAction({
        conversation_id: request.conversation_id,
        workspace_id: request.workspace_id,
        agent_type: 'intent_detection',
        action_type: 'detect_intent',
        action_description: 'Analyzing message with OpenAI to detect user intent',
      });

      await updateAgentActionStatus(action.id, 'processing');
    } catch (actionError) {
      console.error('Error creating agent action:', actionError);
      // Continue anyway - action logging is not critical
    }

    // Call OpenAI for intent detection
    const aiResult = await detectIntentWithAI(
      request.message_content,
      request.conversation_context
    );

    // Check if confidence meets threshold
    if (aiResult.confidence_score < (intentConfig.confidence_threshold || 0.5)) {
      const intent = await createConversationIntent({
        conversation_id: request.conversation_id,
        workspace_id: request.workspace_id,
        primary_intent: 'other',
        confidence_score: aiResult.confidence_score,
        intent_metadata: { 
          reason: 'Confidence below threshold',
          ai_reasoning: aiResult.reasoning,
        },
        detected_by: 'intent_detection_v1_openai',
        model_version: 'gpt-4o-mini',
      });

      if (action) {
        await updateAgentActionStatus(
          action.id,
          'completed',
          undefined,
          Date.now() - startTime
        );
      }

      return {
        success: true,
        intent,
        processing_time_ms: Date.now() - startTime,
      };
    }

    // Create intent record with OpenAI results
    const intent = await createConversationIntent({
      conversation_id: request.conversation_id,
      workspace_id: request.workspace_id,
      primary_intent: aiResult.primary_intent as ConversationIntent['primary_intent'],
      secondary_intents: aiResult.secondary_intents.length > 0 
        ? aiResult.secondary_intents 
        : undefined,
      confidence_score: parseFloat(aiResult.confidence_score.toFixed(2)),
      intent_metadata: {
        is_urgent: aiResult.is_urgent,
        analysis_method: 'openai_gpt4o_mini',
        ai_reasoning: aiResult.reasoning,
        full_text_length: request.message_content.length,
        has_context: !!request.conversation_context,
      },
      detected_keywords: aiResult.detected_keywords.slice(0, 10),
      sentiment: intentConfig.enable_sentiment_analysis 
        ? aiResult.sentiment 
        : undefined,
      detected_by: 'intent_detection_v1_openai',
      model_version: 'gpt-4o-mini',
    });

    // Update action status to completed
    if (action) {
      await updateAgentActionStatus(
        action.id,
        'completed',
        undefined,
        Date.now() - startTime
      );
    }

    return {
      success: true,
      intent,
      processing_time_ms: Date.now() - startTime,
    };
  } catch (error: any) {
    console.error('Error detecting intent with OpenAI:', error);
    
    // Try to update action status to failed if action was created
    if (action) {
      try {
        await updateAgentActionStatus(
          action.id,
          'failed',
          error.message || 'Failed to detect intent',
          Date.now() - startTime
        );
      } catch (updateError) {
        console.error('Failed to update action status:', updateError);
      }
    }

    return {
      success: false,
      error: error.message || 'Failed to detect intent',
      processing_time_ms: Date.now() - startTime,
    };
  }
}

/**
 * Check if a conversation already has intent detection
 */
export async function hasExistingIntent(
  conversationId: string
): Promise<boolean> {
  const existing = await getLatestConversationIntent(conversationId);
  return existing !== null;
}

/**
 * Re-analyze a conversation (useful for testing or re-processing)
 */
export async function reanalyzeConversationIntent(
  conversationId: string,
  workspaceId: string,
  messageContent: string
): Promise<DetectIntentResponse> {
  return detectIntent({
    conversation_id: conversationId,
    workspace_id: workspaceId,
    message_content: messageContent,
  });
}
