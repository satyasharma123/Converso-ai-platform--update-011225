import { Router } from 'express';
import { addSseClient } from '../utils/sse';

const router = Router();

// SSE stream for real-time notifications (new messages, unread updates)
router.get('/stream', (req, res) => {
  addSseClient(req, res);
});

export default router;

