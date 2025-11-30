import { supabase, supabaseAdmin } from '../lib/supabase';
import type { ConnectedAccount } from '../types';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * API module for connected account-related database queries
 */

export async function getConnectedAccounts(userId?: string, client?: SupabaseClient): Promise<ConnectedAccount[]> {
  const dbClient = client || supabase;
  let query = dbClient
    .from('connected_accounts')
    .select('*')
    .eq('is_active', true)
    .order('account_name');

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as ConnectedAccount[];
}

export async function getConnectedAccountById(accountId: string, client?: SupabaseClient): Promise<ConnectedAccount | null> {
  const dbClient = client || supabase;
  const { data, error } = await dbClient
    .from('connected_accounts')
    .select('*')
    .eq('id', accountId)
    .single();

  if (error) throw error;
  return data as ConnectedAccount | null;
}

export async function createConnectedAccount(
  account: Omit<ConnectedAccount, 'id' | 'created_at'>,
  client?: SupabaseClient
): Promise<ConnectedAccount> {
  // Use user client if provided (has JWT token), otherwise use admin client to bypass RLS
  const dbClient = client || supabaseAdmin;
  const { data, error } = await dbClient
    .from('connected_accounts')
    .insert(account)
    .select()
    .single();

  if (error) throw error;
  return data as ConnectedAccount;
}

export async function updateConnectedAccount(
  accountId: string,
  updates: Partial<Omit<ConnectedAccount, 'id' | 'created_at'>>,
  client?: SupabaseClient
): Promise<ConnectedAccount> {
  const dbClient = client || supabaseAdmin;
  const { data, error } = await dbClient
    .from('connected_accounts')
    .update(updates)
    .eq('id', accountId)
    .select()
    .single();

  if (error) throw error;
  return data as ConnectedAccount;
}

export async function deleteConnectedAccount(accountId: string, client?: SupabaseClient): Promise<void> {
  // Always use admin client for deletion to bypass RLS and ensure cascade deletion works
  const dbClient = supabaseAdmin;
  
  // Verify account exists first
  const { data: account, error: checkError } = await dbClient
    .from('connected_accounts')
    .select('id')
    .eq('id', accountId)
    .single();

  if (checkError || !account) {
    throw new Error(`Connected account not found: ${accountId}`);
  }

  // Delete sync status records for this account
  const { error: syncStatusError } = await dbClient
    .from('sync_status')
    .delete()
    .eq('account_id', accountId);

  if (syncStatusError) {
    console.error('Error deleting sync status:', syncStatusError);
    // Don't throw - sync status deletion is not critical
  }

  // Get count of conversations before deletion (for logging)
  const { count: conversationsCount } = await dbClient
    .from('conversations')
    .select('*', { count: 'exact', head: true })
    .eq('received_on_account_id', accountId);

  // Delete all conversations associated with this account
  // Messages will be automatically deleted due to CASCADE constraint on conversation_id
  const { error: conversationsError } = await dbClient
    .from('conversations')
    .delete()
    .eq('received_on_account_id', accountId);

  if (conversationsError) {
    console.error('Error deleting conversations:', conversationsError);
    throw new Error(`Failed to delete related conversations: ${conversationsError.message}`);
  }

  console.log(`Deleted ${conversationsCount || 0} conversations for account ${accountId}`);

  // Then delete the connected account itself
  const { error } = await dbClient
    .from('connected_accounts')
    .delete()
    .eq('id', accountId);

  if (error) {
    console.error('Error deleting connected account:', error);
    throw new Error(`Failed to delete connected account: ${error.message}`);
  }

  console.log(`Successfully deleted connected account ${accountId} and all associated data`);
}

export async function toggleConnectedAccountStatus(
  accountId: string,
  isActive: boolean,
  client?: SupabaseClient
): Promise<void> {
  const dbClient = client || supabaseAdmin;
  const { error } = await dbClient
    .from('connected_accounts')
    .update({ is_active: isActive })
    .eq('id', accountId);

  if (error) throw error;
}

