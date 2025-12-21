import { Router, Response } from 'express';
import { conversationsService } from '../services/conversations';
import { asyncHandler } from '../utils/errorHandler';
import { optionalAuth, AuthenticatedRequest } from '../middleware/auth';
import { getUserWorkspaceId } from '../utils/workspace';

const router = Router();

/**
 * GET /api/pipeline/email-senders
 * Get email senders grouped by sender_email for Sales Pipeline
 * Returns one SenderPipelineItem per unique sender_email
 */
router.get(
  '/email-senders',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id || req.headers['x-user-id'] as string;
    const userRole = req.user?.role || req.headers['x-user-role'] as 'admin' | 'sdr' | null || null;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Get user's workspace
    const workspaceId = await getUserWorkspaceId(userId);
    if (!workspaceId) {
      return res.status(400).json({ error: 'Workspace ID is required' });
    }

    const senderItems = await conversationsService.getEmailSendersPipelineItems(
      userId,
      userRole,
      workspaceId
    );

    res.json({ data: senderItems });
  })
);

/**
 * PATCH /api/pipeline/email-senders/stage
 * Update stage for all email conversations with a given sender_email
 * Phase-3: Bulk stage update
 */
router.patch(
  '/email-senders/stage',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id || req.headers['x-user-id'] as string;
    const userRole = req.user?.role || req.headers['x-user-role'] as 'admin' | 'sdr' | null || null;
    const { sender_email, stage_id } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (!sender_email || typeof sender_email !== 'string') {
      return res.status(400).json({ error: 'sender_email is required and must be a string' });
    }

    if (stage_id !== null && stage_id !== undefined && typeof stage_id !== 'string') {
      return res.status(400).json({ error: 'stage_id must be a string or null' });
    }

    // Get user's workspace
    const workspaceId = await getUserWorkspaceId(userId);
    if (!workspaceId) {
      return res.status(400).json({ error: 'Workspace ID is required' });
    }

    const result = await conversationsService.updateEmailSenderStage(
      sender_email,
      stage_id || null,
      userId,
      userRole,
      workspaceId
    );

    res.json({
      success: true,
      updated_count: result.updated_count,
    });
  })
);

/**
 * PATCH /api/pipeline/email-senders/assign
 * Assign SDR for all email conversations with a given sender_email
 * Phase-3: Bulk assignment
 */
router.patch(
  '/email-senders/assign',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id || req.headers['x-user-id'] as string;
    const userRole = req.user?.role || req.headers['x-user-role'] as 'admin' | 'sdr' | null || null;
    const { sender_email, assigned_to } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (!sender_email || typeof sender_email !== 'string') {
      return res.status(400).json({ error: 'sender_email is required and must be a string' });
    }

    if (assigned_to !== null && assigned_to !== undefined && typeof assigned_to !== 'string') {
      return res.status(400).json({ error: 'assigned_to must be a string or null' });
    }

    // Get user's workspace
    const workspaceId = await getUserWorkspaceId(userId);
    if (!workspaceId) {
      return res.status(400).json({ error: 'Workspace ID is required' });
    }

    const result = await conversationsService.updateEmailSenderAssignment(
      sender_email,
      assigned_to || null,
      userId,
      userRole,
      workspaceId
    );

    res.json({
      success: true,
      updated_count: result.updated_count,
    });
  })
);

export default router;
