import { supabase } from '../lib/supabase';
import type { PipelineStage } from '../types';

/**
 * API module for pipeline stage-related database queries
 */

export async function getPipelineStages(): Promise<PipelineStage[]> {
  const { data, error } = await supabase
    .from('pipeline_stages')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) throw error;
  return data as PipelineStage[];
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

