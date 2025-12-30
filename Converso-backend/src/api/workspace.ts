import { supabase, supabaseAdmin } from '../lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface Workspace {
  id: string;
  name: string;
  owner_user_id?: string;
  owner_email?: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * API module for workspace-related database queries
 */

export async function getWorkspace(client?: SupabaseClient): Promise<Workspace | null> {
  // For now, we'll use a single workspace (can be extended to multi-tenant later)
  const dbClient = client || supabaseAdmin;
  const { data, error } = await dbClient
    .from('workspaces')
    .select('*')
    .limit(1)
    .single();

  if (error) {
    // If table doesn't exist or no workspace, return null
    if (error.code === 'PGRST116' || error.code === '42P01' || error.message?.includes('does not exist')) {
      return null;
    }
    throw error;
  }
  return data as Workspace | null;
}

export async function createWorkspace(
  name: string,
  client?: SupabaseClient,
  ownerUserId?: string,
  ownerEmail?: string | null
): Promise<Workspace> {
  const dbClient = client || supabaseAdmin;
  
  const insertData: any = { name };
  
  // Set owner fields if provided
  if (ownerUserId) {
    insertData.owner_user_id = ownerUserId;
  }
  if (ownerEmail !== undefined) {
    insertData.owner_email = ownerEmail;
  }
  
  const { data, error } = await dbClient
    .from('workspaces')
    .insert(insertData)
    .select()
    .single();

  if (error) throw error;
  return data as Workspace;
}

export async function updateWorkspace(workspaceId: string, name: string, client?: SupabaseClient): Promise<Workspace> {
  // Update workspace by ID explicitly - do NOT use getWorkspace() or limit(1)
  const dbClient = client || supabaseAdmin;

  const { data, error } = await dbClient
    .from('workspaces')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', workspaceId)
    .select()
    .single();

  if (error) {
    // If workspace not found, return 404 error
    if (error.code === 'PGRST116') {
      throw new Error(`Workspace with id ${workspaceId} not found`);
    }
    throw error;
  }

  return data as Workspace;
}

export async function deleteWorkspace(workspaceId: string, client?: SupabaseClient): Promise<void> {
  const dbClient = client || supabaseAdmin;

  // 1. Delete all workspace_members entries
  const { error: membersError } = await dbClient
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId);

  if (membersError) {
    throw new Error(`Failed to delete workspace members: ${membersError.message}`);
  }

  // 2. Delete the workspace
  const { error: workspaceError } = await dbClient
    .from('workspaces')
    .delete()
    .eq('id', workspaceId);

  if (workspaceError) {
    throw new Error(`Failed to delete workspace: ${workspaceError.message}`);
  }
}

