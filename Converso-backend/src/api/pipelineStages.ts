import { supabaseAdmin } from '../lib/supabase';
import type { PipelineStage } from '../types';

/**
 * API module for pipeline stage-related database queries
 */

export async function getPipelineStages(): Promise<PipelineStage[]> {
  // Use admin client to bypass RLS - stages should be visible to all authenticated users
  const { data, error } = await supabaseAdmin
    .from('pipeline_stages')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) {
    console.error('[getPipelineStages] Error fetching stages:', error);
    throw error;
  }
  
  if (!data || data.length === 0) {
    console.warn('[getPipelineStages] No pipeline stages found in database. Run the migration to seed default stages.');
  }
  
  return (data || []) as PipelineStage[];
}

export async function createPipelineStage(
  stage: Omit<PipelineStage, 'id' | 'created_at' | 'updated_at'>
): Promise<PipelineStage> {
  const { data, error } = await supabaseAdmin
    .from('pipeline_stages')
    .insert(stage)
    .select()
    .single();

  if (error) throw error;
  return data as PipelineStage;
}

export async function updatePipelineStage(
  stageId: string,
  updates: Partial<Omit<PipelineStage, 'id' | 'created_at'>>
): Promise<PipelineStage> {
  const { data, error } = await supabaseAdmin
    .from('pipeline_stages')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', stageId)
    .select()
    .single();

  if (error) throw error;
  return data as PipelineStage;
}

export async function deletePipelineStage(stageId: string): Promise<void> {
  // First, get all pipeline stages to find the previous stage
  const { data: stages } = await supabaseAdmin
    .from('pipeline_stages')
    .select('id, display_order')
    .order('display_order', { ascending: true });

  if (stages) {
    // Find the stage being deleted
    const deletingStageIndex = stages.findIndex(s => s.id === stageId);
    
    if (deletingStageIndex > -1) {
      // Find the previous stage (one before the deleting stage)
      const previousStage = deletingStageIndex > 0 ? stages[deletingStageIndex - 1] : null;
      const targetStageId = previousStage?.id || null;

      // If no previous stage, use the next stage if available
      const fallbackStageId = targetStageId || (stages[deletingStageIndex + 1]?.id || null);

      // Reassign all leads from the deleting stage to the target stage
      const { error: updateError } = await supabaseAdmin
        .from('conversations')
        .update({ custom_stage_id: fallbackStageId })
        .eq('custom_stage_id', stageId);

      if (updateError) {
        console.error('[deletePipelineStage] Error reassigning leads:', updateError);
        throw updateError;
      }
    }
  }

  // Now delete the stage
  const { error } = await supabaseAdmin
    .from('pipeline_stages')
    .delete()
    .eq('id', stageId);

  if (error) throw error;
}

