import { supabase, supabaseAdmin } from '../lib/supabase';
import type { ConnectedAccount } from '../types';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * API module for connected account-related database queries
 */

export async function getConnectedAccounts(userId?: string, client?: SupabaseClient): Promise<ConnectedAccount[]> {
  // Always use admin client to bypass RLS for connected accounts query
  // This is safe because we filter by user_id/workspace_id
  const dbClient = client || supabaseAdmin;
  
  // If userId is provided, get their workspace_id and fetch all accounts for that workspace
  if (userId) {
    // First, get the user's workspace_id from their profile
    const { data: profile } = await dbClient
      .from('profiles')
      .select('workspace_id')
      .eq('id', userId)
      .single();
    
    if (profile?.workspace_id) {
      // Fetch all accounts for this workspace (includes email accounts via user_id AND LinkedIn via workspace_id)
      // Also include LinkedIn accounts that may have workspace_id missing (legacy rows) so they still appear.
      const { data, error } = await dbClient
        .from('connected_accounts')
        .select('*')
        .eq('is_active', true)
        .or(
          [
            `user_id.eq.${userId}`,
            `workspace_id.eq.${profile.workspace_id}`,
            // Fallback: legacy LinkedIn accounts without workspace_id set
            `and(account_type.eq.linkedin,workspace_id.is.null)`
          ].join(',')
        )
        .order('account_name');
      
      if (error) throw error;
      return data as ConnectedAccount[];
    } else {
      // Fallback to user_id only if no workspace found
      const { data, error } = await dbClient
        .from('connected_accounts')
        .select('*')
        .eq('is_active', true)
        .eq('user_id', userId)
        .order('account_name');
      
      if (error) throw error;
      return data as ConnectedAccount[];
    }
  }
  
  // No userId provided, fetch all accounts
  const { data, error } = await dbClient
    .from('connected_accounts')
    .select('*')
    .eq('is_active', true)
    .order('account_name');

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
  // Check if we have a proper admin client with service role key
  // Without it, RLS will block us from seeing/deleting accounts
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set! Cannot delete accounts without admin privileges.');
    throw new Error('Server configuration error: Admin key not configured. Please contact administrator.');
  }

  // Always use admin client for deletion to bypass RLS and ensure cascade deletion works
  const dbClient = supabaseAdmin;
  
  // Verify account exists first
  const { data: account, error: checkError } = await dbClient
    .from('connected_accounts')
    .select('id, account_email')
    .eq('id', accountId)
    .single();

  if (checkError) {
    if (checkError.code === 'PGRST116') {
      // Account doesn't exist in the database
      console.log(`Account ${accountId} not found in database - may have been already deleted`);
      // Still return success - the end result is what the user wanted
      return;
    }
    console.error(`Error checking account existence:`, checkError);
    throw new Error(`Error checking account existence: ${checkError.message}`);
  }

  if (!account) {
    console.log(`Account ${accountId} not found in database - may have been already deleted`);
    return;
  }
  
  console.log(`Found account to delete: ${accountId} (${account.account_email})`);


  console.log(`Starting deletion process for account ${accountId} (${account.account_email})`);

  // Step 1: Delete sync status records for this account
  // Note: sync_status table uses 'inbox_id' column which stores the account_id
  try {
    const { error: syncStatusError } = await dbClient
      .from('sync_status')
      .delete()
      .eq('inbox_id', accountId);

    if (syncStatusError) {
      console.warn('Error deleting sync status:', syncStatusError);
    } else {
      console.log(`Deleted sync status records for account ${accountId}`);
    }
  } catch (err: any) {
    console.warn('Exception deleting sync status:', err.message);
  }

  // Step 2: Get count of conversations before deletion (for logging)
  let conversationsCount = 0;
  try {
    const { count } = await dbClient
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('received_on_account_id', accountId);
    conversationsCount = count || 0;
    console.log(`Found ${conversationsCount} conversations to delete for account ${accountId}`);
  } catch (countError: any) {
    console.warn('Could not count conversations:', countError.message);
  }

  // Step 3: Delete all conversations associated with this account
  // Messages will be automatically deleted due to CASCADE constraint on conversation_id
  try {
    const { error: conversationsError } = await dbClient
      .from('conversations')
      .delete()
      .eq('received_on_account_id', accountId);

    if (conversationsError) {
      console.error('Error deleting conversations:', conversationsError);
      console.warn(`Continuing with account deletion despite conversation deletion error`);
    } else {
      console.log(`Deleted ${conversationsCount} conversations for account ${accountId}`);
    }
  } catch (err: any) {
    console.warn('Exception deleting conversations:', err.message);
  }

  // Step 4: Messages will be automatically deleted via CASCADE constraint
  // when their parent conversations are deleted, so no separate deletion needed
  console.log('Messages will be deleted automatically via CASCADE when conversations are removed');

  // Step 5: Delete the connected account itself (CRITICAL - must succeed)
  console.log(`Deleting connected account ${accountId}...`);
  const { error, data } = await dbClient
    .from('connected_accounts')
    .delete()
    .eq('id', accountId)
    .select();

  if (error) {
    console.error('CRITICAL: Error deleting connected account:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    throw new Error(`Failed to delete connected account: ${error.message} (Code: ${error.code || 'UNKNOWN'})`);
  }

  if (!data || data.length === 0) {
    console.warn(`No rows deleted for account ${accountId} - account may not exist`);
    // Don't throw - account might have been deleted already
    return;
  }

  console.log(`✅ Successfully deleted connected account ${accountId} (${account.account_email}) and all associated data`);
  console.log(`   - Deleted ${conversationsCount} conversations`);
  console.log(`   - Messages deleted via CASCADE`);
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

