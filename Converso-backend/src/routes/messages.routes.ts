import { Router, Request, Response } from 'express';
import { messagesService } from '../services/messages';
import { asyncHandler } from '../utils/errorHandler';
import { transformMessages, transformMessage } from '../utils/transformers';

const router = Router();

/**
 * GET /api/messages/conversation/:conversationId
 * Get all messages for a conversation
 */
router.get(
  '/conversation/:conversationId',
  asyncHandler(async (req: Request, res: Response) => {
    const { conversationId } = req.params;
    const messages = await messagesService.getMessages(conversationId);
    res.json({ data: transformMessages(messages) });
  })
);

/**
 * POST /api/messages
 * Send a new message
 */
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { conversationId, content } = req.body;
    const userId = req.headers['x-user-id'] as string || req.body.userId;

    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation ID is required' });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    await messagesService.sendMessage(conversationId, userId, content);
    res.status(201).json({ message: 'Message sent successfully' });
  })
);

/**
 * GET /api/messages/:id
 * Get a single message by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const message = await messagesService.getById(id);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json({ data: transformMessage(message) });
  })
);

export default router;
