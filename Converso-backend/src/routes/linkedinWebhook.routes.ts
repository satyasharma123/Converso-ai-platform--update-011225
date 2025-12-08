import { Router, Request, Response, NextFunction } from 'express';
import { handleLinkedInWebhook, verifyWebhookSignature } from '../unipile/linkedinWebhook.4actions';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Webhook signature verification middleware
 */
function webhookAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const isValid = verifyWebhookSignature(req);
  
  if (!isValid) {
    logger.warn('[Webhook] Invalid signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  next();
}

/**
 * POST /api/webhooks/linkedin
 * Receive LinkedIn webhook events from Unipile
 */
router.post('/', webhookAuthMiddleware, handleLinkedInWebhook);

export default router;



