import { Router, Request, Response } from 'express';
import { asyncHandler } from '../utils/errorHandler';
import { authenticate, AuthenticatedRequest, requireRole } from '../middleware/auth';
import * as aiAgentSettingsApi from '../api/aiAgentSettings';

const router = Router();

/**
 * GET /api/ai-agents/settings
 * Get AI Agent Settings for current workspace
 */
router.get(
  '/settings',
  authenticate,
  requireRole(['admin']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;

    const settings = await aiAgentSettingsApi.getAIAgentSettings(userId);
    res.json({ data: settings });
  })
);

/**
 * PUT /api/ai-agents/settings
 * Update AI Agent Settings for current workspace
 */
router.put(
  '/settings',
  authenticate,
  requireRole(['admin']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const payload = req.body;

    const updated = await aiAgentSettingsApi.updateAIAgentSettings(userId, payload);
    res.json({ data: updated });
  })
);

export default router;

