import { Router, Request, Response } from 'express';
import { emailTemplatesService } from '../services/emailTemplates';
import { asyncHandler } from '../utils/errorHandler';
import { optionalAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/email-templates
 * Get all email templates for the user's workspace
 */
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id || req.headers['x-user-id'] as string || req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const templates = await emailTemplatesService.getEmailTemplates(userId);
    res.json({ data: templates });
  })
);

/**
 * GET /api/email-templates/:id
 * Get a single email template by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const template = await emailTemplatesService.getEmailTemplateById(id);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ data: template });
  })
);

/**
 * POST /api/email-templates
 * Create a new email template
 */
router.post(
  '/',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id || req.headers['x-user-id'] as string;
    const { title, content, category, shortcut } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (!title || !content || !category) {
      return res.status(400).json({ error: 'Title, content, and category are required' });
    }

    const template = await emailTemplatesService.createEmailTemplate(userId, {
      title,
      content,
      category,
      shortcut,
    });

    res.status(201).json({ data: template });
  })
);

/**
 * PATCH /api/email-templates/:id
 * Update an email template
 */
router.patch(
  '/:id',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { title, content, category, shortcut } = req.body;

    const template = await emailTemplatesService.updateEmailTemplate(id, {
      title,
      content,
      category,
      shortcut,
    });

    res.json({ data: template });
  })
);

/**
 * DELETE /api/email-templates/:id
 * Delete an email template
 */
router.delete(
  '/:id',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    await emailTemplatesService.deleteEmailTemplate(id);
    res.json({ message: 'Template deleted successfully' });
  })
);

export default router;

