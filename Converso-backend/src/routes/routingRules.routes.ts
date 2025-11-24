import { Router, Request, Response } from 'express';
import { routingRulesService } from '../services/routingRules';
import { asyncHandler } from '../utils/errorHandler';
import { optionalAuth } from '../middleware/auth';

const router = Router();

/**
 * GET /api/routing-rules
 * Get all routing rules
 */
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const client = req.supabaseClient || undefined;
    const rules = await routingRulesService.getRules(client);
    res.json({ data: rules });
  })
);

/**
 * GET /api/routing-rules/:id
 * Get a single routing rule by ID
 */
router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const rule = await routingRulesService.getById(id);

    if (!rule) {
      return res.status(404).json({ error: 'Routing rule not found' });
    }

    res.json({ data: rule });
  })
);

/**
 * POST /api/routing-rules
 * Create a new routing rule
 */
router.post(
  '/',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const {
      name,
      condition_field,
      condition_operator,
      condition_value,
      action_type,
      action_value,
      is_active,
    } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Rule name is required' });
    }

    if (!condition_field || !condition_operator || !condition_value) {
      return res.status(400).json({ error: 'Condition field, operator, and value are required' });
    }

    if (!action_type || !action_value) {
      return res.status(400).json({ error: 'Action type and value are required' });
    }

    // Use user's JWT client if available, otherwise admin client will be used
    const client = req.supabaseClient || undefined;
    const rule = await routingRulesService.createRule({
      name,
      condition_field,
      condition_operator,
      condition_value,
      action_type,
      action_value,
      is_active: is_active !== undefined ? is_active : true,
    }, client);

    res.status(201).json({ data: rule });
  })
);

/**
 * PUT /api/routing-rules/:id
 * Update a routing rule
 */
router.put(
  '/:id',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const {
      name,
      condition_field,
      condition_operator,
      condition_value,
      action_type,
      action_value,
      is_active,
    } = req.body;

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (condition_field !== undefined) updates.condition_field = condition_field;
    if (condition_operator !== undefined) updates.condition_operator = condition_operator;
    if (condition_value !== undefined) updates.condition_value = condition_value;
    if (action_type !== undefined) updates.action_type = action_type;
    if (action_value !== undefined) updates.action_value = action_value;
    if (is_active !== undefined) updates.is_active = is_active;

    const client = req.supabaseClient || undefined;
    const rule = await routingRulesService.updateRule(id, updates, client);
    res.json({ data: rule });
  })
);

/**
 * DELETE /api/routing-rules/:id
 * Delete a routing rule
 */
router.delete(
  '/:id',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const client = req.supabaseClient || undefined;
    await routingRulesService.deleteRule(id, client);
    res.json({ message: 'Routing rule deleted successfully' });
  })
);

export default router;

