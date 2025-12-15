import { supabase, supabaseAdmin } from '../lib/supabase';
import { logger } from '../utils/logger';
import type { Conversation } from '../types';

/**
 * API module for conversation-related database queries
 */

const SUPABASE_TIMEOUT_MS = 4000;

async function withTimeout<T>(promise: Promise<T>, description: string): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Timed out while ${description} after ${SUPABASE_TIMEOUT_MS}ms`));
    }, SUPABASE_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

/**
 * Get workspace ID for a user
 */
async function getUserWorkspaceId(userId: string): Promise<string | null> {
  try {
    const { data: profile, error } = await withTimeout(
      supabaseAdmin
        .from('profiles')
        .select('workspace_id')
        .eq('id', userId)
        .single(),
      'fetching user workspace'
    );

    if (!error && profile?.workspace_id) {
      return profile.workspace_id;
    }
  } catch (err) {
    logger.warn('[Conversations] Failed to fetch user workspace, falling back to default', {
      error: err instanceof Error ? err.message : err,
      userId,
    });
  }

  try {
    const { data: workspace } = await withTimeout(
      supabaseAdmin.from('workspaces').select('id').limit(1).single(),
      'fetching default workspace'
    );

    return workspace?.id || null;
  } catch (err) {
    logger.error('[Conversations] Failed to determine fallback workspace', {
      error: err instanceof Error ? err.message : err,
    });
    return null;
  }
}

export async function getConversations(
  userId: string,
  userRole: 'admin' | 'sdr' | null,
  type?: 'email' | 'linkedin'
): Promise<Conversation[]> {
  // Get user's workspace
  const workspaceId = await getUserWorkspaceId(userId);
  
  let query = supabaseAdmin
    .from('conversations')
    .select(`
      *,
      received_account:connected_accounts(
        account_name,
        account_email,
        account_type,
        oauth_provider,
        unipile_account_id
      )
    `)
    .order('last_message_at', { ascending: false });

  // Filter by workspace if available, but include legacy records missing workspace_id
  if (workspaceId) {
    query = query.or(`workspace_id.eq.${workspaceId},workspace_id.is.null`);
  }

  // Filter by type if specified
  if (type) {
    query = query.eq('conversation_type', type);
  }

  // SDRs only see their assigned conversations
  if (userRole === 'sdr') {
    // SDRs should see their assigned conversations AND any unassigned conversations
    query = query.or(`assigned_to.eq.${userId},assigned_to.is.null`);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as Conversation[];
}

export async function assignConversation(
  conversationId: string,
  sdrId: string | null
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('conversations')
    .update({ assigned_to: sdrId })
    .eq('id', conversationId);

  if (error) throw error;
}

/**
 * Bulk reassign conversations from one SDR to another (or unassign)
 */
export async function bulkReassignConversations(
  fromSdrId: string,
  toSdrId: string | null
): Promise<{ count: number }> {
  const { data, error } = await supabaseAdmin
    .from('conversations')
    .update({ assigned_to: toSdrId })
    .eq('assigned_to', fromSdrId)
    .select('id');

  if (error) throw error;

  return { count: data?.length || 0 };
}

export async function updateConversationStatus(
  conversationId: string,
  status: 'new' | 'engaged' | 'qualified' | 'converted' | 'not_interested'
): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ status })
    .eq('id', conversationId);

  if (error) throw error;
}

export async function markConversationAsRead(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ is_read: true })
    .eq('id', conversationId);

  if (error) throw error;
}

export async function toggleConversationReadStatus(
  conversationId: string,
  isRead: boolean
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('conversations')
    .update({ is_read: isRead })
    .eq('id', conversationId);

  if (error) throw error;
}

export async function updateConversationStage(
  conversationId: string,
  stageId: string | null
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('conversations')
    .update({ custom_stage_id: stageId })
    .eq('id', conversationId);

  if (error) throw error;
}

export async function getConversationById(conversationId: string): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      *,
      received_account:connected_accounts(
        account_name,
        account_email,
        account_type
      )
    `)
    .eq('id', conversationId)
    .single();

  if (error) throw error;
  return data as Conversation | null;
}

export async function toggleFavoriteConversation(
  conversationId: string,
  isFavorite: boolean
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('conversations')
    .update({ is_favorite: isFavorite })
    .eq('id', conversationId);

  if (error) throw error;
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('conversations')
    .delete()
    .eq('id', conversationId);

  if (error) throw error;
}

export async function updateLeadProfile(
  conversationId: string,
  updates: {
    sender_name?: string;
    sender_email?: string;
    mobile?: string;
    company_name?: string;
    location?: string;
  }
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('conversations')
    .update(updates)
    .eq('id', conversationId);

  if (error) throw error;
}

