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
  progress?: { synced: number; total?: number } | null,
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
  } else if (status === 'in_progress' && progress) {
    // Store progress as JSON in sync_error field temporarily
    updateData.sync_error = JSON.stringify({
      synced: progress.synced,
      total: progress.total || null,
    });
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

/**
 * Update sync progress (synced count and total if known)
 */
export async function updateSyncProgress(
  workspaceId: string,
  accountId: string,
  synced: number,
  total?: number,
  client?: SupabaseClient
): Promise<void> {
  const dbClient = client || supabaseAdmin;
  
  const progressData = JSON.stringify({
    synced,
    total: total || null,
  });

  const { error } = await dbClient
    .from('sync_status')
    .update({
      sync_error: progressData,
      updated_at: new Date().toISOString(),
    })
    .eq('workspace_id', workspaceId)
    .eq('inbox_id', accountId)
    .eq('status', 'in_progress');

  if (error) {
    console.error('Error updating sync progress:', error);
    // Don't throw - progress updates are not critical
  }
}

