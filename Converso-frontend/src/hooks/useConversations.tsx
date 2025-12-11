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
    refetchInterval: 8000, // Poll every 8 seconds for new messages/conversations
    refetchOnWindowFocus: true, // Refetch when user focuses window
    staleTime: 5000, // Data is fresh for 5 seconds
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
    onMutate: async ({ conversationId, isRead }) => {
      await queryClient.cancelQueries({ queryKey: ['conversations'] });

      const queries = queryClient.getQueryCache().findAll({ queryKey: ['conversations'] });
      const previousData = queries.map((query) => ({
        queryKey: query.queryKey,
        data: query.state.data,
      }));

      queries.forEach(({ queryKey }) => {
        queryClient.setQueryData(queryKey, (oldData: any) => {
          if (!Array.isArray(oldData)) {
            return oldData;
          }
          return oldData.map((conversation) =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  is_read: isRead,
                  isRead,
                }
              : conversation
          );
        });
      });

      return { previousData };
    },
    onError: (error, _variables, context) => {
      context?.previousData?.forEach(({ queryKey, data }) => {
        queryClient.setQueryData(queryKey, data);
      });
      console.error('Error toggling read status:', error);
      // No toast notification for read/unread changes
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
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

export function useToggleFavoriteConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId, isFavorite }: { conversationId: string; isFavorite: boolean }) => {
      return conversationsApi.toggleFavorite(conversationId, isFavorite);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error) => {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorite status');
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      return conversationsApi.delete(conversationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Conversation deleted');
    },
    onError: (error) => {
      console.error('Error deleting conversation:', error);
      toast.error('Failed to delete conversation');
    },
  });
}

export function useUpdateLeadProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      updates,
    }: {
      conversationId: string;
      updates: {
        sender_name?: string;
        sender_email?: string;
        mobile?: string;
        company_name?: string;
        location?: string;
      };
    }) => {
      return conversationsApi.updateProfile(conversationId, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Lead profile updated successfully');
    },
    onError: (error) => {
      console.error('Error updating lead profile:', error);
      toast.error('Failed to update lead profile');
    },
  });
}

export function useBulkReassignConversations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      fromSdrId,
      toSdrId,
    }: {
      fromSdrId: string;
      toSdrId: string | null;
    }) => {
      return conversationsApi.bulkReassign(fromSdrId, toSdrId);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success(`Successfully reassigned ${data.count} conversation(s)`);
    },
    onError: (error) => {
      console.error('Error bulk reassigning conversations:', error);
      toast.error('Failed to reassign conversations');
    },
  });
}

/**
 * Sync/refresh messages for a LinkedIn conversation from Unipile
 */
export function useSyncConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      return conversationsApi.sync(conversationId);
    },
    onSuccess: () => {
      // Invalidate both conversations and messages queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      toast.success('Messages synced successfully');
    },
    onError: (error: any) => {
      console.error('Error syncing conversation:', error);
      toast.error(error?.message || 'Failed to sync messages');
    },
  });
}
