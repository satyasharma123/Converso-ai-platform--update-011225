import * as connectedAccountsApi from '../api/connectedAccounts';
import type { ConnectedAccount } from '../types';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Service layer for connected accounts - contains business logic
 */

export const connectedAccountsService = {
  /**
   * Get all active connected accounts, optionally filtered by user
   */
  async getAccounts(userId?: string, client?: SupabaseClient): Promise<ConnectedAccount[]> {
    return connectedAccountsApi.getConnectedAccounts(userId, client);
  },

  /**
   * Get a single connected account by ID
   */
  async getById(accountId: string, client?: SupabaseClient): Promise<ConnectedAccount | null> {
    if (!accountId) {
      throw new Error('Account ID is required');
    }

    return connectedAccountsApi.getConnectedAccountById(accountId, client);
  },

  /**
   * Create a new connected account
   */
  async createAccount(
    account: Omit<ConnectedAccount, 'id' | 'created_at'>,
    client?: SupabaseClient
  ): Promise<ConnectedAccount> {
    if (!account.account_name || account.account_name.trim().length === 0) {
      throw new Error('Account name is required');
    }

    if (!account.user_id) {
      throw new Error('User ID is required');
    }

    return connectedAccountsApi.createConnectedAccount(account, client);
  },

  /**
   * Update an existing connected account
   */
  async updateAccount(
    accountId: string,
    updates: Partial<Omit<ConnectedAccount, 'id' | 'created_at'>>,
    client?: SupabaseClient
  ): Promise<ConnectedAccount> {
    if (!accountId) {
      throw new Error('Account ID is required');
    }

    return connectedAccountsApi.updateConnectedAccount(accountId, updates, client);
  },

  /**
   * Delete a connected account and all associated data
   * This will cascade delete:
   * - All conversations received on this account
   * - All messages in those conversations (automatic via CASCADE)
   */
  async deleteAccount(accountId: string, client?: SupabaseClient): Promise<void> {
    if (!accountId) {
      throw new Error('Account ID is required');
    }

    // Always use admin client for deletion to ensure cascade deletion works
    // The client parameter is ignored here to ensure proper deletion
    return connectedAccountsApi.deleteConnectedAccount(accountId);
  },

  /**
   * Toggle account active status
   */
  async toggleStatus(accountId: string, isActive: boolean, client?: SupabaseClient): Promise<void> {
    if (!accountId) {
      throw new Error('Account ID is required');
    }

    return connectedAccountsApi.toggleConnectedAccountStatus(accountId, isActive, client);
  },
};

