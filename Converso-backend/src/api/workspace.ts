import { supabase, supabaseAdmin } from '../lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface Workspace {
  id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * API module for workspace-related database queries
 */

export async function getWorkspace(client?: SupabaseClient): Promise<Workspace | null> {
  // For now, we'll use a single workspace (can be extended to multi-tenant later)
  const dbClient = client || supabase;
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

export async function createWorkspace(name: string, client?: SupabaseClient): Promise<Workspace> {
  const dbClient = client || supabaseAdmin;
  const { data, error } = await dbClient
    .from('workspaces')
    .insert({ name })
    .select()
    .single();

  if (error) throw error;
  return data as Workspace;
}

export async function updateWorkspace(name: string, client?: SupabaseClient): Promise<Workspace> {
  // Get existing workspace or create new one
  const dbClient = client || supabaseAdmin;
  let workspace = await getWorkspace(client);

  if (!workspace) {
    return createWorkspace(name, client);
  }

  const { data, error } = await dbClient
    .from('workspaces')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', workspace.id)
    .select()
    .single();

  if (error) throw error;
  return data as Workspace;
}

