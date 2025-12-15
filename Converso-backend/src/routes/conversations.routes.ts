import { Router, Request, Response } from 'express';
import { conversationsService } from '../services/conversations';
import { asyncHandler } from '../utils/errorHandler';
import { optionalAuth, AuthenticatedRequest } from '../middleware/auth';
import { transformConversation, transformConversations } from '../utils/transformers';
import { syncChatIncremental } from '../unipile/linkedinSync.4actions';
import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../utils/logger';

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
 * POST /api/conversations/bulk-reassign
 * Bulk reassign conversations from one SDR to another
 */
router.post(
  '/bulk-reassign',
  asyncHandler(async (req: Request, res: Response) => {
    const { fromSdrId, toSdrId } = req.body;

    if (!fromSdrId) {
      return res.status(400).json({ error: 'fromSdrId is required' });
    }

    const result = await conversationsService.bulkReassignConversations(
      fromSdrId,
      toSdrId || null
    );
    res.json({ 
      message: `Successfully reassigned ${result.count} conversation(s)`,
      count: result.count
    });
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

/**
 * PATCH /api/conversations/:id/profile
 * Update lead profile information (name, email, mobile, company, location)
 */
router.patch(
  '/:id/profile',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { sender_name, sender_email, mobile, company_name, location } = req.body;

    const updates: {
      sender_name?: string;
      sender_email?: string;
      mobile?: string;
      company_name?: string;
      location?: string;
    } = {};

    if (sender_name !== undefined) updates.sender_name = sender_name;
    if (sender_email !== undefined) updates.sender_email = sender_email;
    if (mobile !== undefined) updates.mobile = mobile;
    if (company_name !== undefined) updates.company_name = company_name;
    if (location !== undefined) updates.location = location;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'At least one field must be provided' });
    }

    await conversationsService.updateLeadProfile(id, updates);
    res.json({ message: 'Lead profile updated successfully' });
  })
);

/**
 * POST /api/conversations/:id/sync
 * Sync/refresh messages for a LinkedIn conversation from Unipile
 */
router.post(
  '/:id/sync',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    logger.info(`[Conversation Sync] Starting sync for conversation ${id}`);

    // Get the conversation to find chat_id and account info
    const { data: conversation, error: convError } = await supabaseAdmin
      .from('conversations')
      .select('id, chat_id, received_on_account_id, conversation_type')
      .eq('id', id)
      .single();

    if (convError || !conversation) {
      logger.error(`[Conversation Sync] Conversation not found: ${id}`);
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (conversation.conversation_type !== 'linkedin') {
      return res.status(400).json({ error: 'Only LinkedIn conversations can be synced' });
    }

    if (!conversation.chat_id) {
      return res.status(400).json({ error: 'Conversation missing chat_id' });
    }

    // Get the unipile account ID from connected_accounts
    const { data: account, error: accountError } = await supabaseAdmin
      .from('connected_accounts')
      .select('unipile_account_id')
      .eq('id', conversation.received_on_account_id)
      .single();

    if (accountError || !account?.unipile_account_id) {
      logger.error(`[Conversation Sync] Connected account not found for ${conversation.received_on_account_id}`);
      return res.status(400).json({ error: 'Connected account not found or missing Unipile account ID' });
    }

    try {
      // Sync messages for this chat
      const result = await syncChatIncremental(
        account.unipile_account_id,
        conversation.chat_id
      );

      logger.info(`[Conversation Sync] Sync completed for conversation ${id}`, result);
      
      // Send SSE event to notify frontend
      const { sendSseEvent } = await import('../utils/sse');
      
      // Get the latest message to check if it's from lead
      const { data: latestMsg } = await supabaseAdmin
        .from('messages')
        .select('is_from_lead')
        .eq('conversation_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      sendSseEvent('linkedin_message', {
        conversation_id: id,
        chat_id: conversation.chat_id,
        account_id: account.unipile_account_id,
        timestamp: new Date().toISOString(),
        is_from_lead: latestMsg?.is_from_lead ?? true, // Default to true for safety
      });
      
      res.json({ 
        message: 'Messages synced successfully',
        ...result
      });
    } catch (err: any) {
      logger.error(`[Conversation Sync] Failed to sync conversation ${id}`, err);
      return res.status(500).json({ error: err.message || 'Failed to sync messages' });
    }
  })
);

export default router;

