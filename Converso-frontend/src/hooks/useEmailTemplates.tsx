import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { emailTemplatesApi, type EmailTemplate } from '@/lib/backend-api';
import { toast } from 'sonner';
import { useAuth } from './useAuth';

// Re-export types for convenience
export type { EmailTemplate } from '@/lib/backend-api';

/**
 * Hook to fetch all email templates
 */
export function useEmailTemplates() {
  return useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      try {
        console.log('[useEmailTemplates] Fetching templates...');
        const templates = await emailTemplatesApi.list();
        console.log('[useEmailTemplates] Fetched templates:', templates);
        return templates || [];
      } catch (error: any) {
        console.error('[useEmailTemplates] Error fetching templates:', error);
        console.error('[useEmailTemplates] Error details:', error?.response || error?.message || error);
        toast.error(`Failed to load templates: ${error?.message || 'Unknown error'}`);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    retry: 2,
  });
}

/**
 * Hook to create a new email template
 */
export function useCreateEmailTemplate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      content: string;
      category: string;
      shortcut?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');
      return emailTemplatesApi.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast.success('Template created successfully');
    },
    onError: (error: any) => {
      console.error('Error creating template:', error);
      toast.error(error?.message || 'Failed to create template');
    },
  });
}

/**
 * Hook to update an email template
 */
export function useUpdateEmailTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Omit<EmailTemplate, 'id' | 'workspace_id' | 'created_by' | 'created_at' | 'updated_at' | 'is_default'>>;
    }) => {
      return emailTemplatesApi.update(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast.success('Template updated successfully');
    },
    onError: (error: any) => {
      console.error('Error updating template:', error);
      toast.error(error?.message || 'Failed to update template');
    },
  });
}

/**
 * Hook to delete an email template
 */
export function useDeleteEmailTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await emailTemplatesApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast.success('Template deleted successfully');
    },
    onError: (error: any) => {
      console.error('Error deleting template:', error);
      toast.error(error?.message || 'Failed to delete template');
    },
  });
}

