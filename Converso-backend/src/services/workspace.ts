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
  async createWorkspace(name: string, client?: SupabaseClient) {
    return workspaceApi.createWorkspace(name, client);
  },

  /**
   * Update workspace name
   */
  async updateWorkspace(name: string, client?: SupabaseClient) {
    if (!name || name.trim().length === 0) {
      throw new Error('Workspace name is required');
    }

    return workspaceApi.updateWorkspace(name, client);
  },
};

