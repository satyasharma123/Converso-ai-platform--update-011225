import * as conversationsApi from '../api/conversations';
import type { Conversation } from '../types';

/**
 * Service layer for conversations - contains business logic
 */

export const conversationsService = {
  /**
   * Get conversations with role-based filtering
   */
  async getConversations(
    userId: string,
    userRole: 'admin' | 'sdr' | null,
    type?: 'email' | 'linkedin'
  ): Promise<Conversation[]> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    return conversationsApi.getConversations(userId, userRole, type);
  },

  /**
   * Assign a conversation to an SDR
   */
  async assignConversation(conversationId: string, sdrId: string | null): Promise<void> {
    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }

    return conversationsApi.assignConversation(conversationId, sdrId);
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
   * Toggle read status
   */
  async toggleRead(conversationId: string, isRead: boolean): Promise<void> {
    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }

    return conversationsApi.toggleConversationReadStatus(conversationId, isRead);
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
   * Get a single conversation by ID
   */
  async getById(conversationId: string): Promise<Conversation | null> {
    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }

    return conversationsApi.getConversationById(conversationId);
  },
};

