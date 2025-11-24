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
  const dbClient = client || supabaseAdmin;
  const { error } = await dbClient
    .from('connected_accounts')
    .delete()
    .eq('id', accountId);

  if (error) throw error;
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

