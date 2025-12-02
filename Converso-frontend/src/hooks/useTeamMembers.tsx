import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamMembersApi } from '@/lib/backend-api';
import type { TeamMember } from '@backend/src/types';
import { toast } from 'sonner';

// Re-export types for convenience
export type { TeamMember } from '@backend/src/types';

export function useTeamMembers() {
  return useQuery({
    queryKey: ['team-members'],
    queryFn: () => teamMembersApi.list(),
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });
}

export function useCreateTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      email: string;
      full_name: string;
      role?: 'admin' | 'sdr';
    }) => {
      return teamMembersApi.create(data);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      if (variables.role === 'sdr') {
        toast.success('Team member created successfully. Invitation email sent.', {
          duration: 5000,
        });
      } else {
        toast.success('Team member created successfully', {
          duration: 3000,
        });
      }
    },
    onError: (error: any) => {
      console.error('Error creating team member:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to create team member';
      toast.error(errorMessage, {
        duration: 4000, // Auto-dismiss after 4 seconds
      });
    },
  });
}

export function useUpdateTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: { full_name?: string; email?: string };
    }) => {
      return teamMembersApi.update(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast.success('Team member updated successfully');
    },
    onError: (error: any) => {
      console.error('Error updating team member:', error);
      toast.error(error?.message || 'Failed to update team member', {
        duration: 4000,
      });
    },
  });
}

export function useUpdateTeamMemberRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      role,
    }: {
      id: string;
      role: 'admin' | 'sdr';
    }) => {
      return teamMembersApi.updateRole(id, role);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast.success('Role updated successfully');
    },
    onError: (error: any) => {
      console.error('Error updating role:', error);
      toast.error(error?.message || 'Failed to update role', {
        duration: 4000,
      });
    },
  });
}

export function useDeleteTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return teamMembersApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast.success('Team member deleted successfully');
    },
    onError: (error: any) => {
      console.error('Error deleting team member:', error);
      toast.error(error?.message || 'Failed to delete team member', {
        duration: 4000,
      });
    },
  });
}
