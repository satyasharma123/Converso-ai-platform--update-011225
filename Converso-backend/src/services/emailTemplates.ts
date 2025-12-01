import * as emailTemplatesApi from '../api/emailTemplates';
import type { EmailTemplate } from '../api/emailTemplates';

/**
 * Service layer for email templates - contains business logic
 */

export const emailTemplatesService = {
  /**
   * Get all email templates for a user's workspace
   */
  async getEmailTemplates(userId: string): Promise<EmailTemplate[]> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    return emailTemplatesApi.getEmailTemplates(userId);
  },

  /**
   * Get a single email template by ID
   */
  async getEmailTemplateById(templateId: string): Promise<EmailTemplate | null> {
    if (!templateId) {
      throw new Error('Template ID is required');
    }

    return emailTemplatesApi.getEmailTemplateById(templateId);
  },

  /**
   * Create a new email template
   */
  async createEmailTemplate(
    userId: string,
    data: {
      title: string;
      content: string;
      category: string;
      shortcut?: string;
    }
  ): Promise<EmailTemplate> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!data.title || !data.content) {
      throw new Error('Title and content are required');
    }

    if (!data.category) {
      throw new Error('Category is required');
    }

    return emailTemplatesApi.createEmailTemplate(userId, data);
  },

  /**
   * Update an email template
   */
  async updateEmailTemplate(
    templateId: string,
    data: {
      title?: string;
      content?: string;
      category?: string;
      shortcut?: string;
    }
  ): Promise<EmailTemplate> {
    if (!templateId) {
      throw new Error('Template ID is required');
    }

    return emailTemplatesApi.updateEmailTemplate(templateId, data);
  },

  /**
   * Delete an email template
   */
  async deleteEmailTemplate(templateId: string): Promise<void> {
    if (!templateId) {
      throw new Error('Template ID is required');
    }

    await emailTemplatesApi.deleteEmailTemplate(templateId);
  },
};

