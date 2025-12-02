import { Router, Request, Response } from 'express';
import { teamMembersService } from '../services/teamMembers';
import { asyncHandler } from '../utils/errorHandler';
import { optionalAuth, AuthenticatedRequest } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';

const router = Router();

/**
 * GET /api/team-members
 * Get all team members (filtered by workspace if user is authenticated)
 */
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id || req.headers['x-user-id'] as string;
    const members = await teamMembersService.getMembers(userId);
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
 * Update a team member's role
 */
router.patch(
  '/:id/role',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || (role !== 'admin' && role !== 'sdr')) {
      return res.status(400).json({ error: 'Valid role (admin or sdr) is required' });
    }

    await teamMembersService.updateRole(id, role);
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
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('workspace_id, full_name')
        .eq('id', userId)
        .single();
      workspaceId = profile?.workspace_id;
      adminName = profile?.full_name;
    }

    const member = await teamMembersService.createMember(
      email, 
      full_name, 
      role, 
      workspaceId,
      userId,
      adminName
    );
    res.status(201).json({ data: member });
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
 * Delete a team member
 */
router.delete(
  '/:id',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    await teamMembersService.deleteMember(id);
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
