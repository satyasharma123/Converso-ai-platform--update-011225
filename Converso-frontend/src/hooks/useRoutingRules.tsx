import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { routingRulesApi, type RoutingRule } from '@/lib/backend-api';
import { toast } from 'sonner';

export function useRoutingRules() {
  return useQuery({
    queryKey: ['routing_rules'],
    queryFn: () => routingRulesApi.list(),
  });
}

export function useCreateRoutingRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rule: Omit<RoutingRule, 'id' | 'created_at' | 'updated_at'>) => {
      return routingRulesApi.create(rule);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routing_rules'] });
      toast.success('Routing rule created successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create routing rule');
    },
  });
}

export function useUpdateRoutingRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Omit<RoutingRule, 'id' | 'created_at' | 'updated_at'>> }) => {
      return routingRulesApi.update(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routing_rules'] });
      toast.success('Routing rule updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update routing rule');
    },
  });
}

export function useDeleteRoutingRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return routingRulesApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routing_rules'] });
      toast.success('Routing rule deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete routing rule');
    },
  });
}

