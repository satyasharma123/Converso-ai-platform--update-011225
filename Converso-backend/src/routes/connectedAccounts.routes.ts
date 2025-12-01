import { Router, Request, Response } from 'express';
import { connectedAccountsService } from '../services/connectedAccounts';
import { asyncHandler } from '../utils/errorHandler';
import { optionalAuth, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/connected-accounts
 * Get all connected accounts (optionally filtered by user)
 */
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.query.userId as string | undefined;
    const client = req.supabaseClient || undefined;
    const accounts = await connectedAccountsService.getAccounts(userId, client);
    res.json({ data: accounts });
  })
);

/**
 * GET /api/connected-accounts/:id
 * Get a single connected account by ID
 */
router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const client = req.supabaseClient || undefined;
    const account = await connectedAccountsService.getById(id, client);

    if (!account) {
      return res.status(404).json({ error: 'Connected account not found' });
    }

    res.json({ data: account });
  })
);

/**
 * POST /api/connected-accounts
 * Create a new connected account
 */
router.post(
  '/',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { account_name, account_email, account_type, is_active, user_id } = req.body;

    if (!account_name || account_name.trim().length === 0) {
      return res.status(400).json({ error: 'Account name is required' });
    }

    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Use user's JWT client if available (has their auth token), otherwise admin client
    const client = req.supabaseClient || undefined;
    const account = await connectedAccountsService.createAccount({
      account_name,
      account_email: account_email || null,
      account_type: account_type || 'email',
      is_active: is_active !== undefined ? is_active : true,
      user_id,
    }, client);

    res.status(201).json({ data: account });
  })
);

/**
 * PUT /api/connected-accounts/:id
 * Update a connected account
 */
router.put(
  '/:id',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { account_name, account_email, account_type, is_active, user_id } = req.body;

    const updates: any = {};
    if (account_name !== undefined) updates.account_name = account_name;
    if (account_email !== undefined) updates.account_email = account_email;
    if (account_type !== undefined) updates.account_type = account_type;
    if (is_active !== undefined) updates.is_active = is_active;
    if (user_id !== undefined) updates.user_id = user_id;

    const client = req.supabaseClient || undefined;
    const account = await connectedAccountsService.updateAccount(id, updates, client);
    res.json({ data: account });
  })
);

/**
 * DELETE /api/connected-accounts/:id
 * Delete a connected account and all associated data (conversations, messages)
 */
router.delete(
  '/:id',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'Account ID is required' });
    }
    
    try {
      logger.info(`Deleting connected account: ${id}`);
      
      // Always use admin client for deletion to ensure cascade deletion works
      // This bypasses RLS and ensures all related data is deleted
      await connectedAccountsService.deleteAccount(id);
      
      logger.info(`Successfully deleted connected account: ${id}`);
      
      res.json({ 
        message: 'Connected account and all associated data deleted successfully',
        deleted: {
          account: true,
          conversations: true,
          messages: true
        }
      });
    } catch (error: any) {
      logger.error('Error deleting connected account:', {
        accountId: id,
        error: error.message,
        stack: error.stack,
        details: error,
      });
      
      const errorMessage = error?.message || 'Failed to delete connected account';
      const statusCode = error?.statusCode || 500;
      
      res.status(statusCode).json({ 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  })
);

/**
 * PATCH /api/connected-accounts/:id/toggle
 * Toggle account active status
 */
router.patch(
  '/:id/toggle',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be a boolean' });
    }

    const client = req.supabaseClient || undefined;
    await connectedAccountsService.toggleStatus(id, isActive, client);
    res.json({ message: 'Account status updated successfully' });
  })
);

export default router;
