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

export default router;

