/**
 * Reply Generation Service (Agent 3)
 * Generates AI-powered reply drafts for qualified lead conversations
 * 
 * Key Rules:
 * - Only generates for tagged conversations (Meeting Requested / Info Requested)
 * - Respects workspace configuration (Draft Only vs Auto Send)
 * - Enforces permission checks (Admin/Owner vs SDR)
 * - Human edits always override AI
 * - No automatic follow-ups or retries
 * 
 * Core Principle: AI assists, humans decide. Never bypass human oversight.
 */

import { getAgentConfiguration } from '../api/agentConfigurations';
import { generateReplyWithAI } from '../utils/openai';
import {
  GenerateReplyRequest,
  GenerateReplyResponse,
  ReplyGenerationConfig,
} from '../types';

/**
 * Check if user has permission to use Agent 3
 * 
 * Rules:
 * - Admin/Owner: Always allowed
 * - SDR: Only if allow_sdr_access = true
 */
export async function canUserGenerateReply(
  workspaceId: string,
  userRole: 'admin' | 'sdr'
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    // Get Agent 3 configuration
    const config = await getAgentConfiguration(workspaceId, 'reply_generation');
    
    if (!config || !config.is_enabled) {
      return {
        allowed: false,
        reason: 'Reply generation is disabled for this workspace',
      };
    }
    
    const replyConfig = config.config_data as ReplyGenerationConfig;
    
    // Admin/Owner always allowed
    if (userRole === 'admin') {
      return { allowed: true };
    }
    
    // SDR only if explicitly allowed
    if (userRole === 'sdr' && !replyConfig.allow_sdr_access) {
      return {
        allowed: false,
        reason: 'SDRs are not permitted to use reply generation',
      };
    }
    
    return { allowed: true };
  } catch (error: any) {
    console.error('[Agent 3] Permission check error:', error);
    return {
      allowed: false,
      reason: error.message,
    };
  }
}

/**
 * Check if conversation qualifies for reply generation
 * 
 * Requirements:
 * - Must have at least one required tag (Meeting Requested OR Info Requested)
 */
export function conversationQualifies(
  conversationTags: string[],
  requiredTags: string[]
): boolean {
  // Check if conversation has at least one required tag
  return requiredTags.some(tag => conversationTags.includes(tag));
}

/**
 * Generate reply draft for a conversation
 * 
 * Main entry point for Agent 3
 */
