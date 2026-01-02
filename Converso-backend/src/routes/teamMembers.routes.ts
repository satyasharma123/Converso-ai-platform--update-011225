import { Router, Request, Response } from 'express';
import { teamMembersService } from '../services/teamMembers';
import { asyncHandler } from '../utils/errorHandler';
import { optionalAuth, AuthenticatedRequest } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';
import { resolveActiveWorkspace } from '../utils/resolveWorkspace';

const router = Router();

/**
 * GET /api/team-members
 * Get all team members for the active workspace (from X-Workspace-Id header)
 */
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const workspaceId = req.headers['x-workspace-id'] as string | undefined;

    if (!workspaceId) {
      return res.status(400).json({ error: 'X-Workspace-Id header is required' });
    }

    // Verify user has access to this workspace
    const userId = req.user?.id;
    if (userId) {
      try {
        await resolveActiveWorkspace({ userId, workspaceId });
      } catch (error) {
        return res.status(403).json({ error: 'User does not have access to this workspace' });
      }
    }

    const members = await teamMembersService.getMembers(workspaceId);
    res.json({ data: members });
  })
);

/**
 * GET /api/team-members/:id
 * Get a single team member by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const member = await teamMembersService.getById(id);

    if (!member) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    res.json({ data: member });
  })
);

/**
 * PATCH /api/team-members/:id/role
 * Update a team member's role in the active workspace
 */
router.patch(
  '/:id/role',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { role } = req.body;
    const workspaceId = req.headers['x-workspace-id'] as string | undefined;

    if (!role || (role !== 'admin' && role !== 'sdr')) {
      return res.status(400).json({ error: 'Valid role (admin or sdr) is required' });
    }

    if (!workspaceId) {
      return res.status(400).json({ error: 'X-Workspace-Id header is required' });
    }

    // Verify user has access to this workspace
    const userId = req.user?.id;
    if (userId) {
      try {
        await resolveActiveWorkspace({ userId, workspaceId });
      } catch (error) {
        return res.status(403).json({ error: 'User does not have access to this workspace' });
      }
    }

    await teamMembersService.updateRole(id, workspaceId, role);
    res.json({ message: 'Role updated successfully' });
  })
);

/**
 * POST /api/team-members
 * Create a new team member
 */
router.post(
  '/',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id || req.headers['x-user-id'] as string;
    const { email, full_name, role = 'sdr' } = req.body;

    if (!email || !full_name) {
      return res.status(400).json({ error: 'Email and full_name are required' });
    }

    if (role !== 'admin' && role !== 'sdr') {
      return res.status(400).json({ error: 'Role must be either admin or sdr' });
    }

    // Get workspace ID and admin info for the current user
    let workspaceId: string | undefined;
    let adminName: string | undefined;
    if (userId) {
      try {
        const { workspaceId: resolvedWorkspaceId } = await resolveActiveWorkspace({ userId });
        workspaceId = resolvedWorkspaceId;
      } catch (error) {
        // User doesn't belong to any workspace
        return res.status(400).json({ 
          error: 'No active workspace found. Please ensure you belong to a workspace.' 
        });
      }
      
      // Get admin name from profile
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .single();
      adminName = profile?.full_name;
    } else {
      return res.status(401).json({ error: 'Authentication required to create team members.' });
    }

    try {
      const member = await teamMembersService.createMember(
        email, 
        full_name, 
        role, 
        workspaceId,
        userId,
        adminName
      );
      res.status(201).json({ data: member });
    } catch (error: any) {
      // Map known errors to 400, others go to error handler (500)
      if (error.message?.includes('No active workspace') || 
          error.message?.includes('Admin user ID is required')) {
        return res.status(400).json({ error: error.message });
      }
      // Re-throw to let asyncHandler catch it and return 500
      throw error;
    }
  })
);

/**
 * PATCH /api/team-members/:id
 * Update a team member's profile
 */
router.patch(
  '/:id',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { full_name, email } = req.body;

    if (!full_name && !email) {
      return res.status(400).json({ error: 'At least one field (full_name or email) is required' });
    }

    const member = await teamMembersService.updateMember(id, { full_name, email });
    res.json({ data: member });
  })
);

/**
 * DELETE /api/team-members/:id
 * Delete a team member (removes workspace membership only)
 */
router.delete(
  '/:id',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id || req.headers['x-user-id'] as string;

    // Get workspace ID for the current user
    let workspaceId: string | undefined;
    if (userId) {
      try {
        const { workspaceId: resolvedWorkspaceId } = await resolveActiveWorkspace({ userId });
        workspaceId = resolvedWorkspaceId;
      } catch (error) {
        return res.status(400).json({ 
          error: 'No active workspace found. Cannot delete team member without workspace context.' 
        });
      }
    } else {
      return res.status(401).json({ error: 'Authentication required to delete team members.' });
    }

    if (!workspaceId) {
      return res.status(400).json({ error: 'Workspace ID is required to delete team member.' });
    }

    await teamMembersService.deleteMember(id, workspaceId);
    res.json({ message: 'Team member deleted successfully' });
  })
);

/**
 * POST /api/team-members/:id/resend-invitation
 * Resend invitation email to a team member
 */
router.post(
  '/:id/resend-invitation',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id || req.headers['x-user-id'] as string;

    // Get admin info
    let adminName: string | undefined;
    if (userId) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .single();
      adminName = profile?.full_name;
    }

    const result = await teamMembersService.resendInvitation(id, userId, adminName);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  })
);

/**
 * GET /api/team-members/:id/invitation-link
 * Get invitation link for a team member
 */
router.get(
  '/:id/invitation-link',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    
    const result = await teamMembersService.getInvitationLink(id);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  })
);

export default router;
