/**
 * Agent Routes
 * REST API endpoints for AI agent system
 */

import express, { Request, Response } from 'express';
import {
  detectIntent,
  hasExistingIntent,
  reanalyzeConversationIntent,
} from '../services/intentDetection';
import {
  getConversationIntents,
  getLatestConversationIntent,
  getWorkspaceIntents,
  getIntentsByType,
} from '../api/agentIntents';
import {
  getConversationActions,
  getWorkspaceActions,
  getActionsByAgentType,
  getActionsByStatus,
} from '../api/agentActions';
import {
  getAgentConfiguration,
  getWorkspaceAgentConfigurations,
  getEnabledAgentConfigurations,
  updateAgentConfiguration,
  toggleAgentEnabled,
  updateAgentConfigData,
} from '../api/agentConfigurations';

const router = express.Router();

// ============================================================================
// INTENT DETECTION ENDPOINTS
// ============================================================================

/**
 * POST /api/agents/detect-intent
 * Detect intent for a conversation message
 */
router.post('/detect-intent', async (req: Request, res: Response) => {
  try {
    const { conversation_id, workspace_id, message_content, conversation_context } = req.body;

    // Validate required fields
    if (!conversation_id || !workspace_id || !message_content) {
      return res.status(400).json({
        error: 'Missing required fields: conversation_id, workspace_id, message_content',
      });
    }

    // Detect intent
    const result = await detectIntent({
      conversation_id,
      workspace_id,
      message_content,
      conversation_context,
    });

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        processing_time_ms: result.processing_time_ms,
      });
    }

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Error in detect-intent endpoint:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * GET /api/agents/intents/:conversationId
 * Get all intents for a conversation
 */
