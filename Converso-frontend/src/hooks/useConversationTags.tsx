import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { conversationsApi } from '@/lib/backend-api';
import { toast } from 'sonner';

export interface ConversationTag {
  id: string;
  tag: 'meeting_requested' | 'info_requested' | 'lead' | null;
  source: 'ai' | 'manual';
}

/**
 * Get tag for a conversation
 */
export function useConversationTag(conversationId: string | null) {
  return useQuery({
    queryKey: ['conversation-tag', conversationId],
    queryFn: async () => {
      if (!conversationId) return null;
      const response = await conversationsApi.getTag(conversationId);
      // API client already unwraps { data: ... } to just the data
      return response || null;
    },
    enabled: !!conversationId,
  });
}

/**
 * Set tag for a conversation
 */
export function useSetConversationTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      tag,
      channel,
    }: {
      conversationId: string;
      tag: 'meeting_requested' | 'info_requested' | 'lead' | null;
      channel?: 'email' | 'linkedin' | 'whatsapp' | 'instagram';
    }) => {
      const response = await conversationsApi.setTag(conversationId, tag, channel);
      return response;
    },
    onSuccess: (data, variables) => {
      // If data is null, tag was cleared (row deleted)
      queryClient.setQueryData(['conversation-tag', variables.conversationId], data || null);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      if (data?.tag) {
        toast.success(`Tag "${data.tag}" set successfully`);
      } else {
        toast.success('Tag cleared');
      }
    },
    onError: (error: any) => {
      console.error('Error setting tag:', error);
      toast.error(error.message || 'Failed to set tag');
    },
  });
}

/**
 * Delete tag for a conversation
 */
export function useDeleteConversationTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      await conversationsApi.deleteTag(conversationId);
    },
    onSuccess: (_, conversationId) => {
      // Clear tag from cache
      queryClient.setQueryData(['conversation-tag', conversationId], null);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Tag deleted successfully');
    },
    onError: (error: any) => {
      console.error('Error deleting tag:', error);
      toast.error(error.message || 'Failed to delete tag');
    },
  });
}

