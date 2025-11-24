import * as pipelineStagesApi from '../api/pipelineStages';
import type { PipelineStage } from '../types';

/**
 * Service layer for pipeline stages - contains business logic
 */

export const pipelineStagesService = {
  /**
   * Get all pipeline stages ordered by display order
   */
  async getStages(): Promise<PipelineStage[]> {
    return pipelineStagesApi.getPipelineStages();
  },

  /**
   * Create a new pipeline stage
   */
  async createStage(
    stage: Omit<PipelineStage, 'id' | 'created_at' | 'updated_at'>
  ): Promise<PipelineStage> {
    if (!stage.name || stage.name.trim().length === 0) {
      throw new Error('Stage name is required');
    }

    return pipelineStagesApi.createPipelineStage(stage);
  },

  /**
   * Update an existing pipeline stage
   */
  async updateStage(
    stageId: string,
    updates: Partial<Omit<PipelineStage, 'id' | 'created_at'>>
  ): Promise<PipelineStage> {
    if (!stageId) {
      throw new Error('Stage ID is required');
    }

    return pipelineStagesApi.updatePipelineStage(stageId, updates);
  },

  /**
   * Delete a pipeline stage
   */
  async deleteStage(stageId: string): Promise<void> {
    if (!stageId) {
      throw new Error('Stage ID is required');
    }

    return pipelineStagesApi.deletePipelineStage(stageId);
  },
};

