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
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('workspace_id')
      .eq('id', userId)
      .single();

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
    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('id')
      .limit(1)
      .single();

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
  type?: 'email' | 'linkedin',
  folder?: string
): Promise<Conversation[]> {
  // Get user's workspace
  const workspaceId = await getUserWorkspaceId(userId);
  
  console.log(`[Conversations API] type=${type}, folder=${folder}, userId=${userId}`);
  
  // ===================================================================
  // ✅ EMAIL WITH FOLDER: Provider-truth filtering (no inference)
  // Only return conversations that have messages in the requested folder
  // ===================================================================
  if (type === 'email' && folder) {
    // Normalize folder name: 'deleted' → 'trash' for provider consistency
    const normalizedFolder = folder === 'deleted' ? 'trash' : folder;
    
    console.log(`[EMAIL FOLDER] Requested folder: ${folder}, normalized: ${normalizedFolder}`);
    
    return await getEmailConversationsByFolder(workspaceId, userId, userRole, normalizedFolder);
  }
  
  // ===================================================================
  // ✅ LINKEDIN OR EMAIL WITHOUT FOLDER: Simple query
  // ===================================================================
  let query = supabaseAdmin
    .from('conversations')
    .select(`
      *,
      unread_count,
      received_account:connected_accounts(
        id,
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
    query = query.or(`assigned_to.eq.${userId},assigned_to.is.null`);
  }

  const { data, error } = await query;

  if (error) throw error;
  
  const conversations = (data as Conversation[]) || [];
  
  if (type === 'email') {
    console.log(`[EMAIL] Returned ${conversations.length} conversations (no folder filter)`);
  }

  return conversations;
}

/**
 * Get email conversations filtered by folder using provider_folder from messages
 * PROVIDER-TRUTH ONLY: No inference, no derived folders, no priority logic
 */
async function getEmailConversationsByFolder(
  workspaceId: string,
  userId: string,
  userRole: 'admin' | 'sdr' | null,
  folder: string
): Promise<Conversation[]> {
  console.log('[EMAIL FOLDER] Starting query for folder:', folder);
  
  // Step 1: Get all email conversations with received_account info
  let convQuery = supabaseAdmin
    .from('conversations')
    .select(`
      *,
      received_account:connected_accounts!received_on_account_id(
        id,
        account_name,
        account_email
      )
    `)
    .eq('conversation_type', 'email');

  // Filter by workspace
  if (workspaceId) {
    convQuery = convQuery.or(`workspace_id.eq.${workspaceId},workspace_id.is.null`);
  }

  // SDRs only see their assigned conversations
  if (userRole === 'sdr') {
    convQuery = convQuery.or(`assigned_to.eq.${userId},assigned_to.is.null`);
  }

  const { data: allConversations, error: convError } = await convQuery;
  
  if (convError) {
    console.error('[EMAIL FOLDER] Conversation query error:', convError);
    throw convError;
  }
  
  if (!allConversations || allConversations.length === 0) {
    console.log('[EMAIL FOLDER] No email conversations found');
    return [];
  }
  
  console.log(`[EMAIL FOLDER] Found ${allConversations.length} total email conversations`);
  
  const conversationIds = allConversations.map(c => c.id);
  
  // Step 2: Get latest message in the specific folder for each conversation
  // ✅ FIX: Batch queries to avoid HeadersOverflowError (max 100 IDs per query)
  const BATCH_SIZE = 100;
  const allFolderMessages: any[] = [];
  
  for (let i = 0; i < conversationIds.length; i += BATCH_SIZE) {
    const batch = conversationIds.slice(i, i + BATCH_SIZE);
    
    const { data: batchMessages, error: msgError } = await supabaseAdmin
      .from('messages')
      .select('conversation_id, created_at, content, subject, provider_folder, sender_name, sender_email, is_from_lead')
      .in('conversation_id', batch)
      .eq('provider_folder', folder)
      .order('created_at', { ascending: false });
    
    if (msgError) {
      console.error('[EMAIL FOLDER] Messages query error:', msgError);
      throw msgError;
    }
    
    if (batchMessages) {
      allFolderMessages.push(...batchMessages);
    }
  }
  
  const folderMessages = allFolderMessages;
  
  if (!folderMessages || folderMessages.length === 0) {
    console.log(`[EMAIL FOLDER] No messages found in folder: ${folder}`);
    return [];
  }
  
  console.log(`[EMAIL FOLDER] Found ${folderMessages.length} messages in folder: ${folder}`);
  
  // Step 3: Group by conversation and get latest message per conversation
  const latestByConversation = new Map<string, any>();
  for (const msg of folderMessages) {
    if (!latestByConversation.has(msg.conversation_id)) {
      latestByConversation.set(msg.conversation_id, msg);
    }
  }
  
  // Step 4: Filter conversations that have messages in this folder
  const filtered = allConversations
    .filter(conv => latestByConversation.has(conv.id))
    .map(conv => {
      const latestMsg = latestByConversation.get(conv.id);
      return {
        ...conv,
        folder_last_message_at: latestMsg.created_at,
        folder_preview: latestMsg.content || latestMsg.subject,
        folder_name: latestMsg.provider_folder,
        folder_sender_name: latestMsg.sender_name,
        folder_sender_email: latestMsg.sender_email,
        folder_is_from_lead: latestMsg.is_from_lead
      };
    })
    .sort((a: any, b: any) => {
      return new Date(b.folder_last_message_at).getTime() - new Date(a.folder_last_message_at).getTime();
    });
  
  console.log(`[EMAIL FOLDER] Returning ${filtered.length} conversations for folder: ${folder}`);
  return filtered as Conversation[];
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
        id,
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

