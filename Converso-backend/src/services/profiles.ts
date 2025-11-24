import * as profilesApi from '../api/profiles';
import type { Profile } from '../types';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Service layer for profiles - contains business logic
 */

export const profilesService = {
  /**
   * Get a user's profile
   */
  async getProfile(userId: string, client?: SupabaseClient): Promise<Profile | null> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    return profilesApi.getProfile(userId, client);
  },

  /**
   * Update a user's profile
   */
  async updateProfile(
    userId: string,
    updates: Partial<Omit<Profile, 'id' | 'created_at'>>,
    client?: SupabaseClient
  ): Promise<Profile> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    return profilesApi.updateProfile(userId, updates, client);
  },
};

