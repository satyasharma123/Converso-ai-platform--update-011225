import { Router, Request, Response, NextFunction } from 'express';
import { handleLinkedInWebhook } from '../unipile/linkedinWebhook.4actions';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Webhook logging middleware - logs incoming webhook details for debugging
 */
function webhookLoggingMiddleware(req: Request, res: Response, next: NextFunction) {
  // Log all headers to understand what Unipile is sending
  logger.info('[Webhook] Incoming request', {
    headers: {
      'x-unipile-signature': req.headers['x-unipile-signature'],
      'x-webhook-signature': req.headers['x-webhook-signature'],
      'authorization': req.headers['authorization'] ? '[REDACTED]' : undefined,
      'content-type': req.headers['content-type'],
    },
    bodyPreview: JSON.stringify(req.body).substring(0, 200),
  });
  
  next();
}

/**
 * POST /api/linkedin/webhook
 * Receive LinkedIn webhook events from Unipile
 * 
 * Note: Signature verification temporarily disabled to debug 401 errors.
 * TODO: Re-enable once we confirm the correct signature header and algorithm from Unipile.
 */
router.post('/', webhookLoggingMiddleware, handleLinkedInWebhook);

export default router;



