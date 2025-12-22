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

  /**
   * Get activities for email sender (all conversations from sender)
   * Read-only endpoint for Sales Pipeline
   */
  async getEmailSenderActivities(workspaceId: string, senderEmail: string): Promise<any[]> {
    if (!workspaceId) {
      throw new Error('Workspace ID is required');
    }
    if (!senderEmail) {
      throw new Error('Sender email is required');
    }

    return conversationsApi.getEmailSenderActivities(workspaceId, senderEmail);
  },

  /**
   * Get work queue with operational metrics
   * Phase 1.1: Backend-only, read-only endpoint
   */
  async getWorkQueue(
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

    return conversationsApi.getWorkQueue(userId, userRole, workspaceId);
  },

  /**
   * Get work queue from SQL view
   * Sprint 5.1: Read from conversation_work_queue view
   * 
   * Applies email grouping for Work Queue display only.
   * Sales Pipeline uses raw data from getWorkQueueFromView directly.
   */
  async getWorkQueueFromView(
    userId: string,
    userRole: 'admin' | 'sdr' | null,
    workspaceId: string,
    filter: 'all' | 'pending' | 'overdue' | 'idle' = 'all'
  ): Promise<any[]> {
    if (!userId) {
      throw new Error('User ID is required');
    }
    if (!workspaceId) {
      throw new Error('Workspace ID is required');
    }

    // Get raw rows from view (no grouping)
    const rows = await conversationsApi.getWorkQueueFromView(userId, userRole, workspaceId, filter);
    
    // Apply Work Queue-specific email grouping
    const grouped = groupWorkQueueEmails(rows);
    
    return grouped;
  },
};

/**
 * Group Work Queue email rows by sender_email
 * Work Queue ONLY - do not use elsewhere
 * 
 * Groups email conversations by sender_email (normalized: lowercase + trim)
 * Selects latest conversation per sender for status/metrics
 * Preserves LinkedIn conversations (no grouping - already correct)
 */
function groupWorkQueueEmails(rows: any[]): any[] {
  const emailItems = rows.filter(
    r => r.conversation_type === 'email' && r.sender_email
  );

  const linkedinItems = rows.filter(
    r => r.conversation_type === 'linkedin'
  );

  const senderMap = new Map<string, any[]>();

  for (const item of emailItems) {
    const email = item.sender_email;
    if (!email) continue;

    // Normalize sender_email: lowercase and trim
    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail) continue;

    if (!senderMap.has(normalizedEmail)) {
      senderMap.set(normalizedEmail, []);
    }
    senderMap.get(normalizedEmail)!.push(item);
  }

  // Build grouped email items (one per sender_email)
  const groupedEmailItems: any[] = [];
  for (const [senderEmail, items] of senderMap.entries()) {
    // Sort by last_message_at DESC to get latest
    const sortedItems = [...items].sort((a, b) => {
      const timeA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const timeB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return timeB - timeA;
    });

    const latestItem = sortedItems[0];

    // Use latest conversation's data
    // This ensures status, idle_days, etc. reflect the most recent communication
    groupedEmailItems.push({
      ...latestItem,
      sender_email: senderEmail, // Use normalized email
      conversation_count: items.length, // Number of email threads with this sender
    });
  }

  // Combine grouped emails + ungrouped LinkedIn items
  const result = [...groupedEmailItems, ...linkedinItems];

  // Re-sort by original sort order (overdue DESC, last_inbound_at ASC)
  result.sort((a, b) => {
    // First sort by overdue (true first)
    if (a.overdue !== b.overdue) {
      return a.overdue ? -1 : 1;
    }
    // Then by last_inbound_at (oldest first)
    const timeA = a.last_inbound_at ? new Date(a.last_inbound_at).getTime() : 0;
    const timeB = b.last_inbound_at ? new Date(b.last_inbound_at).getTime() : 0;
    return timeA - timeB;
  });

  return result;
}

