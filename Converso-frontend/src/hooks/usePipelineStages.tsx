import { useQuery } from '@tanstack/react-query';
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
