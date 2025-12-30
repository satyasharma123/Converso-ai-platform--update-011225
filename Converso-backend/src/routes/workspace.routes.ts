import { Router, Request, Response } from 'express';
import { workspaceService } from '../services/workspace';
import { asyncHandler } from '../utils/errorHandler';
import { optionalAuth, AuthenticatedRequest } from '../middleware/auth';
import { resolveActiveWorkspace } from '../utils/resolveWorkspace';

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
    let workspace = await workspaceService.getWorkspace(client);
    // Auto-create workspace if it doesn't exist
    if (!workspace) {
      workspace = await workspaceService.createWorkspace('Default Workspace', client);
    }
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
    const userId = req.user?.id;
    const workspaceId = req.headers['x-workspace-id'] as string | undefined;

    // Require X-Workspace-Id header - do NOT fallback or guess
    if (!workspaceId) {
      return res.status(400).json({
        error: 'X-Workspace-Id header is required'
      });
    }

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Workspace name is required' });
    }

    // Verify user has access to this workspace (if authenticated)
    if (userId) {
      try {
        await resolveActiveWorkspace({ userId, workspaceId });
      } catch (error: any) {
        return res.status(403).json({
          error: 'User is not a member of this workspace'
        });
      }
    }

    // Use user's JWT client if available (has their auth token), otherwise admin client
    const client = req.supabaseClient || undefined;
    const workspace = await workspaceService.updateWorkspace(workspaceId, name, client);
    res.json({ data: workspace });
  })
);

export default router;