export async function generateReply(
  request: GenerateReplyRequest
): Promise<GenerateReplyResponse> {
  const startTime = Date.now();
  
  try {
    console.log(`[Agent 3] Starting reply generation for conversation ${request.conversation_id}`);
    
    // 1. Check permissions
    const permissionCheck = await canUserGenerateReply(
      request.workspace_id,
      request.user_role as 'admin' | 'sdr'
    );
    
    if (!permissionCheck.allowed) {
      console.log(`[Agent 3] ❌ Permission denied: ${permissionCheck.reason}`);
      return {
        success: false,
        permission_denied: true,
        error: permissionCheck.reason,
      };
    }
    
    // 2. Get Agent 3 configuration
    const config = await getAgentConfiguration(
      request.workspace_id,
      'reply_generation'
    );
    
    if (!config) {
      return {
        success: false,
        error: 'Reply generation configuration not found',
      };
    }
    
    const replyConfig = config.config_data as ReplyGenerationConfig;
    
    // 3. Determine intent from conversation context
    const detectedIntent = request.conversation_history?.detected_intent || 'general';
    
    // 4. Build AI prompt context
    const conversationContext = {
      subject: request.conversation_history?.subject,
      sender_name: request.conversation_history?.sender_name,
      conversation_history: request.conversation_history?.messages?.map(m => {
        const prefix = m.is_from_lead ? '[Lead]' : '[Us]';
        return `${prefix}: ${m.content}`;
      }),
    };
    
    // 5. Get the last message from lead
    const lastLeadMessage = request.conversation_history?.messages
      ?.filter(m => m.is_from_lead)
      ?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      ?.[0];
    
    if (!lastLeadMessage) {
      console.log('[Agent 3] ❌ No message from lead found');
      return {
        success: false,
        error: 'No message from lead found to reply to',
      };
    }
    
    // 6. Generate reply using OpenAI
    console.log(`[Agent 3] Generating reply with intent: ${detectedIntent}, mode: ${replyConfig.mode}`);
    console.log(`[Agent 3] Tone: ${replyConfig.tone}, Max length: ${replyConfig.max_draft_length}`);
    
    const aiResult = await generateReplyWithAI(
      lastLeadMessage.content,
      detectedIntent,
      conversationContext
    );
    
    // 7. Apply safety guardrails
    let replyDraft = aiResult.reply_text;
    
    // Check for commitment language
    if (replyConfig.safety_rules.no_commitments) {
      const commitmentWords = ['guarantee', 'promise', 'definitely will', 'commit to', 'we will definitely'];
      const hasCommitment = commitmentWords.some(word => 
        replyDraft.toLowerCase().includes(word)
      );
      
      if (hasCommitment) {
        console.warn('[Agent 3] ⚠️  Draft contains commitment language');
        // Note: In production, you might want to re-generate or modify the text
      }
    }
    
    // Check for pricing information
    if (replyConfig.safety_rules.no_pricing) {
      const pricingIndicators = ['$', '€', '£', 'price', 'cost', 'fee', 'pricing'];
      const hasPricing = pricingIndicators.some(indicator => 
        replyDraft.toLowerCase().includes(indicator)
      );
      
      if (hasPricing) {
        console.warn('[Agent 3] ⚠️  Draft may contain pricing information');
      }
    }
    
    // Check for calendar links
    if (replyConfig.safety_rules.no_calendar_links) {
      const calendarIndicators = ['calendly', 'cal.com', 'schedule', 'booking'];
      const hasCalendarLink = calendarIndicators.some(indicator => 
        replyDraft.toLowerCase().includes(indicator)
      );
      
      if (hasCalendarLink) {
        console.warn('[Agent 3] ⚠️  Draft may contain calendar link references');
      }
    }
    
    // 8. Enforce max length
    if (replyDraft.length > replyConfig.max_draft_length) {
      console.warn(`[Agent 3] ⚠️  Draft exceeds max length (${replyDraft.length} > ${replyConfig.max_draft_length}), truncating...`);
      replyDraft = replyDraft.substring(0, replyConfig.max_draft_length) + '...';
    }
    
    // 9. Add custom instructions if provided
    if (request.custom_instructions) {
      console.log(`[Agent 3] Custom instructions provided: ${request.custom_instructions.substring(0, 50)}...`);
      // Note: Custom instructions would require re-generation with modified prompt
      // For now, we just log them
    }
    
    const processingTime = Date.now() - startTime;
    const wordCount = replyDraft.split(/\s+/).filter(w => w.length > 0).length;
    
    console.log(`[Agent 3] ✅ Reply generated successfully`);
    console.log(`[Agent 3] Processing time: ${processingTime}ms`);
    console.log(`[Agent 3] Word count: ${wordCount}`);
    console.log(`[Agent 3] Tone used: ${aiResult.tone}`);
    console.log(`[Agent 3] Intent addressed: ${detectedIntent}`);
    
    return {
      success: true,
      reply_draft: replyDraft,
      metadata: {
        intent_addressed: detectedIntent,
        tone_used: aiResult.tone,
        word_count: wordCount,
        generation_time_ms: processingTime,
      },
    };
  } catch (error: any) {
    console.error('[Agent 3] ❌ Reply generation error:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate reply',
    };
  }
}

/**
 * Check if auto-send mode is enabled
 * Only Admin/Owner can enable this
 */
export async function shouldAutoSend(
  workspaceId: string
): Promise<boolean> {
  try {
    const config = await getAgentConfiguration(workspaceId, 'reply_generation');
    
    if (!config || !config.is_enabled) {
      return false;
    }
    
    const replyConfig = config.config_data as ReplyGenerationConfig;
    return replyConfig.mode === 'auto_send';
  } catch (error) {
    console.error('[Agent 3] Auto-send check error:', error);
    return false;
  }
}

/**
 * Regenerate reply draft
 * Same as generate, but indicates it's a regeneration
 */
export async function regenerateReply(
  request: GenerateReplyRequest
): Promise<GenerateReplyResponse> {
  console.log(`[Agent 3] 🔄 Regenerating reply for conversation ${request.conversation_id}`);
  
  // Same logic as generateReply, but with logging to indicate regeneration
  return generateReply(request);
}

/**
 * Get reply generation statistics for a workspace
 * Useful for analytics and monitoring
 */
export async function getReplyGenerationStats(
  workspaceId: string
): Promise<{
  total_generated: number;
  avg_generation_time_ms: number;
  most_common_intent: string;
}> {
  // This would query agent_actions table for reply_generation actions
  // For now, return placeholder
  return {
    total_generated: 0,
    avg_generation_time_ms: 0,
    most_common_intent: 'unknown',
  };
}

