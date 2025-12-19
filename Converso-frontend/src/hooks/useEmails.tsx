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
  email_body_html?: string; // Lazy-loaded HTML body
  email_body_text?: string; // Lazy-loaded text body
  email_body_fetched_at?: string; // Timestamp when body was fetched
  email_attachments?: EmailAttachment[]; // Received attachments
  is_read: boolean;
  status: string;
  received_account?: {
    account_name: string;
    account_email?: string;
    account_type: string;
  };
}

// Email attachment type (received attachments)
export interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  isInline?: boolean;
  contentId?: string;
  provider?: 'gmail' | 'outlook';
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
 * Hook to get email with full body (fetches from Gmail/Outlook if needed)
 * Fetches silently in background - no loading states shown to user
 */
export function useEmailWithBody(conversationId: string | null) {
  return useQuery({
    queryKey: ['email-body', conversationId],
    queryFn: async () => {
      if (!conversationId) return null;

      try {
        // apiClient already unwraps { data: ... } to just the data
        const emailData = await apiClient.get<EmailConversation & { 
          email_body?: string; 
          body?: string;
          email_body_html?: string;
          email_body_text?: string;
        }>(
          `/api/emails/${conversationId}`
        );
        
        // ✅ CRITICAL FIX: Always preserve preview field (critical fallback)
        // Never return empty body if preview exists
        const finalEmailBody = emailData.email_body || 
                               emailData.body || 
                               emailData.email_body_html || 
                               emailData.email_body_text ||
                               emailData.preview || 
                               '';

        // ✅ CRITICAL: Ensure preview is never null/empty
        const preservedPreview = emailData.preview || 
                                emailData.email_body_text?.substring(0, 500) ||
                                emailData.email_body_html?.substring(0, 500) ||
                                '';

        console.log('[useEmailWithBody] Fetched email:', {
          conversationId,
          hasHtml: !!emailData.email_body_html,
          hasText: !!emailData.email_body_text,
          hasPreview: !!emailData.preview,
          previewLength: preservedPreview.length,
        });

        return {
          ...emailData,
          email_body: finalEmailBody,
          email_body_html: emailData.email_body_html || null,
          email_body_text: emailData.email_body_text || null,
          preview: preservedPreview, // ✅ CRITICAL: Always preserve preview
        };
      } catch (error: any) {
        // Don't throw on network errors - just return null so preview is shown
        // Only throw on auth errors (so user can reconnect)
        if (error?.message?.includes('reconnect') || error?.message?.includes('expired')) {
          throw error;
        }
        console.warn('[useEmailWithBody] Email body fetch failed (will use preview):', error.message);
        return null;
      }
    },
    enabled: !!conversationId,
    retry: (failureCount, error: any) => {
      // Don't retry auth errors (user needs to reconnect)
      if (error?.message?.includes('reconnect') || error?.message?.includes('expired')) {
        return false;
      }
      // Retry network errors up to 3 times
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 3000), // Faster retries: 500ms, 1s, 2s
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
  });
}

/**
 * ✅ STEP 5: Hook to get sent emails (following LinkedIn architecture)
 * Returns conversations where user sent messages (queried via messages table)
 */
export function useSentEmails(enabled: boolean = true) {
  const { data: workspace } = useWorkspace();

  return useQuery({
    queryKey: ['sent-emails', workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return [];
      
      const response = await apiClient.get<EmailConversation[]>(
        `/api/emails/sent?workspace_id=${workspace.id}`
      );
      return response || [];
    },
    enabled: !!workspace?.id && enabled, // ✅ FIX: Only fetch when explicitly enabled
    // ✅ OPTIMIZED: Sent emails don't change frequently
    refetchInterval: false, // ✅ FIX: No auto-refresh
    refetchOnWindowFocus: false, // ✅ FIX: No refetch on window focus
    refetchOnMount: false, // ✅ FIX: No refetch on component mount
    staleTime: 5 * 60 * 1000, // ✅ FIX: Data fresh for 5 minutes
  });
}

