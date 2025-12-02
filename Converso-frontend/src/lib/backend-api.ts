/**
 * Backend API Service Layer
 * This replaces the direct Supabase calls with HTTP requests to the Express backend
 */

import { apiClient } from './api-client';
import type {
  Conversation,
  Message,
  PipelineStage,
  TeamMember,
  ConnectedAccount,
} from '@backend/src/types';

// ==================== Conversations API ====================

export const conversationsApi = {
  /**
   * Get all conversations
   */
  async list(type?: 'email' | 'linkedin'): Promise<Conversation[]> {
    const params: Record<string, string> = {};
    if (type) params.type = type;
    return apiClient.get<Conversation[]>('/api/conversations', params);
  },

  /**
   * Get a single conversation by ID
   */
  async getById(id: string): Promise<Conversation> {
    return apiClient.get<Conversation>(`/api/conversations/${id}`);
  },

  /**
   * Assign a conversation to an SDR
   */
  async assign(conversationId: string, sdrId: string | null): Promise<void> {
    await apiClient.patch(`/api/conversations/${conversationId}/assign`, { sdrId });
  },

  /**
   * Bulk reassign conversations from one SDR to another
   */
  async bulkReassign(fromSdrId: string, toSdrId: string | null): Promise<{ count: number }> {
    return apiClient.post<{ count: number }>('/api/conversations/bulk-reassign', {
      fromSdrId,
      toSdrId,
    });
  },

  /**
   * Update conversation status
   */
  async updateStatus(
    conversationId: string,
    status: 'new' | 'engaged' | 'qualified' | 'converted' | 'not_interested'
  ): Promise<void> {
    await apiClient.patch(`/api/conversations/${conversationId}/status`, { status });
  },

  /**
   * Toggle read status
   */
  async toggleRead(conversationId: string, isRead: boolean): Promise<void> {
    await apiClient.patch(`/api/conversations/${conversationId}/read`, { isRead });
  },

  /**
   * Update conversation pipeline stage
   */
  async updateStage(conversationId: string, stageId: string | null): Promise<void> {
    await apiClient.patch(`/api/conversations/${conversationId}/stage`, { stageId });
  },

  /**
   * Toggle favorite flag
   */
  async toggleFavorite(conversationId: string, isFavorite: boolean): Promise<void> {
    await apiClient.patch(`/api/conversations/${conversationId}/favorite`, { isFavorite });
  },

  /**
   * Delete a conversation
   */
  async delete(conversationId: string): Promise<void> {
    await apiClient.delete(`/api/conversations/${conversationId}`);
  },

  /**
   * Update lead profile information
   */
  async updateProfile(
    conversationId: string,
    updates: {
      sender_name?: string;
      company_name?: string;
      location?: string;
    }
  ): Promise<void> {
    await apiClient.patch(`/api/conversations/${conversationId}/profile`, updates);
  },
};

// ==================== Messages API ====================

export const messagesApi = {
  /**
   * Get all messages for a conversation
   */
  async getByConversation(conversationId: string): Promise<Message[]> {
    return apiClient.get<Message[]>(`/api/messages/conversation/${conversationId}`);
  },

  /**
   * Send a message
   */
  async send(conversationId: string, content: string, userId: string): Promise<Message> {
    return apiClient.post<Message>('/api/messages', {
      conversationId,
      content,
      userId,
    });
  },

  /**
   * Get a single message by ID
   */
  async getById(id: string): Promise<Message> {
    return apiClient.get<Message>(`/api/messages/${id}`);
  },
};

// ==================== Pipeline Stages API ====================

export const pipelineStagesApi = {
  /**
   * Get all pipeline stages
   */
  async list(): Promise<PipelineStage[]> {
    return apiClient.get<PipelineStage[]>('/api/pipeline-stages');
  },

  /**
   * Create a new pipeline stage
   */
  async create(stage: Omit<PipelineStage, 'id' | 'created_at' | 'updated_at'>): Promise<PipelineStage> {
    return apiClient.post<PipelineStage>('/api/pipeline-stages', stage);
  },

  /**
   * Update a pipeline stage
   */
  async update(
    id: string,
    updates: Partial<Omit<PipelineStage, 'id' | 'created_at'>>
  ): Promise<PipelineStage> {
    return apiClient.put<PipelineStage>(`/api/pipeline-stages/${id}`, updates);
  },

  /**
   * Delete a pipeline stage
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/pipeline-stages/${id}`);
  },
};

// ==================== Team Members API ====================

export const teamMembersApi = {
  /**
   * Get all team members
   */
  async list(): Promise<TeamMember[]> {
    return apiClient.get<TeamMember[]>('/api/team-members');
  },

  /**
   * Get a single team member by ID
   */
  async getById(id: string): Promise<TeamMember> {
    return apiClient.get<TeamMember>(`/api/team-members/${id}`);
  },

  /**
   * Create a new team member
   */
  async create(data: {
    email: string;
    full_name: string;
    role?: 'admin' | 'sdr';
  }): Promise<TeamMember> {
    return apiClient.post<TeamMember>('/api/team-members', data);
  },

  /**
   * Update team member profile
   */
  async update(id: string, updates: {
    full_name?: string;
    email?: string;
  }): Promise<TeamMember> {
    return apiClient.patch<TeamMember>(`/api/team-members/${id}`, updates);
  },

  /**
   * Update team member role
   */
  async updateRole(id: string, role: 'admin' | 'sdr'): Promise<void> {
    await apiClient.patch(`/api/team-members/${id}/role`, { role });
  },

  /**
   * Delete a team member
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/team-members/${id}`);
  },

  /**
   * Resend invitation email to a team member
   */
  async resendInvitation(id: string): Promise<{ success: boolean; message: string }> {
    return apiClient.post<{ success: boolean; message: string }>(`/api/team-members/${id}/resend-invitation`, {});
  },

  /**
   * Get invitation link for a team member
   */
  async getInvitationLink(id: string): Promise<{ success: boolean; link?: string; message: string }> {
    return apiClient.get<{ success: boolean; link?: string; message: string }>(`/api/team-members/${id}/invitation-link`);
  },
};

