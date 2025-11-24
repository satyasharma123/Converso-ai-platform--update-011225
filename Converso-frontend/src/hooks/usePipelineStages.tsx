import { useQuery } from '@tanstack/react-query';
import { pipelineStagesApi } from '@/lib/backend-api';
import type { PipelineStage } from '@backend/src/types';

// Re-export types for convenience
export type { PipelineStage } from '@backend/src/types';

export function usePipelineStages() {
  return useQuery({
    queryKey: ['pipeline-stages'],
    queryFn: () => pipelineStagesApi.list(),
  });
}
