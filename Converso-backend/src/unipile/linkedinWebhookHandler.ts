import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { syncChatIncremental } from './linkedinSync.4actions';

interface WebhookEvent {
  type: 'message.created' | 'message.updated' | 'chat.updated' | string;
  chat_id?: string;
  account_id?: string;
  last_message_timestamp?: string;
}

export async function handleLinkedInWebhook(req: Request, res: Response) {
  const event = req.body as WebhookEvent;

  if (!event.chat_id || !event.account_id) {
    logger.warn('[LinkedIn Webhook] Missing chat_id or account_id');
    return res.status(400).json({ error: 'Missing chat_id or account_id' });
  }

  logger.info('[LinkedIn Webhook] Received event', event);

  try {
    switch (event.type) {
      case 'message.created':
      case 'message.updated':
      case 'chat.updated': {
        await syncChatIncremental(event.account_id, event.chat_id, event.last_message_timestamp || undefined);
        break;
      }
      default:
        logger.warn(`[LinkedIn Webhook] Unknown event type ${event.type}`);
    }

    return res.json({ status: 'ok' });
  } catch (err) {
    logger.error('[LinkedIn Webhook] Failed processing event', err);
    return res.status(500).json({ error: 'Failed processing webhook' });
  }
}
