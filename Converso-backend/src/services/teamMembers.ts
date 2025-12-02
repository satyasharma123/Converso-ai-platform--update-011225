import * as teamMembersApi from '../api/teamMembers';
import type { TeamMember } from '../types';

/**
 * Service layer for team members - contains business logic
 */

export const teamMembersService = {
  /**
   * Get all team members with their roles
   */
  async getMembers(userId?: string): Promise<TeamMember[]> {
    return teamMembersApi.getTeamMembers(userId);
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

  /**
   * Create a new team member
   */
  async createMember(
    email: string,
    fullName: string,
    role: 'admin' | 'sdr',
    workspaceId?: string
  ): Promise<TeamMember> {
    if (!email || !fullName) {
      throw new Error('Email and full name are required');
    }

    return teamMembersApi.createTeamMember(email, fullName, role, workspaceId);
  },

  /**
   * Update a team member's profile
   */
  async updateMember(
    userId: string,
    updates: { full_name?: string; email?: string }
  ): Promise<TeamMember> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    return teamMembersApi.updateTeamMember(userId, updates);
  },

  /**
   * Delete a team member
   */
  async deleteMember(userId: string): Promise<void> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    return teamMembersApi.deleteTeamMember(userId);
  },
};

