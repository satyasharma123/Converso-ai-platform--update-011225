import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pipelineStagesApi } from '@/lib/backend-api';
import type { PipelineStage } from '@backend/src/types';
import { toast } from 'sonner';

// Re-export types for convenience
export type { PipelineStage } from '@backend/src/types';

export function usePipelineStages() {
  return useQuery({
    queryKey: ['pipeline-stages'],
    queryFn: async () => {
      try {
        const stages = await pipelineStagesApi.list();
        console.log('[usePipelineStages] Fetched stages:', stages);
        return stages || [];
      } catch (error: any) {
        console.error('[usePipelineStages] Error fetching stages:', error);
        // Don't show toast for every query failure (React Query will retry)
        // Only show if it's a persistent error
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    retry: 2,
  });
}

export function useCreatePipelineStage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (stage: Omit<PipelineStage, 'id' | 'created_at' | 'updated_at'>) => {
      return await pipelineStagesApi.create(stage);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-stages'] });
      toast.success('Stage added successfully');
    },
    onError: (error: any) => {
      console.error('[useCreatePipelineStage] Error:', error);
      toast.error(error.message || 'Failed to add stage');
    },
  });
}

export function useUpdatePipelineStage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      id, 
      updates 
    }: { 
      id: string; 
      updates: Partial<Omit<PipelineStage, 'id' | 'created_at'>> 
    }) => {
      return await pipelineStagesApi.update(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-stages'] });
      toast.success('Stage updated successfully');
    },
    onError: (error: any) => {
      console.error('[useUpdatePipelineStage] Error:', error);
      toast.error(error.message || 'Failed to update stage');
    },
  });
}

export function useDeletePipelineStage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      return await pipelineStagesApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-stages'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Stage deleted successfully');
    },
    onError: (error: any) => {
      console.error('[useDeletePipelineStage] Error:', error);
      toast.error(error.message || 'Failed to delete stage');
    },
  });
}
