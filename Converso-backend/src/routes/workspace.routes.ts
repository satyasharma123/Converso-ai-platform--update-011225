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
    const userId = req.user?.id;
    const workspaceId = req.headers['x-workspace-id'] as string | undefined;
    const client = req.supabaseClient || undefined;

    // If X-Workspace-Id header is provided, get that specific workspace
    if (workspaceId) {
      if (userId) {
        // Verify user has access to this workspace
        try {
          await resolveActiveWorkspace({ userId, workspaceId });
        } catch (error: any) {
          return res.status(403).json({
            error: 'User is not a member of this workspace'
          });
        }
      }
      
      const { supabaseAdmin } = await import('../lib/supabase');
      const dbClient = client || supabaseAdmin;
      const { data, error } = await dbClient
        .from('workspaces')
        .select('*')
        .eq('id', workspaceId)
        .single();

      if (error) {
        return res.status(404).json({ error: 'Workspace not found' });
      }
      return res.json({ data });
    }

    // If no workspaceId header, check if user already belongs to a workspace
    // INVARIANT:
    // A user may auto-create a workspace ONLY if
    // they do NOT already belong to any workspace
    if (userId) {
      const { supabaseAdmin } = await import('../lib/supabase');
      const dbClient = client || supabaseAdmin;
      
      // Check if user already belongs to a workspace
      const { data: existingMemberships } = await dbClient
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', userId)
        .limit(1);

      if (existingMemberships && existingMemberships.length > 0) {
        // User already belongs to a workspace - get the first one
        const { data: workspace } = await dbClient
          .from('workspaces')
          .select('*')
          .eq('id', existingMemberships[0].workspace_id)
          .single();
        
        if (workspace) {
          return res.json({ data: workspace });
        }
      }
    }

    // Fallback: Try to get any workspace (legacy behavior)
    let workspace = await workspaceService.getWorkspace(client);
    
    // Auto-create workspace ONLY if user doesn't belong to any workspace
    if (!workspace && userId) {
      // Get user email for owner_email field
      const { supabaseAdmin } = await import('../lib/supabase');
      const dbClient = client || supabaseAdmin;
      const { data: profile } = await dbClient
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .maybeSingle();
      
      const userEmail = profile?.email || null;
      workspace = await workspaceService.createWorkspace('Default Workspace', client, userId, userEmail);
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

/**
 * DELETE /api/workspace
 * Delete workspace (OWNER only)
 */
router.delete(
  '/',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    const workspaceId = req.headers['x-workspace-id'] as string | undefined;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!workspaceId) {
      return res.status(400).json({
        error: 'X-Workspace-Id header is required'
      });
    }

    // Use admin client to read owner_user_id (since backend may bypass RLS)
    const client = req.supabaseClient || undefined;
    const { supabaseAdmin } = await import('../lib/supabase');
    const dbClient = client || supabaseAdmin;

    const { data: ws, error: wsErr } = await dbClient
      .from('workspaces')
      .select('id, owner_user_id')
      .eq('id', workspaceId)
      .single();

    if (wsErr || !ws) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Only the account owner can delete the workspace
    if (ws.owner_user_id !== userId) {
      return res.status(403).json({
        error: 'Only the account owner can delete this workspace'
      });
    }

    // Proceed with delete (service handles workspace_members deletion)
    await workspaceService.deleteWorkspace(workspaceId, client);
    
    res.json({ success: true });
  })
);

export default router;

