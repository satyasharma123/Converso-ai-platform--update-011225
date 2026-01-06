import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../utils/logger';
import { resolveActiveWorkspace } from '../utils/resolveWorkspace';

export interface ConversationTag {
  id: string;
  workspace_id: string;
  conversation_id: string;
  channel: 'email' | 'linkedin' | 'whatsapp' | 'instagram';
  tag: 'meeting_requested' | 'info_requested' | 'lead' | null;
  source: 'ai' | 'manual';
  confidence: number | null;
  evidence_text: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Get tag for a conversation
 */
export async function getConversationTag(
  conversationId: string,
  userId: string,
  userRole: 'admin' | 'sdr' | null
): Promise<ConversationTag | null> {
  // Step 1: Verify user can access this conversation
  const { data: conversation, error: convError } = await supabaseAdmin
    .from('conversations')
    .select('id, workspace_id, assigned_to')
    .eq('id', conversationId)
    .single();

  if (convError || !conversation) {
    throw new Error('Conversation not found');
  }

  // Step 2: Check permissions
  // Admin can access any conversation in their workspace
  // SDR can only access assigned conversations
  if (userRole === 'sdr') {
    if (conversation.assigned_to !== userId) {
      throw new Error('Access denied: SDR can only tag assigned conversations');
    }
  }

  // Step 3: Get workspace ID
  const { workspaceId } = await resolveActiveWorkspace({ userId });
  if (conversation.workspace_id !== workspaceId) {
    throw new Error('Conversation not in user workspace');
  }

  // Step 4: Fetch tag
  const { data: tag, error: tagError } = await supabaseAdmin
    .from('conversation_tags')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('conversation_id', conversationId)
    .maybeSingle();

  if (tagError) {
    logger.error('[Get Conversation Tag] Error:', tagError);
    throw tagError;
  }

  return tag;
}

/**
 * Create or update tag for a conversation (manual only)
 */
export async function setConversationTag(
  conversationId: string,
  userId: string,
  userRole: 'admin' | 'sdr' | null,
  tag: 'meeting_requested' | 'info_requested' | 'lead' | null,
  channel: 'email' | 'linkedin' | 'whatsapp' | 'instagram'
): Promise<ConversationTag | null> {
  // Step 1: Verify user can access this conversation
  const { data: conversation, error: convError } = await supabaseAdmin
    .from('conversations')
    .select('id, workspace_id, assigned_to, conversation_type')
    .eq('id', conversationId)
    .single();

  if (convError || !conversation) {
    throw new Error('Conversation not found');
  }

  // Step 2: Check permissions
  if (userRole === 'sdr') {
    if (conversation.assigned_to !== userId) {
      throw new Error('Access denied: SDR can only tag assigned conversations');
    }
  }

  // Step 3: Get workspace ID
  const { workspaceId } = await resolveActiveWorkspace({ userId });
  if (conversation.workspace_id !== workspaceId) {
    throw new Error('Conversation not in user workspace');
  }

  // Step 4: Determine channel from conversation type if not provided
  const finalChannel = channel || (conversation.conversation_type === 'email' ? 'email' : 'linkedin');

  // Step 5: If tag is null, delete the row
  if (tag === null) {
    const { data: existingTag } = await supabaseAdmin
      .from('conversation_tags')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('conversation_id', conversationId)
      .maybeSingle();

    if (existingTag) {
      const { error: deleteError } = await supabaseAdmin
        .from('conversation_tags')
        .delete()
        .eq('id', existingTag.id);

      if (deleteError) {
        logger.error('[Set Conversation Tag] Delete error:', deleteError);
        throw deleteError;
      }

      logger.info(`[Set Conversation Tag] Tag cleared (row deleted) for conversation ${conversationId}`);
      // Return null to indicate tag was deleted
      return null;
    } else {
      // No tag exists, nothing to delete
      logger.info(`[Set Conversation Tag] No tag to clear for conversation ${conversationId}`);
      return null;
    }
  }

  // Step 6: Upsert tag (manual source)
  const tagData: Partial<ConversationTag> = {
    workspace_id: workspaceId,
    conversation_id: conversationId,
    channel: finalChannel,
    tag: tag,
    source: 'manual',
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };

  const { data: existingTag } = await supabaseAdmin
    .from('conversation_tags')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('conversation_id', conversationId)
    .maybeSingle();

  let result;
  if (existingTag) {
    // Update existing tag
    const { data, error } = await supabaseAdmin
      .from('conversation_tags')
      .update(tagData)
      .eq('id', existingTag.id)
      .select()
      .single();

    if (error) {
      logger.error('[Set Conversation Tag] Update error:', error);
      throw error;
    }
    result = data;
  } else {
    // Insert new tag
    const { data, error } = await supabaseAdmin
      .from('conversation_tags')
      .insert({
        ...tagData,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      logger.error('[Set Conversation Tag] Insert error:', error);
      throw error;
    }
    result = data;
  }

  logger.info(`[Set Conversation Tag] Tag ${tag} set for conversation ${conversationId}`);
  return result;
}

/**
 * Delete tag for a conversation
 */
export async function deleteConversationTag(
  conversationId: string,
  userId: string,
  userRole: 'admin' | 'sdr' | null
): Promise<void> {
  // Step 1: Verify user can access this conversation
  const { data: conversation, error: convError } = await supabaseAdmin
    .from('conversations')
    .select('id, workspace_id, assigned_to')
    .eq('id', conversationId)
    .single();

  if (convError || !conversation) {
    throw new Error('Conversation not found');
  }

  // Step 2: Check permissions
  if (userRole === 'sdr') {
    if (conversation.assigned_to !== userId) {
      throw new Error('Access denied: SDR can only delete tags from assigned conversations');
    }
  }

  // Step 3: Get workspace ID
  const { workspaceId } = await resolveActiveWorkspace({ userId });
  if (conversation.workspace_id !== workspaceId) {
    throw new Error('Conversation not in user workspace');
  }

  // Step 4: Delete tag
  const { error: deleteError } = await supabaseAdmin
    .from('conversation_tags')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('conversation_id', conversationId);

  if (deleteError) {
    logger.error('[Delete Conversation Tag] Error:', deleteError);
    throw deleteError;
  }

  logger.info(`[Delete Conversation Tag] Tag deleted for conversation ${conversationId}`);
}

