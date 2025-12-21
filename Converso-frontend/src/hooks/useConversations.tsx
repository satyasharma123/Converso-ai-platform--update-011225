import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { conversationsApi } from '@/lib/backend-api';
import type { Conversation } from '@backend/src/types';

// Re-export types for convenience
export type { Conversation } from '@backend/src/types';

export function useConversations(type?: 'email' | 'linkedin', folder?: string, enabled: boolean = true) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['conversations', type, folder, user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // Phase-2: Conditional data fetching based on conversation_type
      // For Sales Pipeline (no type specified), fetch email senders + LinkedIn conversations separately
      if (!type) {
        // Fetch email senders (grouped by sender_email) and LinkedIn conversations
        const [emailSenders, linkedinConversations] = await Promise.all([
          conversationsApi.listEmailSenders().catch(() => []), // Fallback to empty array on error
          conversationsApi.list('linkedin', folder).catch(() => []), // Fallback to empty array on error
        ]);

        // Transform SenderPipelineItem[] to Conversation[] format for email
        const emailConversations: Conversation[] = emailSenders.map((sender) => {
          // Use first conversation_id as the ID for drag/drop compatibility
          // This allows existing drag/drop logic to work without changes
          const primaryConversationId = sender.conversation_ids && sender.conversation_ids.length > 0
            ? sender.conversation_ids[0]
            : sender.sender_email; // Fallback to sender_email if no conversation_ids

          return {
            id: primaryConversationId,
            sender_name: sender.sender_name,
            sender_email: sender.sender_email,
            subject: sender.subject || undefined,
            preview: sender.preview || '',
            last_message_at: sender.last_message_at || new Date().toISOString(),
            conversation_type: 'email' as const,
            status: 'new' as const, // Default status
            is_read: false, // Default read status
            assigned_to: sender.assigned_to || undefined,
            custom_stage_id: sender.custom_stage_id || undefined,
            stage_assigned_at: sender.stage_assigned_at || undefined,
            received_account: sender.received_account || undefined,
            // Phase-3: Store conversation_ids for bulk update detection
            conversation_ids: sender.conversation_ids,
            // Counters for pipeline cards
            activity_count: sender.activity_count,
            conversation_count: sender.conversation_count,
          } as Conversation;
        });

        // Add counts to LinkedIn conversations
        const linkedinWithCounts: Conversation[] = linkedinConversations.map((conversation) => ({
          ...conversation,
          // LinkedIn conversations are individual threads, not grouped
          conversation_count: 1,
          // Activity count defaults to 0 (will be populated by ActivityTimeline if needed)
          activity_count: (conversation as any).activity_count ?? 0,
        }));

        // Combine email and LinkedIn conversations
        return [...emailConversations, ...linkedinWithCounts];
      }

      // For specific type requests (used by Inbox):
      // - Email: use existing endpoint (for inbox, not pipeline)
      // - LinkedIn: use existing endpoint
      return conversationsApi.list(type, folder);
    },
    enabled: !!user && enabled, // ✅ FIX: Allow conditional enabling
    // ✅ OPTIMIZED: Only LinkedIn gets polling, Email uses manual refresh
    refetchInterval: type === 'linkedin' ? 15000 : false, // LinkedIn: 15s, Email: manual only
    refetchOnWindowFocus: type === 'linkedin', // ✅ FIX: Only LinkedIn auto-refetches
    refetchOnMount: false, // ✅ FIX: Don't refetch on component mount
    staleTime: 5 * 60 * 1000, // ✅ FIX: Data fresh for 5 minutes (was 30s!)
  });
}

export function useAssignConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      conversationId, 
      sdrId,
      conversation 
    }: { 
      conversationId: string; 
      sdrId: string | null;
      conversation?: Conversation; // Optional: for Phase-3 bulk updates
    }) => {
      // Phase-3: Check if this is an email conversation with multiple conversation_ids
      if (
        conversation &&
        conversation.conversation_type === 'email' &&
        conversation.conversation_ids &&
        conversation.conversation_ids.length > 1 &&
        conversation.sender_email
      ) {
        // Use bulk endpoint for email senders
        return conversationsApi.updateEmailSenderAssignment(conversation.sender_email, sdrId);
      }
      
      // Use existing single-conversation endpoint for LinkedIn or single-thread emails
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
      stageId,
      conversation 
    }: { 
      conversationId: string; 
      stageId: string | null;
      conversation?: Conversation; // Optional: for Phase-3 bulk updates
    }) => {
      // Phase-3: Check if this is an email conversation with multiple conversation_ids
      if (
        conversation &&
        conversation.conversation_type === 'email' &&
        conversation.conversation_ids &&
        conversation.conversation_ids.length > 1 &&
        conversation.sender_email
      ) {
        // Use bulk endpoint for email senders
        return conversationsApi.updateEmailSenderStage(conversation.sender_email, stageId);
      }
      
      // Use existing single-conversation endpoint for LinkedIn or single-thread emails
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
    onMutate: async (conversationId: string) => {
      toast.info('Sync requested. Fetching latest messages in the background.');
      return { conversationId };
    },
    onSuccess: (_data, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      if (conversationId) {
        queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['messages'] });
      }
      toast.success('Messages synced successfully');
    },
    onError: (error: any, _conversationId, context) => {
      console.error('Error syncing conversation:', error);
      toast.error(error?.message || 'Failed to sync messages');
      if (context?.conversationId) {
        queryClient.invalidateQueries({ queryKey: ['messages', context.conversationId] });
      }
    },
  });
}
