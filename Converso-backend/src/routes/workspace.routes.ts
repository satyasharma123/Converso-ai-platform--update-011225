import { Router, Request, Response } from 'express';
import { workspaceService } from '../services/workspace';
import { asyncHandler } from '../utils/errorHandler';
import { optionalAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/workspace
 * Get workspace settings
 */
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const client = req.supabaseClient || undefined;
    const workspace = await workspaceService.getWorkspace(client);
    res.json({ data: workspace });
  })
);

/**
 * PUT /api/workspace
 * Update workspace name
 */
router.put(
  '/',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Workspace name is required' });
    }

    // Use user's JWT client if available (has their auth token), otherwise admin client
    const client = req.supabaseClient || undefined;
    const workspace = await workspaceService.updateWorkspace(name, client);
    res.json({ data: workspace });
  })
);

export default router;

