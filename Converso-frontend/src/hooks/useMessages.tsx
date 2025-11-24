import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { messagesApi } from '@/lib/backend-api';
import type { Message } from '@backend/src/types';

// Re-export types for convenience
export type { Message } from '@backend/src/types';

export function useMessages(conversationId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      return messagesApi.getByConversation(conversationId);
    },
    enabled: !!conversationId && !!user,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      conversationId, 
      content 
    }: { 
      conversationId: string; 
      content: string;
    }) => {
      if (!user) throw new Error('Not authenticated');
      return messagesApi.send(conversationId, content, user.id);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['messages', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Message sent successfully');
    },
    onError: (error) => {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    },
  });
}
