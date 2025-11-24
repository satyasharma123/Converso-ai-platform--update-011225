import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workspaceApi, type Workspace } from '@/lib/backend-api';
import { toast } from 'sonner';

export function useWorkspace() {
  return useQuery({
    queryKey: ['workspace'],
    queryFn: () => workspaceApi.get(),
  });
}

export function useUpdateWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      return workspaceApi.update(name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
      toast.success('Workspace updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update workspace');
    },
  });
}

