import { Router, Request, Response } from 'express';
import { teamMembersService } from '../services/teamMembers';
import { asyncHandler } from '../utils/errorHandler';

const router = Router();

/**
 * GET /api/team-members
 * Get all team members
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const members = await teamMembersService.getMembers();
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
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || (role !== 'admin' && role !== 'sdr')) {
      return res.status(400).json({ error: 'Valid role (admin or sdr) is required' });
    }

    await teamMembersService.updateRole(id, role);
    res.json({ message: 'Role updated successfully' });
  })
);

export default router;