router.get('/intents/:conversationId', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;

    const intents = await getConversationIntents(conversationId);

    return res.status(200).json({
      success: true,
      intents,
      count: intents.length,
    });
  } catch (error: any) {
    console.error('Error fetching conversation intents:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * GET /api/agents/intents/:conversationId/latest
 * Get the latest intent for a conversation
 */
router.get('/intents/:conversationId/latest', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;

    const intent = await getLatestConversationIntent(conversationId);

    if (!intent) {
      return res.status(404).json({
        success: false,
        error: 'No intent found for this conversation',
      });
    }

    return res.status(200).json({
      success: true,
      intent,
    });
  } catch (error: any) {
    console.error('Error fetching latest intent:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * GET /api/agents/intents/workspace/:workspaceId
 * Get all intents for a workspace
 */
router.get('/intents/workspace/:workspaceId', async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;

    const intents = await getWorkspaceIntents(workspaceId, limit);

    return res.status(200).json({
      success: true,
      intents,
      count: intents.length,
    });
  } catch (error: any) {
    console.error('Error fetching workspace intents:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * GET /api/agents/intents/workspace/:workspaceId/type/:intentType
 * Get intents by type for a workspace
 */
router.get('/intents/workspace/:workspaceId/type/:intentType', async (req: Request, res: Response) => {
  try {
    const { workspaceId, intentType } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

    const intents = await getIntentsByType(workspaceId, intentType, limit);

    return res.status(200).json({
      success: true,
      intents,
      count: intents.length,
      intent_type: intentType,
    });
  } catch (error: any) {
    console.error('Error fetching intents by type:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * GET /api/agents/intents/:conversationId/exists
 * Check if a conversation has existing intent
 */
router.get('/intents/:conversationId/exists', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;

    const exists = await hasExistingIntent(conversationId);

    return res.status(200).json({
      success: true,
      exists,
    });
  } catch (error: any) {
    console.error('Error checking intent existence:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * POST /api/agents/intents/:conversationId/reanalyze
 * Re-analyze intent for a conversation
 */
router.post('/intents/:conversationId/reanalyze', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { workspace_id, message_content } = req.body;

    if (!workspace_id || !message_content) {
      return res.status(400).json({
        error: 'Missing required fields: workspace_id, message_content',
      });
    }

    const result = await reanalyzeConversationIntent(
      conversationId,
      workspace_id,
      message_content
    );

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Error re-analyzing intent:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// ============================================================================
// AGENT ACTIONS ENDPOINTS
// ============================================================================

/**
 * GET /api/agents/actions/:conversationId
 * Get all actions for a conversation
 */
router.get('/actions/:conversationId', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;

    const actions = await getConversationActions(conversationId);

    return res.status(200).json({
      success: true,
      actions,
      count: actions.length,
    });
  } catch (error: any) {
    console.error('Error fetching conversation actions:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * GET /api/agents/actions/workspace/:workspaceId
 * Get all actions for a workspace
 */
router.get('/actions/workspace/:workspaceId', async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;

    const actions = await getWorkspaceActions(workspaceId, limit);

    return res.status(200).json({
      success: true,
      actions,
      count: actions.length,
    });
  } catch (error: any) {
    console.error('Error fetching workspace actions:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * GET /api/agents/actions/workspace/:workspaceId/agent/:agentType
 * Get actions by agent type
 */
router.get('/actions/workspace/:workspaceId/agent/:agentType', async (req: Request, res: Response) => {
  try {
    const { workspaceId, agentType } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

    const actions = await getActionsByAgentType(
      workspaceId,
      agentType as any,
      limit
    );

    return res.status(200).json({
      success: true,
      actions,
      count: actions.length,
      agent_type: agentType,
    });
  } catch (error: any) {
    console.error('Error fetching actions by agent type:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * GET /api/agents/actions/workspace/:workspaceId/status/:status
 * Get actions by status
 */
router.get('/actions/workspace/:workspaceId/status/:status', async (req: Request, res: Response) => {
  try {
    const { workspaceId, status } = req.params;

    const actions = await getActionsByStatus(workspaceId, status as any);

    return res.status(200).json({
      success: true,
      actions,
      count: actions.length,
      status,
    });
  } catch (error: any) {
    console.error('Error fetching actions by status:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// ============================================================================
// AGENT CONFIGURATION ENDPOINTS
// ============================================================================

/**
 * GET /api/agents/config/:workspaceId/:agentType
 * Get agent configuration for a workspace
 */
router.get('/config/:workspaceId/:agentType', async (req: Request, res: Response) => {
  try {
    const { workspaceId, agentType } = req.params;

    const config = await getAgentConfiguration(workspaceId, agentType as any);

    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Agent configuration not found',
      });
    }

    return res.status(200).json({
      success: true,
      config,
    });
  } catch (error: any) {
    console.error('Error fetching agent configuration:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * GET /api/agents/config/:workspaceId
 * Get all agent configurations for a workspace
 */
router.get('/config/:workspaceId', async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.params;

    const configs = await getWorkspaceAgentConfigurations(workspaceId);

    return res.status(200).json({
      success: true,
      configs,
      count: configs.length,
    });
  } catch (error: any) {
    console.error('Error fetching workspace configurations:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * GET /api/agents/config/:workspaceId/enabled
 * Get enabled agent configurations for a workspace
 */
router.get('/config/:workspaceId/enabled', async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.params;

    const configs = await getEnabledAgentConfigurations(workspaceId);

    return res.status(200).json({
      success: true,
      configs,
      count: configs.length,
    });
  } catch (error: any) {
    console.error('Error fetching enabled configurations:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * PUT /api/agents/config/:configId
 * Update agent configuration
 */
router.put('/config/:configId', async (req: Request, res: Response) => {
  try {
    const { configId } = req.params;
    const updates = req.body;

    const config = await updateAgentConfiguration(configId, updates);

    return res.status(200).json({
      success: true,
      config,
    });
  } catch (error: any) {
    console.error('Error updating agent configuration:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * PUT /api/agents/config/:workspaceId/:agentType/toggle
 * Toggle agent enabled status
 */
router.put('/config/:workspaceId/:agentType/toggle', async (req: Request, res: Response) => {
  try {
    const { workspaceId, agentType } = req.params;
    const { is_enabled } = req.body;

    if (typeof is_enabled !== 'boolean') {
      return res.status(400).json({
        error: 'is_enabled must be a boolean',
      });
    }

    const config = await toggleAgentEnabled(
      workspaceId,
      agentType as any,
      is_enabled
    );

    return res.status(200).json({
      success: true,
      config,
      message: `Agent ${is_enabled ? 'enabled' : 'disabled'} successfully`,
    });
  } catch (error: any) {
    console.error('Error toggling agent status:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * PUT /api/agents/config/:workspaceId/:agentType/config-data
 * Update agent config data
 */
router.put('/config/:workspaceId/:agentType/config-data', async (req: Request, res: Response) => {
  try {
    const { workspaceId, agentType } = req.params;
    const { config_data } = req.body;

    if (!config_data || typeof config_data !== 'object') {
      return res.status(400).json({
        error: 'config_data must be an object',
      });
    }

    const config = await updateAgentConfigData(
      workspaceId,
      agentType as any,
      config_data
    );

    return res.status(200).json({
      success: true,
      config,
      message: 'Configuration data updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating config data:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// ============================================================================
// AGENT 3: REPLY GENERATION ENDPOINTS
// ============================================================================

/**
 * POST /api/agents/generate-reply
 * Generate a reply draft for a conversation
 */
router.post('/generate-reply', async (req: Request, res: Response) => {
  try {
    const {
      conversation_id,
      workspace_id,
      user_id,
      user_role,
      conversation_history,
      custom_instructions,
    } = req.body;

    // Validate required fields
    if (!conversation_id || !workspace_id || !user_id || !user_role) {
      return res.status(400).json({
        error: 'Missing required fields: conversation_id, workspace_id, user_id, user_role',
      });
    }

    // Validate user_role
    if (user_role !== 'admin' && user_role !== 'sdr' && user_role !== 'owner') {
      return res.status(400).json({
        error: 'user_role must be "admin", "owner", or "sdr"',
      });
    }

    // Import service
    const { generateReply } = await import('../services/replyGeneration');

    // Generate reply
    const result = await generateReply({
      conversation_id,
      workspace_id,
      user_id,
      user_role,
      conversation_history,
      custom_instructions,
    });

    if (!result.success) {
      if (result.permission_denied) {
        return res.status(403).json({
          error: result.error,
          permission_denied: true,
        });
      }
      
      return res.status(400).json({
        error: result.error,
      });
    }

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Error in generate-reply endpoint:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * POST /api/agents/regenerate-reply
 * Regenerate a reply draft (user requested)
 */
router.post('/regenerate-reply', async (req: Request, res: Response) => {
  try {
    const {
      conversation_id,
      workspace_id,
      user_id,
      user_role,
      conversation_history,
      custom_instructions,
    } = req.body;

    // Validate required fields
    if (!conversation_id || !workspace_id || !user_id || !user_role) {
      return res.status(400).json({
        error: 'Missing required fields: conversation_id, workspace_id, user_id, user_role',
      });
    }

    // Validate user_role
    if (user_role !== 'admin' && user_role !== 'sdr' && user_role !== 'owner') {
      return res.status(400).json({
        error: 'user_role must be "admin", "owner", or "sdr"',
      });
    }

    // Import service
    const { regenerateReply } = await import('../services/replyGeneration');

    // Regenerate reply
    const result = await regenerateReply({
      conversation_id,
      workspace_id,
      user_id,
      user_role,
      conversation_history,
      custom_instructions,
    });

    if (!result.success) {
      if (result.permission_denied) {
        return res.status(403).json({
          error: result.error,
          permission_denied: true,
        });
      }
      
      return res.status(400).json({
        error: result.error,
      });
    }

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Error in regenerate-reply endpoint:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * GET /api/agents/reply-config/:workspaceId
 * Get reply generation configuration for workspace
 */
router.get('/reply-config/:workspaceId', async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const { user_role } = req.query;

    if (!user_role || (user_role !== 'admin' && user_role !== 'sdr')) {
      return res.status(400).json({
        error: 'user_role query parameter is required and must be "admin" or "sdr"',
      });
    }

    const config = await getAgentConfiguration(workspaceId, 'reply_generation');

    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Reply generation configuration not found',
      });
    }

    // Check if user can access
    const { canUserGenerateReply } = await import('../services/replyGeneration');
    const permissionCheck = await canUserGenerateReply(
      workspaceId,
      user_role as 'admin' | 'sdr'
    );

    return res.status(200).json({
      success: true,
      config,
      can_use: permissionCheck.allowed,
      reason: permissionCheck.reason,
    });
  } catch (error: any) {
    console.error('Error fetching reply config:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * PUT /api/agents/reply-config/:workspaceId
 * Update reply generation configuration (Admin only)
 */
router.put('/reply-config/:workspaceId', async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const { config_data, user_role } = req.body;

    // Only admin can update config
    if (user_role !== 'admin') {
      return res.status(403).json({
        error: 'Only admins can update reply generation configuration',
      });
    }

    if (!config_data) {
      return res.status(400).json({
        error: 'config_data is required',
      });
    }

    const config = await updateAgentConfigData(
      workspaceId,
      'reply_generation',
      config_data
    );

    return res.status(200).json({
      success: true,
      config,
      message: 'Reply generation configuration updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating reply config:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// ============================================================================
// AGENT 2: LEAD ACTION ENDPOINTS
// ============================================================================

/**
 * POST /api/agents/apply-manual-tags
 * Manually apply tags to a conversation (user-triggered)
 */
router.post('/apply-manual-tags', async (req: Request, res: Response) => {
  try {
    const { conversation_id, tags } = req.body;

    if (!conversation_id || !tags || !Array.isArray(tags)) {
      return res.status(400).json({
        error: 'Missing required fields: conversation_id, tags (array)',
      });
    }

    const { applyManualTags } = await import('../services/leadActionAgent');
    const result = await applyManualTags(conversation_id, tags);

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Tags applied successfully',
    });
  } catch (error: any) {
    console.error('Error applying manual tags:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * POST /api/agents/remove-tags
 * Remove tags from a conversation
 */
router.post('/remove-tags', async (req: Request, res: Response) => {
  try {
    const { conversation_id } = req.body;

    if (!conversation_id) {
      return res.status(400).json({
        error: 'Missing required field: conversation_id',
      });
    }

    const { removeTags } = await import('../services/leadActionAgent');
    const result = await removeTags(conversation_id);

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Tags removed successfully',
    });
  } catch (error: any) {
    console.error('Error removing tags:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * POST /api/agents/run-lead-action
 * Manually trigger Agent 2 for a conversation
 */
router.post('/run-lead-action', async (req: Request, res: Response) => {
  try {
    const { conversation_id, workspace_id } = req.body;

    if (!conversation_id || !workspace_id) {
      return res.status(400).json({
        error: 'Missing required fields: conversation_id, workspace_id',
      });
    }

    const { runLeadActionAgent } = await import('../services/leadActionAgent');
    const result = await runLeadActionAgent(conversation_id, workspace_id);

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
      });
    }

    return res.status(200).json({
      success: true,
      actions_taken: result.actions_taken,
      message: 'Lead action agent completed successfully',
    });
  } catch (error: any) {
    console.error('Error running lead action agent:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

export default router;

