import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface LeadNote {
  id: string;
  conversation_id: string;
  user_id: string;
  user_name: string;
  note_text: string;
  created_at: string;
  updated_at: string;
}

// Fetch notes for a conversation
export function useLeadNotes(conversationId?: string) {
  return useQuery({
    queryKey: ['lead_notes', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];

      const { data, error } = await supabase
        .from('lead_notes')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as LeadNote[];
    },
    enabled: !!conversationId,
  });
}

// Add a new note
export function useAddLeadNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      conversationId, 
      noteText,
      userName 
    }: { 
      conversationId: string; 
      noteText: string;
      userName: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('lead_notes')
        .insert({
          conversation_id: conversationId,
          user_id: user.id,
          user_name: userName,
          note_text: noteText,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead_notes', variables.conversationId] });
      toast.success('Note added successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add note');
    },
  });
}

// Update a note
export function useUpdateLeadNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      noteId, 
      noteText,
      conversationId
    }: { 
      noteId: string; 
      noteText: string;
      conversationId: string;
    }) => {
      const { data, error } = await supabase
        .from('lead_notes')
        .update({ note_text: noteText })
        .eq('id', noteId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead_notes', variables.conversationId] });
      toast.success('Note updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update note');
    },
  });
}

// Delete a note
export function useDeleteLeadNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ noteId, conversationId }: { noteId: string; conversationId: string }) => {
      const { error } = await supabase
        .from('lead_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead_notes', variables.conversationId] });
      toast.success('Note deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete note');
    },
  });
}
