import { supabase, supabaseAdmin } from '../lib/supabase';
import { logger } from '../utils/logger';
import { getUserWorkspaceId } from '../utils/workspace';
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
 * Safely fetch user-specific state for conversations
 * Returns a map of conversation_id -> {is_favorite, is_read}
 * Falls back gracefully if table doesn't exist
 */
async function getUserConversationStates(
  userId: string,
  conversationIds: string[]
): Promise<Map<string, { is_favorite: boolean; is_read: boolean }>> {
  const stateMap = new Map();
  
  if (!userId || conversationIds.length === 0) {
    return stateMap;
  }
  
  try {
    // Try to query conversation_user_state table
    const { data, error } = await supabaseAdmin
      .from('conversation_user_state')
      .select('conversation_id, is_favorite, is_read')
      .eq('user_id', userId)
      .in('conversation_id', conversationIds);
    
    if (!error && data) {
      data.forEach(state => {
        stateMap.set(state.conversation_id, {
          is_favorite: state.is_favorite,
          is_read: state.is_read
        });
      });
    }
  } catch (err) {
    // Table doesn't exist yet - this is OK, we'll use fallback
    logger.debug('[User State] conversation_user_state table not available, using fallback');
  }
  
  return stateMap;
}

// getUserWorkspaceId moved to utils/workspace.ts

