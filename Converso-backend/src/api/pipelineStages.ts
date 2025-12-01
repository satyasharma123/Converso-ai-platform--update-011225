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
  const { data, error } = await supabase
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
  const { data, error } = await supabase
    .from('pipeline_stages')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', stageId)
    .select()
    .single();

  if (error) throw error;
  return data as PipelineStage;
}

export async function deletePipelineStage(stageId: string): Promise<void> {
  const { error } = await supabase
    .from('pipeline_stages')
    .delete()
    .eq('id', stageId);

  if (error) throw error;
}

