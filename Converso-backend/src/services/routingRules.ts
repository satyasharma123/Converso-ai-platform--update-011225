import * as routingRulesApi from '../api/routingRules';
import type { RoutingRule } from '../api/routingRules';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Service layer for routing rules - contains business logic
 */

export const routingRulesService = {
  /**
   * Get all routing rules
   */
  async getRules(client?: SupabaseClient): Promise<RoutingRule[]> {
    return routingRulesApi.getRoutingRules(client);
  },

  /**
   * Get a single routing rule by ID
   */
  async getById(ruleId: string, client?: SupabaseClient): Promise<RoutingRule | null> {
    if (!ruleId) {
      throw new Error('Rule ID is required');
    }

    return routingRulesApi.getRoutingRuleById(ruleId);
  },

  /**
   * Create a new routing rule
   */
  async createRule(
    rule: Omit<RoutingRule, 'id' | 'created_at' | 'updated_at'>,
    client?: SupabaseClient
  ): Promise<RoutingRule> {
    if (!rule.name || rule.name.trim().length === 0) {
      throw new Error('Rule name is required');
    }

    if (!rule.condition_field || !rule.condition_operator || !rule.condition_value) {
      throw new Error('Condition field, operator, and value are required');
    }

    if (!rule.action_type || !rule.action_value) {
      throw new Error('Action type and value are required');
    }

    return routingRulesApi.createRoutingRule(rule, client);
  },

  /**
   * Update an existing routing rule
   */
  async updateRule(
    ruleId: string,
    updates: Partial<Omit<RoutingRule, 'id' | 'created_at' | 'updated_at'>>,
    client?: SupabaseClient
  ): Promise<RoutingRule> {
    if (!ruleId) {
      throw new Error('Rule ID is required');
    }

    return routingRulesApi.updateRoutingRule(ruleId, updates, client);
  },

  /**
   * Delete a routing rule
   */
  async deleteRule(ruleId: string, client?: SupabaseClient): Promise<void> {
    if (!ruleId) {
      throw new Error('Rule ID is required');
    }

    return routingRulesApi.deleteRoutingRule(ruleId, client);
  },
};

