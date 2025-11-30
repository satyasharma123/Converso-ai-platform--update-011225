import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { conversationsApi } from '@/lib/backend-api';
import type { Conversation } from '@backend/src/types';

// Re-export types for convenience
export type { Conversation } from '@backend/src/types';

export function useConversations(type?: 'email' | 'linkedin') {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['conversations', type, user?.id],
    queryFn: async () => {
      if (!user) return [];
      return conversationsApi.list(type);
    },
    enabled: !!user,
  });
}

export function useAssignConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId, sdrId }: { conversationId: string; sdrId: string | null }) => {
      return conversationsApi.assign(conversationId, sdrId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Conversation assigned successfully');
    },
    onError: (error) => {
      console.error('Error assigning conversation:', error);
      toast.error('Failed to assign conversation');
    },
  });
}

export function useUpdateConversationStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      conversationId, 
      status 
    }: { 
      conversationId: string; 
      status: 'new' | 'engaged' | 'qualified' | 'converted' | 'not_interested';
    }) => {
      return conversationsApi.updateStatus(conversationId, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Status updated successfully');
    },
    onError: (error) => {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    },
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      return conversationsApi.toggleRead(conversationId, false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useToggleRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId, isRead }: { conversationId: string; isRead: boolean }) => {
      return conversationsApi.toggleRead(conversationId, isRead);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      // No toast notification for read/unread changes
    },
    onError: (error) => {
      console.error('Error toggling read status:', error);
      // No toast notification for read/unread changes
    },
  });
}

export function useUpdateConversationStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      conversationId, 
      stageId 
    }: { 
      conversationId: string; 
      stageId: string | null;
    }) => {
      return conversationsApi.updateStage(conversationId, stageId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Stage updated successfully');
    },
    onError: (error) => {
      console.error('Error updating stage:', error);
      toast.error('Failed to update stage');
    },
  });
}
