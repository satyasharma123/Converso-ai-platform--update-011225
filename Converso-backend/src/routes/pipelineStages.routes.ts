import { Router, Request, Response } from 'express';
import { pipelineStagesService } from '../services/pipelineStages';
import { asyncHandler } from '../utils/errorHandler';

const router = Router();

/**
 * GET /api/pipeline-stages
 * Get all pipeline stages
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const stages = await pipelineStagesService.getStages();
    res.json({ data: stages });
  })
);

/**
 * POST /api/pipeline-stages
 * Create a new pipeline stage
 */
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { name, description, display_order } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Stage name is required' });
    }

    const stage = await pipelineStagesService.createStage({
      name,
      description,
      display_order: display_order || 0,
    });

    res.status(201).json({ data: stage });
  })
);

/**
 * PUT /api/pipeline-stages/:id
 * Update a pipeline stage
 */
router.put(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, description, display_order } = req.body;

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (display_order !== undefined) updates.display_order = display_order;

    const stage = await pipelineStagesService.updateStage(id, updates);
    res.json({ data: stage });
  })
);

/**
 * DELETE /api/pipeline-stages/:id
 * Delete a pipeline stage
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await pipelineStagesService.deleteStage(id);
    res.json({ message: 'Pipeline stage deleted successfully' });
  })
);

export default router;