// ==================== Connected Accounts API ====================

export const connectedAccountsApi = {
  /**
   * Get all connected accounts
   */
  async list(userId?: string): Promise<ConnectedAccount[]> {
    const params = userId ? { userId } : undefined;
    return apiClient.get<ConnectedAccount[]>('/api/connected-accounts', params);
  },

  /**
   * Get a single connected account by ID
   */
  async getById(id: string): Promise<ConnectedAccount> {
    return apiClient.get<ConnectedAccount>(`/api/connected-accounts/${id}`);
  },

  /**
   * Create a new connected account
   */
  async create(
    account: Omit<ConnectedAccount, 'id' | 'created_at'>
  ): Promise<ConnectedAccount> {
    return apiClient.post<ConnectedAccount>('/api/connected-accounts', account);
  },

  /**
   * Update a connected account
   */
  async update(
    id: string,
    updates: Partial<Omit<ConnectedAccount, 'id' | 'created_at'>>
  ): Promise<ConnectedAccount> {
    return apiClient.put<ConnectedAccount>(`/api/connected-accounts/${id}`, updates);
  },

  /**
   * Delete a connected account
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/connected-accounts/${id}`);
  },

  /**
   * Toggle account active status
   */
  async toggleStatus(id: string, isActive: boolean): Promise<void> {
    await apiClient.patch(`/api/connected-accounts/${id}/toggle`, { isActive });
  },
};

// ==================== Profiles API ====================

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  created_at?: string;
  updated_at?: string;
}

export const profilesApi = {
  /**
   * Get a user's profile
   */
  async get(userId: string): Promise<Profile> {
    return apiClient.get<Profile>(`/api/profiles/${userId}`);
  },

  /**
   * Update a user's profile
   */
  async update(userId: string, updates: Partial<Omit<Profile, 'id' | 'created_at'>>): Promise<Profile> {
    return apiClient.put<Profile>(`/api/profiles/${userId}`, updates);
  },
};

// ==================== Workspace API ====================

export interface Workspace {
  id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
}

export const workspaceApi = {
  /**
   * Get workspace settings
   */
  async get(): Promise<Workspace | null> {
    return apiClient.get<Workspace | null>('/api/workspace');
  },

  /**
   * Update workspace name
   */
  async update(name: string): Promise<Workspace> {
    return apiClient.put<Workspace>('/api/workspace', { name });
  },
};

// ==================== Routing Rules API ====================

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

export const routingRulesApi = {
  /**
   * Get all routing rules
   */
  async list(): Promise<RoutingRule[]> {
    return apiClient.get<RoutingRule[]>('/api/routing-rules');
  },

  /**
   * Get a single routing rule by ID
   */
  async getById(id: string): Promise<RoutingRule> {
    return apiClient.get<RoutingRule>(`/api/routing-rules/${id}`);
  },

  /**
   * Create a new routing rule
   */
  async create(rule: Omit<RoutingRule, 'id' | 'created_at' | 'updated_at'>): Promise<RoutingRule> {
    return apiClient.post<RoutingRule>('/api/routing-rules', rule);
  },

  /**
   * Update a routing rule
   */
  async update(id: string, updates: Partial<Omit<RoutingRule, 'id' | 'created_at' | 'updated_at'>>): Promise<RoutingRule> {
    return apiClient.put<RoutingRule>(`/api/routing-rules/${id}`, updates);
  },

  /**
   * Delete a routing rule
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/routing-rules/${id}`);
  },
};

// ==================== Email Templates API ====================

export interface EmailTemplate {
  id: string;
  workspace_id: string;
  created_by: string | null;
  title: string;
  content: string;
  category: string;
  shortcut: string | null;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
}

export const emailTemplatesApi = {
  /**
   * Get all email templates
   */
  async list(): Promise<EmailTemplate[]> {
    return apiClient.get<EmailTemplate[]>('/api/email-templates');
  },

  /**
   * Get a single email template by ID
   */
  async getById(id: string): Promise<EmailTemplate> {
    return apiClient.get<EmailTemplate>(`/api/email-templates/${id}`);
  },

  /**
   * Create a new email template
   */
  async create(template: {
    title: string;
    content: string;
    category: string;
    shortcut?: string;
  }): Promise<EmailTemplate> {
    return apiClient.post<EmailTemplate>('/api/email-templates', template);
  },

  /**
   * Update an email template
   */
  async update(
    id: string,
    updates: Partial<Omit<EmailTemplate, 'id' | 'workspace_id' | 'created_by' | 'created_at' | 'updated_at' | 'is_default'>>
  ): Promise<EmailTemplate> {
    return apiClient.patch<EmailTemplate>(`/api/email-templates/${id}`, updates);
  },

  /**
   * Delete an email template
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/email-templates/${id}`);
  },
};

