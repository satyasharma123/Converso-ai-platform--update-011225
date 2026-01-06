import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiAgentsApi, type AIAgentSettings, type AIAgentSettingsUpdate } from '@/lib/backend-api';
import { toast } from 'sonner';
import { useWorkspace } from '@/context/WorkspaceContext';

/**
 * Get AI Agent Settings for current workspace
 */
export function useGetAIAgentSettings() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;

  return useQuery({
    queryKey: ['ai-agent-settings', workspaceId],
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      console.log('[AI AGENTS] fetching settings', { workspaceId });
      const settings = await aiAgentsApi.getSettings();
      console.log('[AI AGENTS] fetched settings', settings);
      return settings;
    },
  });
}

/**
 * Update AI Agent Settings
 */
export function useUpdateAIAgentSettings() {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;

  return useMutation({
    mutationFn: async (payload: AIAgentSettingsUpdate) => {
      const response = await aiAgentsApi.updateSettings(payload);
      return response;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['ai-agent-settings', workspaceId], data);
      queryClient.invalidateQueries({ queryKey: ['ai-agent-settings', workspaceId] });
      toast.success('AI Agent settings updated successfully');
    },
    onError: (error: any) => {
      console.error('Error updating AI Agent settings:', error);
      toast.error(error.message || 'Failed to update AI Agent settings');
    },
  });
}

