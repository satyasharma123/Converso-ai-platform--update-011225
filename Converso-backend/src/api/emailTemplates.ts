import { supabaseAdmin } from '../lib/supabase';

/**
 * API module for email template-related database queries
 */

export interface EmailTemplate {
  id: string;
  workspace_id: string;
  created_by: string | null;
  title: string;
  content: string;
  category: string;
  shortcut: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Get workspace ID for a user
 */
async function getUserWorkspaceId(userId: string): Promise<string | null> {
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('workspace_id')
    .eq('id', userId)
    .single();

  if (error || !profile?.workspace_id) {
    // Fallback: get first workspace
    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('id')
      .limit(1)
      .single();
    
    return workspace?.id || null;
  }

  return profile.workspace_id;
}

/**
 * Ensure default templates exist for a workspace
 */
async function ensureDefaultTemplates(workspaceId: string): Promise<void> {
  const defaultTemplates = [
    {
      title: 'Demo Request Response',
      content: 'Thanks for your interest! I\'d love to schedule a personalized demo. Are you available this week?',
      category: 'demo',
      shortcut: '/demo',
    },
    {
      title: 'Pricing Inquiry',
      content: 'Great question! Our pricing varies based on your team size and needs. Can you share more details?',
      category: 'pricing',
      shortcut: '/pricing',
    },
    {
      title: 'Follow-up After Demo',
      content: 'It was great speaking with you! Do you have any additional questions about what we discussed?',
      category: 'follow-up',
      shortcut: '/followup',
    },
    {
      title: 'Qualification Questions',
      content: 'To better understand your needs: What\'s your current team size? What\'s your main challenge right now?',
      category: 'qualification',
      shortcut: '/qualify',
    },
    {
      title: 'Objection - Price',
      content: 'I understand budget is important. Let me show you the ROI our customers typically see in the first quarter.',
      category: 'objection',
      shortcut: '/objection-price',
    },
  ];

  // Check if templates already exist
  const { data: existingTemplates } = await supabaseAdmin
    .from('email_templates')
    .select('title')
    .eq('workspace_id', workspaceId)
    .in('title', defaultTemplates.map(t => t.title));

  const existingTitles = new Set((existingTemplates || []).map(t => t.title));
  const templatesToInsert = defaultTemplates.filter(t => !existingTitles.has(t.title));

  if (templatesToInsert.length > 0) {
    await supabaseAdmin
      .from('email_templates')
      .insert(
        templatesToInsert.map(t => ({
          workspace_id: workspaceId,
          title: t.title,
          content: t.content,
          category: t.category,
          shortcut: t.shortcut,
          is_default: true,
          created_by: null,
        }))
      );
  }
}

/**
 * Get all email templates for a workspace
 */
export async function getEmailTemplates(userId: string): Promise<EmailTemplate[]> {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[emailTemplates] getEmailTemplates called with userId:', userId);
  }
  
  const workspaceId = await getUserWorkspaceId(userId);
  if (process.env.NODE_ENV !== 'production') {
    console.log('[emailTemplates] Got workspaceId:', workspaceId);
  }
  
  if (!workspaceId) {
    throw new Error('Workspace not found');
  }

  // Ensure default templates exist
  try {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[emailTemplates] Ensuring default templates exist...');
    }
    await ensureDefaultTemplates(workspaceId);
    if (process.env.NODE_ENV !== 'production') {
      console.log('[emailTemplates] Default templates ensured');
    }
  } catch (error) {
    console.error('[emailTemplates] Error ensuring default templates:', error);
    // Continue even if ensuring fails - might already exist
  }

  const { data, error } = await supabaseAdmin
    .from('email_templates')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('category', { ascending: true })
    .order('title', { ascending: true });

  if (error) {
    console.error('[emailTemplates] Error fetching templates:', error);
    throw error;
  }
  
  if (process.env.NODE_ENV !== 'production') {
    console.log('[emailTemplates] Fetched templates count:', (data || []).length);
  }
  return (data || []) as EmailTemplate[];
}

/**
 * Get a single email template by ID
 */
export async function getEmailTemplateById(templateId: string): Promise<EmailTemplate | null> {
  const { data, error } = await supabaseAdmin
    .from('email_templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw error;
  }

  return data as EmailTemplate;
}

/**
 * Create a new email template
 */
export async function createEmailTemplate(
  userId: string,
  data: {
    title: string;
    content: string;
    category: string;
    shortcut?: string;
  }
): Promise<EmailTemplate> {
  const workspaceId = await getUserWorkspaceId(userId);
  
  if (!workspaceId) {
    throw new Error('Workspace not found');
  }

  const { data: template, error } = await supabaseAdmin
    .from('email_templates')
    .insert({
      workspace_id: workspaceId,
      created_by: userId,
      title: data.title,
      content: data.content,
      category: data.category,
      shortcut: data.shortcut || null,
      is_default: false,
    })
    .select()
    .single();

  if (error) throw error;
  return template as EmailTemplate;
}

/**
 * Update an email template
 */
export async function updateEmailTemplate(
  templateId: string,
  data: {
    title?: string;
    content?: string;
    category?: string;
    shortcut?: string;
  }
): Promise<EmailTemplate> {
  const { data: template, error } = await supabaseAdmin
    .from('email_templates')
    .update({
      ...data,
      shortcut: data.shortcut !== undefined ? (data.shortcut || null) : undefined,
    })
    .eq('id', templateId)
    .select()
    .single();

  if (error) throw error;
  return template as EmailTemplate;
}

/**
 * Delete an email template
 */
export async function deleteEmailTemplate(templateId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('email_templates')
    .delete()
    .eq('id', templateId);

  if (error) throw error;
}

