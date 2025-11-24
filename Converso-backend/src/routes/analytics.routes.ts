import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { asyncHandler } from '../utils/errorHandler';
import { optionalAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/analytics/overview
 * Get analytics overview
 */
router.get(
  '/overview',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id || req.headers['x-user-id'] as string;
    const userRole = req.user?.role || req.headers['x-user-role'] as 'admin' | 'sdr' | null;

    // Build base query
    let conversationsQuery = supabase
      .from('conversations')
      .select('status, conversation_type, is_read', { count: 'exact', head: false });

    // Filter by user role
    if (userRole === 'sdr' && userId) {
      conversationsQuery = conversationsQuery.eq('assigned_to', userId);
    }

    const { data: conversations, error } = await conversationsQuery;

    if (error) {
      throw error;
    }

    // Calculate statistics
    const total = conversations?.length || 0;
    const byStatus = conversations?.reduce((acc: any, conv: any) => {
      acc[conv.status] = (acc[conv.status] || 0) + 1;
      return acc;
    }, {}) || {};

    const byType = conversations?.reduce((acc: any, conv: any) => {
      acc[conv.conversation_type] = (acc[conv.conversation_type] || 0) + 1;
      return acc;
    }, {}) || {};

    const unread = conversations?.filter((c: any) => !c.is_read).length || 0;

    // Get messages count
    const { count: messagesCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true });

    res.json({
      data: {
        conversations: {
          total,
          unread,
          byStatus,
          byType,
        },
        messages: {
          total: messagesCount || 0,
        },
      },
    });
  })
);

/**
 * GET /api/analytics/conversion-funnel
 * Get conversion funnel data
 */
router.get(
  '/conversion-funnel',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select('status');

    if (error) {
      throw error;
    }

    const funnel = {
      new: conversations?.filter((c: any) => c.status === 'new').length || 0,
      engaged: conversations?.filter((c: any) => c.status === 'engaged').length || 0,
      qualified: conversations?.filter((c: any) => c.status === 'qualified').length || 0,
      converted: conversations?.filter((c: any) => c.status === 'converted').length || 0,
      not_interested: conversations?.filter((c: any) => c.status === 'not_interested').length || 0,
    };

    res.json({ data: funnel });
  })
);

/**
 * GET /api/analytics/response-time
 * Get average response time statistics
 */
router.get(
  '/response-time',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // This is a placeholder - would need more complex querying
    // to calculate actual response times between messages
    res.json({
      data: {
        average: '2.5 hours',
        median: '1.8 hours',
        p95: '6.2 hours',
      },
    });
  })
);

export default router;

