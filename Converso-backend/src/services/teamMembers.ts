import * as teamMembersApi from '../api/teamMembers';
import type { TeamMember } from '../types';

/**
 * Service layer for team members - contains business logic
 */

export const teamMembersService = {
  /**
   * Get all team members with their roles
   */
  async getMembers(): Promise<TeamMember[]> {
    return teamMembersApi.getTeamMembers();
  },

  /**
   * Get a single team member by ID
   */
  async getById(userId: string): Promise<TeamMember | null> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    return teamMembersApi.getTeamMemberById(userId);
  },

  /**
   * Update a team member's role
   */
  async updateRole(userId: string, role: 'admin' | 'sdr'): Promise<void> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!role || (role !== 'admin' && role !== 'sdr')) {
      throw new Error('Valid role (admin or sdr) is required');
    }

    return teamMembersApi.updateTeamMemberRole(userId, role);
  },
};