export async function getConversations(
  userId: string,
  userRole: 'admin' | 'sdr' | null,
  type?: 'email' | 'linkedin',
  folder?: string
): Promise<Conversation[]> {
  // Get user's workspace
  const workspaceId = await getUserWorkspaceId(userId);
  
  console.log(`[Conversations API] type=${type}, folder=${folder}, userId=${userId}, userRole=${userRole}`);
  
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

  // IMPORTANT:
  // supabaseAdmin bypasses RLS.
  // SDR filtering here MUST exactly match RLS:
  // SDRs can ONLY see conversations where assigned_to = userId
  if (userRole === 'sdr') {
    console.log(`[EMAIL SDR FILTER] Applying assigned_to filter for userId: ${userId}`);
    query = query.eq('assigned_to', userId);
  }

  const { data, error } = await query;

  if (error) {
    console.error(`[EMAIL QUERY ERROR]`, error);
    throw error;
  }
  
  let conversations = (data as Conversation[]) || [];
  console.log(`[EMAIL QUERY RESULT] Found ${conversations.length} conversations BEFORE user state merge`);
  
  // Fetch user-specific state and merge it with conversations
  // Unread status is user-specific: Admin unread ≠ SDR unread
  if (conversations.length > 0 && userId) {
    const conversationIds = conversations.map(c => c.id);
    const userStates = await getUserConversationStates(userId, conversationIds);
    
    // Merge user-specific state with conversations
    conversations = conversations.map(conv => {
      const userState = userStates.get(conv.id);
      if (userState) {
        // User has specific state - use it (user-specific read/favorite)
        return {
          ...conv,
          is_favorite: userState.is_favorite,
          is_read: userState.is_read // User-specific read status
        };
      }
      // No user-specific state - fallback to conversation defaults (legacy behavior)
      return conv;
    });
  }
  
  if (type === 'email') {
    console.log(`[EMAIL FINAL] Returning ${conversations.length} conversations (userRole=${userRole}, folder=${folder || 'none'})`);
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
  console.log(`[EMAIL FOLDER] Starting query for folder: ${folder}, userRole: ${userRole}, userId: ${userId}`);
  
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

  // IMPORTANT:
  // supabaseAdmin bypasses RLS.
  // SDR filtering here MUST exactly match RLS:
  // SDRs can ONLY see conversations where assigned_to = userId
  if (userRole === 'sdr') {
    console.log(`[EMAIL FOLDER SDR] Applying assigned_to filter for userId: ${userId}`);
    convQuery = convQuery.eq('assigned_to', userId);
  }

  const { data: allConversations, error: convError } = await convQuery;
  
  if (convError) {
    console.error('[EMAIL FOLDER] Conversation query error:', convError);
    throw convError;
  }
  
  if (!allConversations || allConversations.length === 0) {
    console.log(`[EMAIL FOLDER] No email conversations found (userRole=${userRole}, folder=${folder})`);
    return [];
  }
  
  console.log(`[EMAIL FOLDER] Found ${allConversations.length} total email conversations for userRole=${userRole}`);
  
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
  
  console.log(`[EMAIL FOLDER] Filtered to ${filtered.length} conversations with messages in folder: ${folder}`);
  
  // Fetch user-specific state and merge it with conversations
  // Unread status is user-specific: Admin unread ≠ SDR unread
  let result = filtered as Conversation[];
  if (result.length > 0 && userId) {
    const conversationIds = result.map(c => c.id);
    const userStates = await getUserConversationStates(userId, conversationIds);
    
    // Merge user-specific state with conversations
    result = result.map(conv => {
      const userState = userStates.get(conv.id);
      if (userState) {
        // User has specific state - use it (user-specific read/favorite)
        return {
          ...conv,
          is_favorite: userState.is_favorite,
          is_read: userState.is_read // User-specific read status
        };
      }
      // No user-specific state - fallback to conversation defaults (legacy behavior)
      return conv;
    });
  }
  
  console.log(`[EMAIL FOLDER FINAL] Returning ${result.length} conversations (userRole=${userRole}, folder=${folder})`);
  return result;
}

export async function assignConversation(
  conversationId: string,
  sdrId: string | null,
  userId: string
): Promise<void> {
  // Step 1: Fetch conversation to get type, workspace_id, sender_email, and old assigned_to
  const { data: conversation, error: fetchError } = await supabaseAdmin
    .from('conversations')
    .select('id, conversation_type, sender_email, workspace_id, assigned_to')
    .eq('id', conversationId)
    .single();

  if (fetchError) throw fetchError;
  if (!conversation) throw new Error('Conversation not found');

  const workspaceId = conversation.workspace_id;

  // Step 2: If not email, use single-conversation update (existing behavior)
  if (conversation.conversation_type !== 'email') {
    const oldAssignedTo = conversation.assigned_to;

    // Perform update
    const { error: updateError } = await supabaseAdmin
      .from('conversations')
      .update({ assigned_to: sdrId })
      .eq('id', conversationId);

    if (updateError) throw updateError;

    // Log activity (non-fatal)
    const now = new Date().toISOString();
    const { error: activityError } = await supabaseAdmin
      .from('conversation_activities')
      .insert({
        workspace_id: workspaceId,
        conversation_id: conversationId,
        actor_user_id: userId,
        activity_type: 'assigned',
        meta: {
          from_assigned_to: oldAssignedTo,
          to_assigned_to: sdrId,
        },
        created_at: now,
      });

    if (activityError) {
      logger.warn('[Assign Conversation] Error inserting activity (non-fatal):', activityError);
    }
    return;
  }

  // Step 3: For email, update ALL conversations from same sender
  const normalizedEmail = conversation.sender_email?.toLowerCase().trim();
  
  if (!normalizedEmail) {
    // Fallback to single update if no sender_email
    const oldAssignedTo = conversation.assigned_to;

    const { error: updateError } = await supabaseAdmin
      .from('conversations')
      .update({ assigned_to: sdrId })
      .eq('id', conversationId);

    if (updateError) throw updateError;

    const now = new Date().toISOString();
    const { error: activityError } = await supabaseAdmin
      .from('conversation_activities')
      .insert({
        workspace_id: workspaceId,
        conversation_id: conversationId,
        actor_user_id: userId,
        activity_type: 'assigned',
        meta: {
          from_assigned_to: oldAssignedTo,
          to_assigned_to: sdrId,
        },
        created_at: now,
      });

    if (activityError) {
      logger.warn('[Assign Conversation] Error inserting activity (non-fatal):', activityError);
    }
    return;
  }

  // Step 4: Fetch ALL email conversations from this sender to capture old values
  const { data: conversations, error: fetchAllError } = await supabaseAdmin
    .from('conversations')
    .select('id, assigned_to')
    .eq('conversation_type', 'email')
    .eq('workspace_id', workspaceId)
    .eq('sender_email', normalizedEmail); // Exact match on normalized email

  if (fetchAllError) throw fetchAllError;
  if (!conversations || conversations.length === 0) {
    throw new Error('No conversations found for this sender');
  }

  // Step 5: Update all conversations
  const { error: updateError } = await supabaseAdmin
    .from('conversations')
    .update({ assigned_to: sdrId })
    .eq('conversation_type', 'email')
    .eq('workspace_id', workspaceId)
    .eq('sender_email', normalizedEmail); // Exact match on normalized email

  if (updateError) throw updateError;

  // Step 6: Log activity for each conversation (batch insert)
  const now = new Date().toISOString();
  const activities = conversations.map(conv => ({
    workspace_id: workspaceId,
    conversation_id: conv.id,
    actor_user_id: userId,
    activity_type: 'assigned',
    meta: {
      from_assigned_to: conv.assigned_to,
      to_assigned_to: sdrId,
    },
    created_at: now,
  }));

  if (activities.length > 0) {
    const { error: activityError } = await supabaseAdmin
      .from('conversation_activities')
      .insert(activities);

    if (activityError) {
      logger.warn('[Assign Conversation] Error inserting activities (non-fatal):', activityError);
      // Don't throw - activity logging is not critical for operation
    }
  }
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

export async function markConversationAsRead(
  conversationId: string,
  userId?: string
): Promise<void> {
  // If userId provided, use user-specific state (new method)
  // Admin unread ≠ SDR unread
  if (userId) {
    try {
      const { error } = await supabaseAdmin
        .from('conversation_user_state')
        .upsert({
          conversation_id: conversationId,
          user_id: userId,
          is_read: true,
          is_favorite: false, // Default, will be overwritten if exists
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'conversation_id,user_id',
          ignoreDuplicates: false
        });
      
      if (!error) {
        // Success - user-specific read status saved
        // Do NOT write to conversations.is_read (legacy fallback only)
        return;
      }
    } catch (err) {
      // Table doesn't exist yet, fall through to legacy method
    }
  }
  
  // Fallback to legacy method (for backward compatibility or if no userId)
  const { error } = await supabase
    .from('conversations')
    .update({ is_read: true })
    .eq('id', conversationId);

  if (error) throw error;
}

export async function toggleConversationReadStatus(
  conversationId: string,
  userId: string,
  isRead: boolean
): Promise<void> {
  if (!userId) {
    // Fallback to legacy method if no userId (backward compatibility)
    const { error } = await supabaseAdmin
      .from('conversations')
      .update({ is_read: isRead })
      .eq('id', conversationId);
    if (error) throw error;
    return;
  }
  
  // Write to conversation_user_state for user-specific read status
  // Admin unread ≠ SDR unread
  try {
    const { error } = await supabaseAdmin
      .from('conversation_user_state')
      .upsert({
        conversation_id: conversationId,
        user_id: userId,
        is_read: isRead,
        is_favorite: false, // Default, will be overwritten if exists
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'conversation_id,user_id',
        ignoreDuplicates: false
      });
    
    if (!error) {
      // Success - user-specific read status saved
      // Do NOT write to conversations.is_read (legacy fallback only)
      return;
    }
  } catch (err) {
    // Table doesn't exist yet - fallback to legacy method for backward compatibility
  }
  
  // Fallback to legacy method only if conversation_user_state table doesn't exist
  // This ensures backward compatibility during migration
  const { error } = await supabaseAdmin
    .from('conversations')
    .update({ is_read: isRead })
    .eq('id', conversationId);
  
  if (error) throw error;
}

export async function markConversationRead(
  conversationId: string,
  userId: string
): Promise<void> {
  if (!userId) {
    // Fallback to legacy method if no userId (backward compatibility)
    const { error } = await supabaseAdmin
      .from('conversations')
      .update({ is_read: true })
      .eq('id', conversationId);
    if (error) throw error;
    return;
  }
  
  // Write to conversation_user_state for user-specific read status
  // Admin unread ≠ SDR unread
  try {
    const { error } = await supabaseAdmin
      .from('conversation_user_state')
      .upsert({
        conversation_id: conversationId,
        user_id: userId,
        is_read: true,
        is_favorite: false, // Default, will be overwritten if exists
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'conversation_id,user_id',
        ignoreDuplicates: false
      });
    
    if (!error) {
      // Success - user-specific read status saved
      // Do NOT write to conversations.is_read (legacy fallback only)
      return;
    }
  } catch (err) {
    // Table doesn't exist yet - fallback to legacy method for backward compatibility
  }
  
  // Fallback to legacy method only if conversation_user_state table doesn't exist
  const { error } = await supabaseAdmin
    .from('conversations')
    .update({ is_read: true })
    .eq('id', conversationId);

  if (error) throw error;
}

export async function updateConversationStage(
  conversationId: string,
  stageId: string | null
): Promise<void> {
  // Step 1: Fetch the conversation to check type and get sender info
  const { data: conversation, error: fetchError } = await supabaseAdmin
    .from('conversations')
    .select('id, conversation_type, sender_email, workspace_id')
    .eq('id', conversationId)
    .single();

  if (fetchError) throw fetchError;
  if (!conversation) throw new Error('Conversation not found');

  // Step 2: If not email, use single-conversation update (existing behavior)
  if (conversation.conversation_type !== 'email') {
    const { error } = await supabaseAdmin
      .from('conversations')
      .update({ custom_stage_id: stageId })
      .eq('id', conversationId);

    if (error) throw error;
    return;
  }

  // Step 3: For email, update ALL conversations from same sender
  const normalizedEmail = conversation.sender_email?.toLowerCase().trim();
  
  if (!normalizedEmail) {
    // Fallback to single update if no sender_email
    const { error } = await supabaseAdmin
      .from('conversations')
      .update({ custom_stage_id: stageId })
      .eq('id', conversationId);

    if (error) throw error;
    return;
  }

  // Update all email conversations from this sender in the workspace
  const now = new Date().toISOString();
  const { error: updateError } = await supabaseAdmin
    .from('conversations')
    .update({ 
      custom_stage_id: stageId,
      stage_assigned_at: now
    })
    .eq('conversation_type', 'email')
    .eq('workspace_id', conversation.workspace_id)
    .eq('sender_email', normalizedEmail); // Exact match on normalized email

  if (updateError) throw updateError;

  // Note: Triggers will handle activity logging automatically
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
  userId: string,
  isFavorite?: boolean
): Promise<void> {
  if (!userId) {
    // Fallback to old method if no userId
    let newValue = isFavorite;
    if (newValue === undefined) {
      const { data: conv } = await supabaseAdmin
        .from('conversations')
        .select('is_favorite')
        .eq('id', conversationId)
        .single();
      newValue = !conv?.is_favorite;
    }
    
    const { error } = await supabaseAdmin
      .from('conversations')
      .update({ is_favorite: newValue })
      .eq('id', conversationId);
    if (error) throw error;
    return;
  }
  
  try {
    // Try to use conversation_user_state table (new method)
    // First, get current state to toggle if needed
    let newValue = isFavorite;
    if (newValue === undefined) {
      const { data: state } = await supabaseAdmin
        .from('conversation_user_state')
        .select('is_favorite')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .single();
      newValue = !state?.is_favorite;
    }
    
    const { error } = await supabaseAdmin
      .from('conversation_user_state')
      .upsert({
        conversation_id: conversationId,
        user_id: userId,
        is_favorite: newValue,
        is_read: true, // Default, will be overwritten if exists
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'conversation_id,user_id',
        ignoreDuplicates: false
      });
    
    if (!error) {
      // Success with new method
      return;
    }
    
    // If error, fall through to old method
    logger.debug('[Toggle Favorite] conversation_user_state not available, using fallback');
  } catch (err) {
    // Table doesn't exist yet, use fallback
    logger.debug('[Toggle Favorite] Using fallback method');
  }
  
  // Fallback to old method
  let newValue = isFavorite;
  if (newValue === undefined) {
    const { data: conv } = await supabaseAdmin
      .from('conversations')
      .select('is_favorite')
      .eq('id', conversationId)
      .single();
    newValue = !conv?.is_favorite;
  }
  
  const { error } = await supabaseAdmin
    .from('conversations')
    .update({ is_favorite: newValue })
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

/**
 * Get mailbox folder counts (assignment-aware for SDRs)
 * Returns counts for inbox, sent, archive, trash folders
 */
export async function getMailboxCounts(
  userId: string,
  userRole: 'admin' | 'sdr' | null
): Promise<{ inbox: number; sent: number; archive: number; trash: number }> {
  const workspaceId = await getUserWorkspaceId(userId);
  
  // Build query for email conversations
  let convListQuery = supabaseAdmin
    .from('conversations')
    .select('id')
    .eq('conversation_type', 'email');
  
  // Filter by workspace
  if (workspaceId) {
    convListQuery = convListQuery.or(`workspace_id.eq.${workspaceId},workspace_id.is.null`);
  }
  
  // IMPORTANT: SDRs can ONLY see assigned conversations
  if (userRole === 'sdr') {
    convListQuery = convListQuery.eq('assigned_to', userId);
  }
  
  // Get conversation IDs for this user/role
  const { data: conversations, error: convError } = await convListQuery;
  
  if (convError || !conversations || conversations.length === 0) {
    return { inbox: 0, sent: 0, archive: 0, trash: 0 };
  }
  
  const conversationIds = conversations.map(c => c.id);
  
  // Count conversations by folder using messages table
  const folderCounts: Record<string, number> = {};
  
  for (const folder of ['inbox', 'sent', 'archive', 'trash']) {
    // Get distinct conversation IDs that have messages in this folder
    const { data: folderConvs, error: folderError } = await supabaseAdmin
      .from('messages')
      .select('conversation_id', { count: 'exact', head: false })
      .in('conversation_id', conversationIds)
      .eq('provider_folder', folder);
    
    if (!folderError && folderConvs) {
      // Count unique conversation IDs
      const uniqueConvIds = new Set(folderConvs.map((m: any) => m.conversation_id));
      folderCounts[folder] = uniqueConvIds.size;
    } else {
      folderCounts[folder] = 0;
    }
  }
  
  return {
    inbox: folderCounts.inbox || 0,
    sent: folderCounts.sent || 0,
    archive: folderCounts.archive || 0,
    trash: folderCounts.trash || 0,
  };
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

/**
 * Get email senders grouped by sender_email for Sales Pipeline
 * Returns one SenderPipelineItem per unique sender_email
 */
export async function getEmailSendersPipelineItems(
  userId: string,
  userRole: 'admin' | 'sdr' | null,
  workspaceId: string
): Promise<any[]> {
  if (!workspaceId) {
    throw new Error('Workspace ID is required');
  }

  // Step 1: Get all email conversations for this workspace with role filtering
  let conversationsQuery = supabaseAdmin
    .from('conversations')
    .select(`
      id,
      sender_email,
      sender_name,
      last_message_at,
      preview,
      subject,
      assigned_to,
      custom_stage_id,
      stage_assigned_at,
      received_on_account_id,
      workspace_id
    `)
    .eq('conversation_type', 'email')
    .eq('workspace_id', workspaceId)
    .not('sender_email', 'is', null)
    .order('sender_email', { ascending: true })
    .order('last_message_at', { ascending: false });

  // SDR filtering: only assigned conversations
  if (userRole === 'sdr') {
    conversationsQuery = conversationsQuery.eq('assigned_to', userId);
  }

  const { data: conversations, error: convError } = await conversationsQuery;

  if (convError) {
    logger.error('[Email Senders Pipeline] Error fetching conversations:', convError);
    throw convError;
  }

  if (!conversations || conversations.length === 0) {
    return [];
  }

  // Step 2: Group conversations by sender_email (normalized)
  const senderMap = new Map<string, any[]>();
  for (const conv of conversations) {
    const email = conv.sender_email;
    if (!email) continue;

    // Normalize sender_email: lowercase and trim
    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail) continue;

    if (!senderMap.has(normalizedEmail)) {
      senderMap.set(normalizedEmail, []);
    }
    senderMap.get(normalizedEmail)!.push(conv);
  }

  // Step 3: Get activity counts per sender_email (separate query)
  // First, get all conversation IDs for these senders
  const conversationIds = Array.from(senderMap.values()).flat().map(c => c.id);
  
  // Build map: conversation_id -> sender_email
  const convIdToSenderEmail = new Map<string, string>();
  for (const [senderEmail, convs] of senderMap.entries()) {
    for (const conv of convs) {
      convIdToSenderEmail.set(conv.id, senderEmail);
    }
  }

  // Initialize activity count map
  const activityCountMap = new Map<string, number>();
  
  if (conversationIds.length > 0) {
    // Get activities for these conversations
    // Batch query if too many conversation IDs (Supabase limit ~1000)
    const BATCH_SIZE = 1000;
    for (let i = 0; i < conversationIds.length; i += BATCH_SIZE) {
      const batch = conversationIds.slice(i, i + BATCH_SIZE);
      const { data: activities, error: activityError } = await supabaseAdmin
        .from('conversation_activities')
        .select('conversation_id')
        .in('conversation_id', batch);

      if (activityError) {
        logger.warn('[Email Senders Pipeline] Error fetching activities batch:', activityError);
        // Continue with partial counts if some batches fail
        continue;
      }

      // Count activities per sender_email
      for (const act of (activities || [])) {
        const senderEmail = convIdToSenderEmail.get(act.conversation_id);
        if (senderEmail) {
          activityCountMap.set(senderEmail, (activityCountMap.get(senderEmail) || 0) + 1);
        }
      }
    }
  }

  // Step 4: Batch fetch all received_accounts
  const accountIds = new Set<string>();
  for (const convs of senderMap.values()) {
    for (const conv of convs) {
      if (conv.received_on_account_id) {
        accountIds.add(conv.received_on_account_id);
      }
    }
  }

  const accountIdArray = Array.from(accountIds);
  const accountMap = new Map<string, any>();
  
  if (accountIdArray.length > 0) {
    const { data: accounts } = await supabaseAdmin
      .from('connected_accounts')
      .select('id, account_name, account_email, account_type, oauth_provider')
      .in('id', accountIdArray);

    if (accounts) {
      for (const account of accounts) {
        accountMap.set(account.id, {
          id: account.id,
          account_name: account.account_name,
          account_email: account.account_email || '',
          account_type: account.account_type,
          oauth_provider: account.oauth_provider || '',
        });
      }
    }
  }

  // Step 5: Build SenderPipelineItem for each sender_email
  const senderItems: any[] = [];

  for (const [senderEmail, convs] of senderMap.entries()) {
    // Sort conversations by last_message_at DESC to get latest
    const sortedConvs = [...convs].sort((a, b) => {
      const timeA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const timeB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return timeB - timeA;
    });

    const latestConv = sortedConvs[0];

    // Conflict resolution for assigned_to
    const uniqueAssignedTo = new Set(convs.map(c => c.assigned_to).filter(Boolean));
    const resolvedAssignedTo = uniqueAssignedTo.size === 1 
      ? Array.from(uniqueAssignedTo)[0] 
      : latestConv.assigned_to;

    // Conflict resolution for custom_stage_id
    const uniqueStageIds = new Set(convs.map(c => c.custom_stage_id).filter(Boolean));
    const resolvedStageId = uniqueStageIds.size === 1 
      ? Array.from(uniqueStageIds)[0] 
      : latestConv.custom_stage_id;

    // stage_assigned_at from the conversation that provided the resolved stage
    let resolvedStageAssignedAt: string | null = null;
    if (resolvedStageId) {
      const stageConv = sortedConvs.find(c => c.custom_stage_id === resolvedStageId) || latestConv;
      resolvedStageAssignedAt = stageConv.stage_assigned_at || null;
    }

    // Get received_account for latest conversation
    const receivedAccount = latestConv.received_on_account_id 
      ? accountMap.get(latestConv.received_on_account_id) || null
      : null;

    senderItems.push({
      sender_email: senderEmail,
      sender_name: latestConv.sender_name,
      channel: 'email' as const,
      last_message_at: latestConv.last_message_at,
      preview: latestConv.preview,
      subject: latestConv.subject,
      assigned_to: resolvedAssignedTo,
      custom_stage_id: resolvedStageId,
      stage_assigned_at: resolvedStageAssignedAt,
      conversation_count: convs.length,
      activity_count: activityCountMap.get(senderEmail) || 0,
      received_account: receivedAccount,
      workspace_id: latestConv.workspace_id,
      conversation_ids: convs.map(c => c.id),
    });
  }

  // Step 6: Sort by last_message_at DESC
  senderItems.sort((a, b) => {
    const timeA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const timeB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return timeB - timeA;
  });

  return senderItems;
}

/**
 * Update stage for all email conversations with a given sender_email
 * Phase-3: Bulk stage update for email senders
 */
export async function updateEmailSenderStage(
  senderEmail: string,
  stageId: string | null,
  userId: string,
  userRole: 'admin' | 'sdr' | null,
  workspaceId: string
): Promise<{ updated_count: number }> {
  // Normalize sender_email
  const normalizedEmail = senderEmail.toLowerCase().trim();
  if (!normalizedEmail) {
    throw new Error('Invalid sender_email');
  }

  // Step 1: Fetch conversation IDs matching criteria
  let query = supabaseAdmin
    .from('conversations')
    .select('id, custom_stage_id, workspace_id')
    .eq('conversation_type', 'email')
    .eq('workspace_id', workspaceId)
    .eq('sender_email', normalizedEmail);

  // SDR filtering: only assigned conversations
  if (userRole === 'sdr') {
    query = query.eq('assigned_to', userId);
  }

  const { data: conversations, error: fetchError } = await query;

  if (fetchError) {
    logger.error('[Update Email Sender Stage] Error fetching conversations:', fetchError);
    throw fetchError;
  }

  if (!conversations || conversations.length === 0) {
    return { updated_count: 0 };
  }

  const conversationIds = conversations.map(c => c.id);

  // Step 2: Update conversations in batch
  const now = new Date().toISOString();
  const { error: updateError } = await supabaseAdmin
    .from('conversations')
    .update({
      custom_stage_id: stageId,
      stage_assigned_at: now,
    })
    .in('id', conversationIds);

  if (updateError) {
    logger.error('[Update Email Sender Stage] Error updating conversations:', updateError);
    throw updateError;
  }

  // Step 3: Insert activity logs in batch
  const activities = conversations.map(conv => ({
    workspace_id: workspaceId,
    conversation_id: conv.id,
    actor_user_id: userId,
    activity_type: 'stage_changed',
    meta: {
      from_stage: conv.custom_stage_id,
      to_stage: stageId,
    },
    created_at: now,
  }));

  if (activities.length > 0) {
    const { error: activityError } = await supabaseAdmin
      .from('conversation_activities')
      .insert(activities);

    if (activityError) {
      logger.warn('[Update Email Sender Stage] Error inserting activities (non-fatal):', activityError);
      // Don't throw - activities are logged but not critical for operation
    }
  }

  return { updated_count: conversationIds.length };
}

/**
 * Assign SDR for all email conversations with a given sender_email
 * Phase-3: Bulk assignment for email senders
 */
export async function updateEmailSenderAssignment(
  senderEmail: string,
  assignedTo: string | null,
  userId: string,
  userRole: 'admin' | 'sdr' | null,
  workspaceId: string
): Promise<{ updated_count: number }> {
  // Normalize sender_email
  const normalizedEmail = senderEmail.toLowerCase().trim();
  if (!normalizedEmail) {
    throw new Error('Invalid sender_email');
  }

  // Step 1: Fetch conversation IDs matching criteria
  let query = supabaseAdmin
    .from('conversations')
    .select('id, assigned_to, workspace_id')
    .eq('conversation_type', 'email')
    .eq('workspace_id', workspaceId)
    .eq('sender_email', normalizedEmail);

  // SDR filtering: only assigned conversations
  if (userRole === 'sdr') {
    query = query.eq('assigned_to', userId);
  }

  const { data: conversations, error: fetchError } = await query;

  if (fetchError) {
    logger.error('[Update Email Sender Assignment] Error fetching conversations:', fetchError);
    throw fetchError;
  }

  if (!conversations || conversations.length === 0) {
    return { updated_count: 0 };
  }

  const conversationIds = conversations.map(c => c.id);

  // Step 2: Update conversations in batch
  const { error: updateError } = await supabaseAdmin
    .from('conversations')
    .update({
      assigned_to: assignedTo,
    })
    .in('id', conversationIds);

  if (updateError) {
    logger.error('[Update Email Sender Assignment] Error updating conversations:', updateError);
    throw updateError;
  }

  // Step 3: Insert activity logs in batch
  const now = new Date().toISOString();
  const activities = conversations.map(conv => ({
    workspace_id: workspaceId,
    conversation_id: conv.id,
    actor_user_id: userId,
    activity_type: 'assigned',
    meta: {
      from_assigned_to: conv.assigned_to,
      to_assigned_to: assignedTo,
    },
    created_at: now,
  }));

  if (activities.length > 0) {
    const { error: activityError } = await supabaseAdmin
      .from('conversation_activities')
      .insert(activities);

    if (activityError) {
      logger.warn('[Update Email Sender Assignment] Error inserting activities (non-fatal):', activityError);
      // Don't throw - activities are logged but not critical for operation
    }
  }

  return { updated_count: conversationIds.length };
}

/**
 * Get activities for all email conversations from a sender
 * Read-only endpoint for Sales Pipeline sender-grouped views
 */
export async function getEmailSenderActivities(
  workspaceId: string,
  senderEmail: string
): Promise<any[]> {
  // Normalize sender email
  const normalizedEmail = senderEmail.toLowerCase().trim();

  logger.info(`[Email Sender Activities] Fetching for sender: ${normalizedEmail}, workspace: ${workspaceId}`);

  // Step 1: Get all conversation IDs for this sender
  const { data: conversations, error: convError } = await supabaseAdmin
    .from('conversations')
    .select('id')
    .eq('conversation_type', 'email')
    .eq('workspace_id', workspaceId)
    .eq('sender_email', normalizedEmail);

  if (convError) {
    logger.error('[Email Sender Activities] Error fetching conversations:', convError);
    throw convError;
  }

  // If no conversations found, return empty array
  if (!conversations || conversations.length === 0) {
    logger.info('[Email Sender Activities] No conversations found for sender');
    return [];
  }

  const conversationIds = conversations.map(c => c.id);
  logger.info(`[Email Sender Activities] Found ${conversationIds.length} conversations for sender`);

  // Step 2: Fetch activities for all those conversations
  const { data: activities, error: actError } = await supabaseAdmin
    .from('conversation_activities')
    .select(`
      id,
      activity_type,
      meta,
      created_at,
      actor_user_id,
      profiles!conversation_activities_actor_user_id_fkey (
        full_name
      )
    `)
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: false });

  if (actError) {
    logger.error('[Email Sender Activities] Error fetching activities:', actError);
    throw actError;
  }

  // Transform to include actor_name at top level
  const transformedActivities = (activities || []).map((activity: any) => ({
    id: activity.id,
    activity_type: activity.activity_type,
    meta: activity.meta || {},
    created_at: activity.created_at,
    actor_user_id: activity.actor_user_id,
    actor_name: activity.profiles?.full_name || 'Unknown User'
  }));

  logger.info(`[Email Sender Activities] Returning ${transformedActivities.length} activities`);
  return transformedActivities;
}

/**
 * Get work queue with operational metrics
 * Derives last_inbound_at, last_outbound_at, pending_reply, idle_days, overdue
 * Phase 1.1: Backend-only, read-only endpoint
 * 
 * OPERATIONAL DEFINITIONS (STRICT):
 * - last_inbound_at: Most recent message FROM lead (is_from_lead = true)
 * - last_outbound_at: Most recent message FROM us (is_from_lead = false)
 * - pending_reply: TRUE if last_inbound_at exists AND (last_outbound_at is NULL OR last_inbound_at > last_outbound_at)
 * - last_activity_at: MAX(last_inbound_at, last_outbound_at)
 * - idle_days: Days since last_activity_at
 * - overdue: TRUE if pending_reply AND hours since last_inbound_at > SLA_HOURS
 */
export async function getWorkQueue(
  userId: string,
  userRole: 'admin' | 'sdr' | null,
  workspaceId: string
): Promise<any[]> {
  if (!workspaceId) {
    throw new Error('Workspace ID is required');
  }

  const SLA_HOURS = 24;
  const now = new Date();

  // Step 1: Get all conversations for this workspace with role filtering
  let conversationsQuery = supabaseAdmin
    .from('conversations')
    .select(`
      id,
      conversation_type,
      sender_name,
      sender_email,
      sender_linkedin_url,
      subject,
      preview,
      last_message_at,
      assigned_to,
      custom_stage_id,
      stage_assigned_at,
      workspace_id,
      created_at,
      chat_id
    `)
    .eq('workspace_id', workspaceId)
    .order('last_message_at', { ascending: false });

  // SDR filtering: only assigned conversations
  if (userRole === 'sdr') {
    conversationsQuery = conversationsQuery.eq('assigned_to', userId);
  }

  const { data: conversations, error: convError } = await conversationsQuery;

  if (convError) {
    logger.error('[Work Queue] Error fetching conversations:', convError);
    throw convError;
  }

  if (!conversations || conversations.length === 0) {
    return [];
  }

  // Step 2: Separate conversations by type for channel-specific message fetching
  const emailConversations = conversations.filter(c => c.conversation_type === 'email');
  const linkedinConversations = conversations.filter(c => c.conversation_type === 'linkedin');

  // Step 3: Fetch messages for all conversations
  // Note: Both email and LinkedIn use the same 'messages' table
  // The 'is_from_lead' field determines message direction for both channels
  const conversationIds = conversations.map(c => c.id);

  const { data: messages, error: msgError } = await supabaseAdmin
    .from('messages')
    .select('conversation_id, created_at, is_from_lead')
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: false });

  if (msgError) {
    logger.error('[Work Queue] Error fetching messages:', msgError);
    throw msgError;
  }

  // Step 4: Build message maps per conversation
  const messagesByConversation = new Map<string, any[]>();
  for (const msg of (messages || [])) {
    if (!messagesByConversation.has(msg.conversation_id)) {
      messagesByConversation.set(msg.conversation_id, []);
    }
    messagesByConversation.get(msg.conversation_id)!.push(msg);
  }

  // Step 5: Derive operational metrics for each conversation
  const workQueueItems = conversations.map((conv) => {
    const convMessages = messagesByConversation.get(conv.id) || [];

    // DERIVATION 1: last_inbound_at
    // Find most recent message FROM lead (is_from_lead = true)
    const lastInbound = convMessages.find(m => m.is_from_lead === true);
    const last_inbound_at = lastInbound?.created_at || null;

    // DERIVATION 2: last_outbound_at
    // Find most recent message FROM us (is_from_lead = false)
    const lastOutbound = convMessages.find(m => m.is_from_lead === false);
    const last_outbound_at = lastOutbound?.created_at || null;

    // DERIVATION 3: pending_reply (TIMESTAMP-BASED ONLY)
    // TRUE if:
    // - last_inbound_at exists
    // - AND (last_outbound_at is NULL OR last_inbound_at > last_outbound_at)
    let pending_reply = false;
    if (last_inbound_at) {
      if (!last_outbound_at) {
        // Lead sent message, we never replied
        pending_reply = true;
      } else {
        // Compare timestamps: if inbound is more recent, we owe a reply
        const inboundTime = new Date(last_inbound_at).getTime();
        const outboundTime = new Date(last_outbound_at).getTime();
        pending_reply = inboundTime > outboundTime;
      }
    }

    // DERIVATION 4: last_activity_at
    // MAX(last_inbound_at, last_outbound_at)
    let last_activity_at: string | null = null;
    if (last_inbound_at && last_outbound_at) {
      const inboundTime = new Date(last_inbound_at).getTime();
      const outboundTime = new Date(last_outbound_at).getTime();
      last_activity_at = inboundTime > outboundTime ? last_inbound_at : last_outbound_at;
    } else if (last_inbound_at) {
      last_activity_at = last_inbound_at;
    } else if (last_outbound_at) {
      last_activity_at = last_outbound_at;
    }

    // DERIVATION 5: idle_days
    // Days since last_activity_at (any direction)
    let idle_days = 0;
    if (last_activity_at) {
      const lastActivityDate = new Date(last_activity_at);
      const diffMs = now.getTime() - lastActivityDate.getTime();
      idle_days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }

    // DERIVATION 6: overdue
    // TRUE if pending_reply AND hours since last_inbound_at > SLA_HOURS
    let overdue = false;
    if (pending_reply && last_inbound_at) {
      const inboundDate = new Date(last_inbound_at);
      const hoursSinceInbound = (now.getTime() - inboundDate.getTime()) / (1000 * 60 * 60);
      overdue = hoursSinceInbound > SLA_HOURS;
    }

    return {
      conversation_id: conv.id,
      conversation_type: conv.conversation_type,
      channel: conv.conversation_type, // 'email' or 'linkedin'
      sender_name: conv.sender_name,
      sender_email: conv.sender_email || null,
      sender_linkedin_url: conv.sender_linkedin_url || null,
      subject: conv.subject || null,
      preview: conv.preview || null,
      last_message_at: conv.last_message_at,
      assigned_to: conv.assigned_to || null,
      custom_stage_id: conv.custom_stage_id || null,
      stage_assigned_at: conv.stage_assigned_at || null,
      workspace_id: conv.workspace_id,
      created_at: conv.created_at,
      // Operational metrics (derived from messages table)
      last_inbound_at,
      last_outbound_at,
      pending_reply,
      idle_days,
      overdue,
    };
  });

  logger.info(`[Work Queue] Returning ${workQueueItems.length} items`);
  return workQueueItems;
}

