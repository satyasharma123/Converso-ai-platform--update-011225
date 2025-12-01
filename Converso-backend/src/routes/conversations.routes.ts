import { Router, Request, Response } from 'express';
import { conversationsService } from '../services/conversations';
import { asyncHandler } from '../utils/errorHandler';
import { optionalAuth, AuthenticatedRequest } from '../middleware/auth';
import { transformConversation, transformConversations } from '../utils/transformers';

const router = Router();

/**
 * GET /api/conversations
 * Get all conversations with optional filtering
 */
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id || req.headers['x-user-id'] as string || req.query.userId as string;
    const userRole = req.user?.role || req.headers['x-user-role'] as 'admin' | 'sdr' | null || 
                     (req.query.userRole as 'admin' | 'sdr' | null) || null;
    const type = req.query.type as 'email' | 'linkedin' | undefined;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const conversations = await conversationsService.getConversations(userId, userRole, type);
    res.json({ data: transformConversations(conversations) });
  })
);

/**
 * GET /api/conversations/:id
 * Get a single conversation by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const conversation = await conversationsService.getById(id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ data: transformConversation(conversation) });
  })
);

/**
 * PATCH /api/conversations/:id/assign
 * Assign a conversation to an SDR
 */
router.patch(
  '/:id/assign',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { sdrId } = req.body;

    await conversationsService.assignConversation(id, sdrId || null);
    res.json({ message: 'Conversation assigned successfully' });
  })
);

/**
 * PATCH /api/conversations/:id/status
 * Update conversation status
 */
router.patch(
  '/:id/status',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['new', 'engaged', 'qualified', 'converted', 'not_interested'].includes(status)) {
      return res.status(400).json({ error: 'Valid status is required' });
    }

    await conversationsService.updateStatus(id, status);
    res.json({ message: 'Status updated successfully' });
  })
);

/**
 * PATCH /api/conversations/:id/read
 * Mark conversation as read/unread
 */
router.patch(
  '/:id/read',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { isRead } = req.body;

    if (typeof isRead !== 'boolean') {
      return res.status(400).json({ error: 'isRead must be a boolean' });
    }

    await conversationsService.toggleRead(id, isRead);
    res.json({ message: 'Read status updated successfully' });
  })
);

/**
 * PATCH /api/conversations/:id/stage
 * Update conversation pipeline stage
 */
router.patch(
  '/:id/stage',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { stageId } = req.body;

    await conversationsService.updateStage(id, stageId || null);
    res.json({ message: 'Stage updated successfully' });
  })
);

/**
 * PATCH /api/conversations/:id/favorite
 * Toggle favorite flag on a conversation
 */
router.patch(
  '/:id/favorite',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { isFavorite } = req.body;

    if (typeof isFavorite !== 'boolean') {
      return res.status(400).json({ error: 'isFavorite must be a boolean' });
    }

    await conversationsService.toggleFavorite(id, isFavorite);
    res.json({ message: 'Favorite status updated successfully' });
  })
);

/**
 * DELETE /api/conversations/:id
 * Delete a conversation (and cascaded messages)
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    await conversationsService.deleteConversation(id);
    res.json({ message: 'Conversation deleted successfully' });
  })
);

export default router;

