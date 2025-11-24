import { supabase, supabaseAdmin } from '../lib/supabase';
import type { Profile } from '../types';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * API module for profile-related database queries
 */

export async function getProfile(userId: string, client?: SupabaseClient): Promise<Profile | null> {
  const dbClient = client || supabase;
  const { data, error } = await dbClient
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data as Profile | null;
}

export async function updateProfile(
  userId: string,
  updates: Partial<Omit<Profile, 'id' | 'created_at'>>,
  client?: SupabaseClient
): Promise<Profile> {
  // Use user client if provided (has JWT token), otherwise use admin client to bypass RLS
  const dbClient = client || supabaseAdmin;
  const { data, error } = await dbClient
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data as Profile;
}

