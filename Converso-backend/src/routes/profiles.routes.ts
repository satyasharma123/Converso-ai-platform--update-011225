import { Router, Request, Response } from 'express';
import { profilesService } from '../services/profiles';
import { asyncHandler } from '../utils/errorHandler';
import { optionalAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/profiles/:userId
 * Get a user's profile
 */
router.get(
  '/:userId',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;
    const client = req.supabaseClient || undefined;
    const profile = await profilesService.getProfile(userId, client);

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({ data: profile });
  })
);

/**
 * PUT /api/profiles/:userId
 * Update a user's profile
 */
router.put(
  '/:userId',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;
    const { full_name, avatar_url } = req.body;

    // Only allow users to update their own profile
    const requestUserId = req.user?.id || req.headers['x-user-id'] as string;
    if (requestUserId !== userId) {
      return res.status(403).json({ error: 'You can only update your own profile' });
    }

    const updates: any = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;

    // Use user's JWT client if available (has their auth token), otherwise admin client
    const client = req.supabaseClient || undefined;
    const profile = await profilesService.updateProfile(userId, updates, client);
    res.json({ data: profile });
  })
);

export default router;

