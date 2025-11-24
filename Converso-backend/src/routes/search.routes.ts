import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { asyncHandler } from '../utils/errorHandler';
import { optionalAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/search/conversations
 * Search conversations by keyword
 */
router.get(
  '/conversations',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { q, type, status } = req.query;
    const userId = req.user?.id || req.headers['x-user-id'] as string;
    const userRole = req.user?.role || req.headers['x-user-role'] as 'admin' | 'sdr' | null;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query (q) is required' });
    }

    let query = supabase
      .from('conversations')
      .select(`
        *,
        received_account:connected_accounts(
          account_name,
          account_email,
          account_type
        )
      `)
      .or(`sender_name.ilike.%${q}%,sender_email.ilike.%${q}%,subject.ilike.%${q}%,preview.ilike.%${q}%`)
      .order('last_message_at', { ascending: false });

    if (type) {
      query = query.eq('conversation_type', type);
    }

    if (status) {
      query = query.eq('status', status);
    }

    // SDRs only see their assigned conversations
    if (userRole === 'sdr' && userId) {
      query = query.eq('assigned_to', userId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    res.json({ data: data || [] });
  })
);

/**
 * GET /api/search/messages
 * Search messages by keyword
 */
router.get(
  '/messages',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { q, conversationId } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query (q) is required' });
    }

    let query = supabase
      .from('messages')
      .select('*')
      .ilike('content', `%${q}%`)
      .order('created_at', { ascending: false });

    if (conversationId) {
      query = query.eq('conversation_id', conversationId as string);
    }

    const { data, error } = await query.limit(50);

    if (error) {
      throw error;
    }

    res.json({ data: data || [] });
  })
);

export default router;

