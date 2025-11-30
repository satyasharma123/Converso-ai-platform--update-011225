import { supabaseAdmin } from '../lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface SyncStatus {
  id: string;
  workspace_id: string;
  inbox_id: string; // Column name is inbox_id, but it stores account_id (connected_accounts.id)
  status: 'in_progress' | 'completed' | 'error';
  last_synced_at: string | null;
  sync_error: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Get sync status for a workspace and account
 * Note: inbox_id column in sync_status table stores the account_id (connected_accounts.id)
 */
export async function getSyncStatus(
  workspaceId: string,
  accountId: string,
  client?: SupabaseClient
): Promise<SyncStatus | null> {
  const dbClient = client || supabaseAdmin;
  
  const { data, error } = await dbClient
    .from('sync_status')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('inbox_id', accountId) // inbox_id column stores the account_id
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No sync status found
      return null;
    }
    throw error;
  }

  return data as SyncStatus;
}

/**
 * Create or update sync status
 * Note: inbox_id in sync_status table refers to connected_accounts.id
 */
export async function upsertSyncStatus(
  workspaceId: string,
  accountId: string,
  status: 'in_progress' | 'completed' | 'error',
  syncError?: string | null,
  client?: SupabaseClient
): Promise<SyncStatus> {
  const dbClient = client || supabaseAdmin;
  
  const updateData: any = {
    workspace_id: workspaceId,
    inbox_id: accountId, // inbox_id column stores the account_id
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === 'completed') {
    updateData.last_synced_at = new Date().toISOString();
    updateData.sync_error = null;
  } else if (status === 'error' && syncError) {
    updateData.sync_error = syncError;
  }

  const { data, error } = await dbClient
    .from('sync_status')
    .upsert(updateData, {
      onConflict: 'workspace_id,inbox_id', // Use inbox_id for conflict resolution
    })
    .select()
    .single();

  if (error) throw error;
  return data as SyncStatus;
}

