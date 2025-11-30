import { supabaseAdmin } from '../lib/supabase';
import type { Message } from '../types';

/**
 * API module for message-related database queries
 */

export async function getMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabaseAdmin
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data as Message[];
}

export async function sendMessage(
  conversationId: string,
  userId: string,
  content: string
): Promise<void> {
  // Get user profile for sender name
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .single();

  const { error } = await supabaseAdmin
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: userId,
      sender_name: profile?.full_name || 'Unknown',
      content,
      is_from_lead: false,
    });

  if (error) throw error;

  // Update conversation's last_message_at
  await supabaseAdmin
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId);
}

export async function getMessageById(messageId: string): Promise<Message | null> {
  const { data, error } = await supabaseAdmin
    .from('messages')
    .select('*')
    .eq('id', messageId)
    .single();

  if (error) throw error;
  return data as Message | null;
}

