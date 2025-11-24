import { useQuery } from '@tanstack/react-query';
import { teamMembersApi } from '@/lib/backend-api';
import type { TeamMember } from '@backend/src/types';

// Re-export types for convenience
export type { TeamMember } from '@backend/src/types';

export function useTeamMembers() {
  return useQuery({
    queryKey: ['team-members'],
    queryFn: () => teamMembersApi.list(),
  });
}
