import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { profilesApi, type Profile } from '@/lib/backend-api';
import { toast } from 'sonner';

export function useProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => profilesApi.get(user!.id),
    enabled: !!user?.id,
  });
}

export function useUpdateProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<Omit<Profile, 'id' | 'created_at'>>) => {
      if (!user?.id) throw new Error('User not authenticated');
      return profilesApi.update(user.id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      toast.success('Profile updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update profile');
    },
  });
}

