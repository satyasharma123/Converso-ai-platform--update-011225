import { Router, Request, Response } from 'express';
import { sendSseEvent } from '../utils/sse';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/test/simulate-linkedin-message
 * Simulate a LinkedIn webhook event for testing SSE notifications
 */
router.post('/simulate-linkedin-message', async (req: Request, res: Response) => {
  const { conversation_id, chat_id } = req.body;

  if (!conversation_id) {
    return res.status(400).json({ error: 'conversation_id is required' });
  }

  logger.info('[Test] Simulating LinkedIn message event', { conversation_id, chat_id });

  // Emit SSE event to all connected clients
  sendSseEvent('linkedin_message', {
    conversation_id,
    chat_id: chat_id || 'test-chat-id',
    account_id: 'test-account-id',
    timestamp: new Date().toISOString(),
  });

  res.json({ 
    success: true, 
    message: 'SSE event emitted',
    event_data: {
      conversation_id,
      chat_id: chat_id || 'test-chat-id',
    }
  });
});

export default router;




