import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

export interface Workspace {
  id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Hook to get current workspace
 * For now, returns the first workspace (can be extended for multi-tenant)
 */
export function useWorkspace() {
  return useQuery({
    queryKey: ['workspace'],
    queryFn: async () => {
      const workspace = await apiClient.get<Workspace>('/api/workspace');
      if (!workspace) {
        // Create default workspace if none exists
        // This should be handled by backend, but we'll handle it here as fallback
        throw new Error('No workspace found');
      }
      return workspace;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

/**
 * Hook to update workspace
 */
export function useUpdateWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      return apiClient.patch<Workspace>('/api/workspace', { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
      toast.success('Workspace updated successfully');
    },
    onError: (error: any) => {
      console.error('Error updating workspace:', error);
      toast.error('Failed to update workspace');
    },
  });
}
