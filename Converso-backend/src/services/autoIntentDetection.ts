/**
 * Automatic Intent Detection Service
 * Triggers intent detection for new lead-quality messages
 * 
 * This service automatically analyzes incoming messages from leads to detect
 * their intent (pricing inquiry, demo request, etc.) using OpenAI GPT-4o-mini.
 * 
 * Key Features:
 * - Only processes messages from leads (not internal/sent messages)
 * - Runs in background to avoid blocking message delivery
 * - Respects workspace agent configuration settings
 * - Filters and highlights only lead-quality intents
 */

import { detectIntent } from './intentDetection';
import { getAgentConfiguration } from '../api/agentConfigurations';

/**
 * Lead-quality intent types that should be highlighted
 * These represent valuable sales opportunities
 */
const LEAD_INTENT_TYPES = [
  'pricing_inquiry',
  'demo_request',
  'meeting_request',
  'interested',
  'follow_up',
];

/**
 * Intent types that should be detected but not highlighted
 * (to avoid wasting resources on non-opportunities)
 */
const NON_LEAD_INTENT_TYPES = [
  'not_interested',
  'support_question',
  'objection',
  'other',
];

/**
 * Automatically detect intent for new inbound messages
 * Only processes messages that could be from leads
 * 
 * @param params - Message details and context
 * @returns Processing result with intent type if detected
 */
export async function autoDetectIntentForMessage(params: {
  conversation_id: string;
  workspace_id: string;
  message_content: string;
  is_from_lead: boolean; // Only process if true
  conversation_context?: {
    subject?: string;
    sender_name?: string;
    sender_email?: string;
  };
}): Promise<{ processed: boolean; intent_type?: string; reason?: string }> {
  const { conversation_id, workspace_id, message_content, is_from_lead, conversation_context } = params;

  try {
    // Skip if not from a lead (internal messages, team messages, sent emails)
    if (!is_from_lead) {
      return {
        processed: false,
        reason: 'Message is not from a lead (skipped)',
      };
    }

    // Skip empty or very short messages (likely not meaningful)
    if (!message_content || message_content.trim().length < 10) {
      return {
        processed: false,
        reason: 'Message too short to analyze',
      };
    }

    // Check if intent detection is enabled for this workspace
    const config = await getAgentConfiguration(workspace_id, 'intent_detection');
    
    if (!config || !config.is_enabled) {
      return {
        processed: false,
        reason: 'Intent detection is disabled for this workspace',
      };
    }

    // Trigger intent detection asynchronously (don't block message saving)
    // Using setImmediate to run after current event loop
    setImmediate(async () => {
      try {
        console.log(`[Auto Intent] Starting detection for conversation ${conversation_id}`);
        
        const result = await detectIntent({
          conversation_id,
          workspace_id,
          message_content,
          conversation_context,
        });

        if (result.success && result.intent) {
          const intentType = result.intent.primary_intent;
          const confidence = result.intent.confidence_score;
          
          // Only log/flag if it's a lead-quality intent
          if (LEAD_INTENT_TYPES.includes(intentType)) {
            console.log(`✅ [Auto Intent] Lead-quality intent detected: ${intentType} (confidence: ${confidence})`);
            console.log(`   Conversation: ${conversation_id}`);
            console.log(`   Keywords: ${result.intent.detected_keywords?.join(', ') || 'none'}`);
            console.log(`   Sentiment: ${result.intent.sentiment || 'unknown'}`);
            
            // ✨ TRIGGER AGENT 2: Apply tags and update pipeline
            try {
              const { runLeadActionAgent } = await import('./leadActionAgent');
              const agent2Result = await runLeadActionAgent(
                conversation_id,
                workspace_id
              );
              
              if (agent2Result.success) {
                console.log(`✅ [Agent 2] Actions completed: ${agent2Result.actions_taken?.join('; ')}`);
              } else {
                console.log(`ℹ️  [Agent 2] Skipped: ${agent2Result.error}`);
              }
            } catch (agent2Error: any) {
              console.error('[Agent 2] Error running Lead Action Agent:', agent2Error.message);
              // Don't throw - Agent 2 failure shouldn't break intent detection
            }
          } else {
            console.log(`ℹ️  [Auto Intent] Non-lead intent detected: ${intentType} (no action taken)`);
          }
        } else {
          console.log(`⚠️  [Auto Intent] Detection failed: ${result.error || 'unknown error'}`);
        }
      } catch (error: any) {
        console.error('[Auto Intent] Background intent detection failed:', error.message);
        // Don't throw - we don't want to break message processing
      }
    });

    return {
      processed: true,
      reason: 'Intent detection queued in background',
    };
  } catch (error: any) {
    console.error('[Auto Intent] Error in auto intent detection:', error);
    return {
      processed: false,
      reason: error.message,
    };
  }
}

/**
 * Check if an intent type represents a lead opportunity
 * 
 * @param intentType - The detected intent type
 * @returns True if this is a lead-quality intent
 */
export function isLeadIntent(intentType: string): boolean {
  return LEAD_INTENT_TYPES.includes(intentType);
}

/**
 * Get CSS class/color for intent badge based on type
 * Used by frontend to display intent badges with appropriate styling
 * 
 * @param intentType - The detected intent type
 * @returns Styling information for the intent badge
 */
export function getIntentBadgeStyle(intentType: string): {
  color: string;
  label: string;
  priority: 'high' | 'medium' | 'low';
} {
  const styles: Record<string, { color: string; label: string; priority: 'high' | 'medium' | 'low' }> = {
    pricing_inquiry: {
      color: '#10B981', // Green
      label: 'Pricing Interest',
      priority: 'high',
    },
    demo_request: {
      color: '#3B82F6', // Blue
      label: 'Demo Requested',
      priority: 'high',
    },
    meeting_request: {
      color: '#8B5CF6', // Purple
      label: 'Meeting Request',
      priority: 'high',
    },
    interested: {
      color: '#F59E0B', // Orange
      label: 'Interested',
      priority: 'medium',
    },
    follow_up: {
      color: '#6B7280', // Gray
      label: 'Follow-up',
      priority: 'medium',
    },
    not_interested: {
      color: '#EF4444', // Red
      label: 'Not Interested',
      priority: 'low',
    },
    support_question: {
      color: '#6366F1', // Indigo
      label: 'Support',
      priority: 'low',
    },
    objection: {
      color: '#F97316', // Orange-red
      label: 'Objection',
      priority: 'medium',
    },
  };

  return styles[intentType] || {
    color: '#9CA3AF',
    label: 'Other',
    priority: 'low',
  };
}

/**
 * Get all lead-quality intent types
 * Useful for filtering queries
 */
export function getLeadIntentTypes(): string[] {
  return [...LEAD_INTENT_TYPES];
}

/**
 * Get all non-lead intent types
 * Useful for filtering queries
 */
export function getNonLeadIntentTypes(): string[] {
  return [...NON_LEAD_INTENT_TYPES];
}

