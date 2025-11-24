import { supabase } from '../lib/supabase';
import type { Conversation } from '../types';

/**
 * API module for conversation-related database queries
 */

export async function getConversations(
  userId: string,
  userRole: 'admin' | 'sdr' | null,
  type?: 'email' | 'linkedin'
): Promise<Conversation[]> {
  let query = supabase
    .from('conversations')
    .select(`
      *,
      received_account:connected_accounts(
        account_name,
        account_email,
        account_type
      )
    `)
    .order('last_message_at', { ascending: false });

  // Filter by type if specified
  if (type) {
    query = query.eq('conversation_type', type);
  }

  // SDRs only see their assigned conversations
  if (userRole === 'sdr') {
    query = query.eq('assigned_to', userId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as Conversation[];
}

export async function assignConversation(
  conversationId: string,
  sdrId: string | null
): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ assigned_to: sdrId })
    .eq('id', conversationId);

  if (error) throw error;
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
  const { error } = await supabase
    .from('conversations')
    .update({ is_read: !isRead })
    .eq('id', conversationId);

  if (error) throw error;
}

export async function updateConversationStage(
  conversationId: string,
  stageId: string | null
): Promise<void> {
  const { error } = await supabase
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

