-- Add Outlook-specific fields to conversations and messages tables
-- Required for Outlook email integration

-- Add Outlook message fields to conversations table
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS outlook_message_id TEXT,
ADD COLUMN IF NOT EXISTS outlook_conversation_id TEXT;

-- Add Outlook message fields to messages table  
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS outlook_message_id TEXT;

-- Create indexes for faster Outlook message queries
CREATE INDEX IF NOT EXISTS idx_conversations_outlook_message_id ON public.conversations(outlook_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_outlook_message_id ON public.messages(outlook_message_id);
