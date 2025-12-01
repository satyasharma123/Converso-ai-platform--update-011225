import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useWorkspace } from './useWorkspace';

export interface EmailConversation {
  id: string;
  sender_name: string;
  sender_email?: string;
  subject?: string;
  preview: string;
  last_message_at: string;
  email_timestamp?: string;
  gmail_message_id?: string;
  has_full_body?: boolean;
  is_read: boolean;
  status: string;
  received_account?: {
    account_name: string;
    account_email?: string;
    account_type: string;
  };
}

/**
 * Hook to get emails (default: last 30 days)
 */
export function useEmails(days: number = 30) {
  const { data: workspace } = useWorkspace();

  return useQuery({
    queryKey: ['emails', workspace?.id, days],
    queryFn: async () => {
      if (!workspace) return [];

      const emails = await apiClient.get<EmailConversation[]>(
        `/api/emails?workspace_id=${workspace.id}&days=${days}&limit=50`
      );
      return emails || [];
    },
    enabled: !!workspace,
  });
}

/**
 * Hook for infinite scroll - loads older emails
 */
export function useEmailsInfinite() {
  const { data: workspace } = useWorkspace();

  return useInfiniteQuery({
    queryKey: ['emails-infinite', workspace?.id],
    queryFn: async ({ pageParam }) => {
      if (!workspace) return { data: [], nextCursor: null };

      const before = pageParam || new Date().toISOString();
      
      const emails = await apiClient.get<EmailConversation[]>(
        `/api/emails/load-more?workspace_id=${workspace.id}&before=${before}&limit=50`
      );

      // Get the oldest email timestamp as next cursor
      const nextCursor = emails && emails.length > 0
        ? emails[emails.length - 1].email_timestamp || emails[emails.length - 1].last_message_at
        : null;

      return {
        data: emails || [],
        nextCursor,
      };
    },
    enabled: !!workspace,
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

/**
 * Hook to get email with full body (fetches from Gmail if needed)
 */
export function useEmailWithBody(conversationId: string | null) {
  return useQuery({
    queryKey: ['email-body', conversationId],
    queryFn: async () => {
      if (!conversationId) return null;

      const email = await apiClient.get<EmailConversation & { body?: string }>(
        `/api/emails/${conversationId}`
      );
      return email;
    },
    enabled: !!conversationId,
  });
}

