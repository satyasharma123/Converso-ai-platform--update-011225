import { supabase, supabaseAdmin } from '../lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface RoutingRule {
  id: string;
  name: string;
  condition_field: string;
  condition_operator: string;
  condition_value: string;
  action_type: string;
  action_value: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * API module for routing rules-related database queries
 */

export async function getRoutingRules(client?: SupabaseClient): Promise<RoutingRule[]> {
  const dbClient = client || supabase;
  const { data, error } = await dbClient
    .from('routing_rules')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    // If table doesn't exist, return empty array
    if (error.code === 'PGRST116' || error.code === '42P01' || error.message?.includes('does not exist')) {
      return [];
    }
    throw error;
  }
  return (data || []) as RoutingRule[];
}

export async function getRoutingRuleById(ruleId: string, client?: SupabaseClient): Promise<RoutingRule | null> {
  const dbClient = client || supabase;
  const { data, error } = await dbClient
    .from('routing_rules')
    .select('*')
    .eq('id', ruleId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }
  return data as RoutingRule | null;
}

export async function createRoutingRule(
  rule: Omit<RoutingRule, 'id' | 'created_at' | 'updated_at'>,
  client?: SupabaseClient
): Promise<RoutingRule> {
  // Use user client if provided (has JWT token), otherwise use admin client to bypass RLS
  const dbClient = client || supabaseAdmin;
  const { data, error } = await dbClient
    .from('routing_rules')
    .insert({
      name: rule.name,
      condition_field: rule.condition_field,
      condition_operator: rule.condition_operator,
      condition_value: rule.condition_value,
      action_type: rule.action_type,
      action_value: rule.action_value,
      is_active: rule.is_active !== undefined ? rule.is_active : true,
    })
    .select()
    .single();

  if (error) {
    // Provide more helpful error message if table doesn't exist
    if (error.code === 'PGRST116' || error.code === '42P01' || error.message?.includes('does not exist')) {
      throw new Error('Routing rules table does not exist. Please run the database migration: supabase/migrations/20251125000000_create_workspace_and_routing_rules.sql');
    }
    throw error;
  }
  return data as RoutingRule;
}

export async function updateRoutingRule(
  ruleId: string,
  updates: Partial<Omit<RoutingRule, 'id' | 'created_at' | 'updated_at'>>,
  client?: SupabaseClient
): Promise<RoutingRule> {
  const dbClient = client || supabaseAdmin;
  const { data, error } = await dbClient
    .from('routing_rules')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', ruleId)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116' || error.code === '42P01' || error.message?.includes('does not exist')) {
      throw new Error('Routing rules table does not exist. Please run the database migration.');
    }
    throw error;
  }
  return data as RoutingRule;
}

export async function deleteRoutingRule(ruleId: string, client?: SupabaseClient): Promise<void> {
  const dbClient = client || supabaseAdmin;
  const { error } = await dbClient
    .from('routing_rules')
    .delete()
    .eq('id', ruleId);

  if (error) {
    if (error.code === 'PGRST116' || error.code === '42P01' || error.message?.includes('does not exist')) {
      throw new Error('Routing rules table does not exist. Please run the database migration.');
    }
    throw error;
  }
}

