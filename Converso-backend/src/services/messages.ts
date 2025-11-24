import * as messagesApi from '../api/messages';
import type { Message } from '../types';

/**
 * Service layer for messages - contains business logic
 */

export const messagesService = {
  /**
   * Get all messages for a conversation
   */
  async getMessages(conversationId: string): Promise<Message[]> {
    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }

    return messagesApi.getMessages(conversationId);
  },

  /**
   * Send a message in a conversation
   */
  async sendMessage(conversationId: string, userId: string, content: string): Promise<void> {
    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!content || content.trim().length === 0) {
      throw new Error('Message content cannot be empty');
    }

    return messagesApi.sendMessage(conversationId, userId, content);
  },

  /**
   * Get a single message by ID
   */
  async getById(messageId: string): Promise<Message | null> {
    if (!messageId) {
      throw new Error('Message ID is required');
    }

    return messagesApi.getMessageById(messageId);
  },
};