/**
 * Get work queue from SQL view
 * Sprint 5.1: Read from conversation_work_queue view
 * 
 * @param userId - Current user ID
 * @param userRole - User role (admin or sdr)
 * @param workspaceId - Workspace ID (mandatory)
 * @param filter - Filter type: 'all' | 'pending' | 'overdue' | 'idle'
 * @returns Array of work queue items from view
 */
export async function getWorkQueueFromView(
  userId: string,
  userRole: 'admin' | 'sdr' | null,
  workspaceId: string,
  filter: 'all' | 'pending' | 'overdue' | 'idle' = 'all'
): Promise<any[]> {
  if (!workspaceId) {
    throw new Error('Workspace ID is required');
  }

  // Enforce explicit role handling
  if (userRole !== 'admin' && userRole !== 'sdr') {
    throw new Error('Invalid or missing user role');
  }

  logger.info(`[Work Queue View] Fetching for user=${userId}, role=${userRole}, workspace=${workspaceId}, filter=${filter}`);

  // Step 1: Build base query from conversation_work_queue view
  let query = supabaseAdmin
    .from('conversation_work_queue')
    .select('*');

  // Step 2: Filter by workspace_id (MANDATORY)
  query = query.eq('workspace_id', workspaceId);

  // Step 3: Role-based filtering (EXPLICIT)
  if (userRole === 'sdr') {
    // SDR: Only show conversations assigned to this SDR
    query = query.eq('assigned_sdr_id', userId);
    logger.info(`[Work Queue View] Applying SDR filter: assigned_sdr_id = ${userId}`);
  } else if (userRole === 'admin') {
    // Admin: No additional filtering (sees all conversations in workspace)
    logger.info('[Work Queue View] Admin access: no additional filtering');
  }

  // Step 4: Apply filter parameter
  switch (filter) {
    case 'pending':
      // Show only conversations where we owe a reply
      query = query.eq('pending_reply', true);
      logger.info('[Work Queue View] Filter: pending_reply = true');
      break;

    case 'overdue':
      // Show only conversations that are overdue (pending + >24 hours)
      query = query.eq('overdue', true);
      logger.info('[Work Queue View] Filter: overdue = true');
      break;

    case 'idle':
      // Show only conversations with some idle time (idle_days > 0)
      query = query.gt('idle_days', 0);
      logger.info('[Work Queue View] Filter: idle_days > 0');
      break;

    case 'all':
    default:
      // No additional filter - show all conversations in workspace
      logger.info('[Work Queue View] Filter: all (no additional filter)');
      break;
  }

  // Step 5: Apply default sorting
  // Sort by overdue DESC (overdue items first), then by last_inbound_at ASC (oldest first)
  query = query
    .order('overdue', { ascending: false })
    .order('last_inbound_at', { ascending: true });

  // Step 6: Execute query
  const { data, error } = await query;

  if (error) {
    logger.error('[Work Queue View] Error fetching from view:', error);
    throw error;
  }

  logger.info(`[Work Queue View] Returning ${data?.length || 0} items`);
  return data || [];
}
