import * as conversationsApi from '../api/conversations';
import type { Conversation } from '../types';

/**
 * Service layer for conversations - contains business logic
 */

export const conversationsService = {
  /**
   * Get conversations with role-based filtering
   * folder parameter is email-only - LinkedIn is NOT affected
   */
  async getConversations(
    userId: string,
    userRole: 'admin' | 'sdr' | null,
    type?: 'email' | 'linkedin',
    folder?: string
  ): Promise<Conversation[]> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    return conversationsApi.getConversations(userId, userRole, type, folder);
  },

  /**
   * Assign a conversation to an SDR
   */
  async assignConversation(conversationId: string, sdrId: string | null, userId: string): Promise<void> {
    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }
    if (!userId) {
      throw new Error('User ID is required for activity logging');
    }

    return conversationsApi.assignConversation(conversationId, sdrId, userId);
  },

  /**
   * Bulk reassign conversations from one SDR to another
   */
  async bulkReassignConversations(fromSdrId: string, toSdrId: string | null): Promise<{ count: number }> {
    if (!fromSdrId) {
      throw new Error('From SDR ID is required');
    }

    return conversationsApi.bulkReassignConversations(fromSdrId, toSdrId);
  },

  /**
   * Update conversation status
   */
  async updateStatus(
    conversationId: string,
    status: 'new' | 'engaged' | 'qualified' | 'converted' | 'not_interested'
  ): Promise<void> {
    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }

    return conversationsApi.updateConversationStatus(conversationId, status);
  },

  /**
   * Mark conversation as read
   */
  async markAsRead(conversationId: string): Promise<void> {
    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }

    return conversationsApi.markConversationAsRead(conversationId);
  },

  /**
   * Toggle read status (user-specific after migration)
   */
  async toggleRead(conversationId: string, userId: string | undefined, isRead: boolean): Promise<void> {
    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }

    return conversationsApi.toggleConversationReadStatus(conversationId, userId || '', isRead);
  },

  /**
   * Update conversation pipeline stage
   */
  async updateStage(conversationId: string, stageId: string | null): Promise<void> {
    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }

    return conversationsApi.updateConversationStage(conversationId, stageId);
  },

  /**
   * Toggle favorite status (user-specific after migration)
   */
  async toggleFavorite(conversationId: string, userId: string | undefined, isFavorite?: boolean): Promise<void> {
    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }

    return conversationsApi.toggleFavoriteConversation(conversationId, userId || '', isFavorite);
  },

  async deleteConversation(conversationId: string): Promise<void> {
    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }

    return conversationsApi.deleteConversation(conversationId);
  },

  /**
   * Get a single conversation by ID
   */
  async getById(conversationId: string): Promise<Conversation | null> {
    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }

    return conversationsApi.getConversationById(conversationId);
  },

  /**
   * Update lead profile information
   */
  async updateLeadProfile(
    conversationId: string,
    updates: {
      sender_name?: string;
      sender_email?: string;
      mobile?: string;
      company_name?: string;
      location?: string;
    }
  ): Promise<void> {
    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }

    return conversationsApi.updateLeadProfile(conversationId, updates);
  },

  /**
   * Get mailbox folder counts (assignment-aware for SDRs)
   */
  async getMailboxCounts(
    userId: string,
    userRole: 'admin' | 'sdr' | null
  ): Promise<{ inbox: number; sent: number; archive: number; trash: number }> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    return conversationsApi.getMailboxCounts(userId, userRole);
  },

  /**
   * Get email senders grouped by sender_email for Sales Pipeline
   * Returns one SenderPipelineItem per unique sender_email
   */
  async getEmailSendersPipelineItems(
    userId: string,
    userRole: 'admin' | 'sdr' | null,
    workspaceId: string
  ): Promise<any[]> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!workspaceId) {
      throw new Error('Workspace ID is required');
    }

    return conversationsApi.getEmailSendersPipelineItems(userId, userRole, workspaceId);
  },

  /**
   * Update stage for all email conversations with a given sender_email
   * Phase-3: Bulk stage update
   */
  async updateEmailSenderStage(
    senderEmail: string,
    stageId: string | null,
    userId: string,
    userRole: 'admin' | 'sdr' | null,
    workspaceId: string
  ): Promise<{ updated_count: number }> {
    if (!senderEmail) {
      throw new Error('Sender email is required');
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!workspaceId) {
      throw new Error('Workspace ID is required');
    }

    return conversationsApi.updateEmailSenderStage(
      senderEmail,
      stageId,
      userId,
      userRole,
      workspaceId
    );
  },

  /**
   * Assign SDR for all email conversations with a given sender_email
   * Phase-3: Bulk assignment
   */
  async updateEmailSenderAssignment(
    senderEmail: string,
    assignedTo: string | null,
    userId: string,
    userRole: 'admin' | 'sdr' | null,
    workspaceId: string
  ): Promise<{ updated_count: number }> {
    if (!senderEmail) {
      throw new Error('Sender email is required');
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!workspaceId) {
      throw new Error('Workspace ID is required');
    }

    return conversationsApi.updateEmailSenderAssignment(
      senderEmail,
      assignedTo,
      userId,
      userRole,
      workspaceId
    );
  },
};

