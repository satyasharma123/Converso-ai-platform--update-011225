import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface SendLinkedInMessageParams {
  chat_id: string;
  account_id: string;
  text?: string;
  attachments?: Array<{
    name: string;
    type: string;
    file?: File;
    url?: string;
  }>;
}

interface SendLinkedInMessageResponse {
  status: string;
  message: {
    id: string;
    conversation_id: string;
    content: string;
    created_at: string;
    is_from_lead: boolean;
  } | null;
}

/**
 * Hook to send LinkedIn messages via Unipile
 */
export function useSendLinkedInMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SendLinkedInMessageParams): Promise<SendLinkedInMessageResponse> => {
      const { chat_id, account_id, text, attachments } = params;

      // Prepare the payload
      const payload: any = {
        chat_id,
        account_id,
      };

      if (text) {
        payload.text = text;
      }

      if (attachments && attachments.length > 0) {
        payload.attachments = attachments.map(att => ({
          name: att.name,
          type: att.type,
          url: att.url,
        }));
      }

      return apiClient.post<SendLinkedInMessageResponse>(
        '/api/linkedin/messages/send-message',
        payload
      );
    },
    onSuccess: (data) => {
      if (data?.message?.conversation_id) {
        queryClient.invalidateQueries({
          queryKey: ['messages', data.message.conversation_id],
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ['messages'] });
      }
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error: any) => {
      console.error('Failed to send LinkedIn message:', error);
      toast.error(
        error.response?.data?.details || 
        error.response?.data?.error || 
        'Failed to send message'
      );
    },
  });
}

/**
 * Hook to send LinkedIn message with file attachments
 * This version handles file uploads differently
 */
export function useSendLinkedInMessageWithFiles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SendLinkedInMessageParams & { files?: File[] }): Promise<SendLinkedInMessageResponse> => {
      const { chat_id, account_id, text, files } = params;

      // For now, we'll convert files to base64 data URLs for simple handling
      // In production, you might want to upload to a storage service first
      const attachments = await Promise.all(
        (files || []).map(async (file) => {
          return new Promise<{ name: string; type: string; url: string }>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve({
                name: file.name,
                type: file.type,
                url: reader.result as string,
              });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        })
      );

      const payload = {
        chat_id,
        account_id,
        text,
        attachments: attachments.length > 0 ? attachments : undefined,
      };

      return apiClient.post<SendLinkedInMessageResponse>(
        '/api/linkedin/messages/send-message',
        payload
      );
    },
    onSuccess: (data, variables) => {
      // Invalidate ALL messages and conversations queries
      queryClient.invalidateQueries({ 
        queryKey: ['messages'] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['conversations'] 
      });

      // Force immediate refetch for real-time update
      queryClient.refetchQueries({ 
        queryKey: ['messages'] 
      });
      queryClient.refetchQueries({ 
        queryKey: ['conversations'] 
      });
    },
    onError: (error: any) => {
      console.error('Failed to send LinkedIn message:', error);
      toast.error(
        error.response?.data?.details || 
        error.response?.data?.error || 
        'Failed to send message'
      );
    },
  });
}
