import * as workspaceApi from '../api/workspace';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Service layer for workspace - contains business logic
 */

export const workspaceService = {
  /**
   * Get workspace settings
   */
  async getWorkspace(client?: SupabaseClient) {
    return workspaceApi.getWorkspace(client);
  },

  /**
   * Create workspace
   */
  async createWorkspace(
    name: string,
    client?: SupabaseClient,
    ownerUserId?: string,
    ownerEmail?: string | null
  ) {
    return workspaceApi.createWorkspace(name, client, ownerUserId, ownerEmail);
  },

  /**
   * Update workspace name
   */
  async updateWorkspace(workspaceId: string, name: string, client?: SupabaseClient) {
    if (!workspaceId) {
      throw new Error('Workspace ID is required');
    }
    if (!name || name.trim().length === 0) {
      throw new Error('Workspace name is required');
    }

    return workspaceApi.updateWorkspace(workspaceId, name, client);
  },

  /**
   * Delete workspace
   */
  async deleteWorkspace(workspaceId: string, client?: SupabaseClient) {
    if (!workspaceId) {
      throw new Error('Workspace ID is required');
    }

    return workspaceApi.deleteWorkspace(workspaceId, client);
  },
};

