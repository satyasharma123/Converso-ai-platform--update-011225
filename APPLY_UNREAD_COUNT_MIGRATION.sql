-- Apply unread_count migration
-- Run this in your Supabase SQL Editor or via psql

-- Add unread_count column to conversations table
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0;

-- Create an index for better performance when querying unread conversations
CREATE INDEX IF NOT EXISTS idx_conversations_unread_count 
ON public.conversations(unread_count) 
WHERE unread_count > 0;

-- Function to calculate unread count for a conversation
CREATE OR REPLACE FUNCTION calculate_unread_count(conversation_id_param UUID)
RETURNS INTEGER AS $$
DECLARE
  unread_count INTEGER;
  last_read_at TIMESTAMP WITH TIME ZONE;
  is_read_flag BOOLEAN;
BEGIN
  -- Get conversation's is_read status
  SELECT is_read INTO is_read_flag
  FROM conversations
  WHERE id = conversation_id_param;
  
  -- If conversation is marked as read, return 0
  IF is_read_flag = true THEN
    RETURN 0;
  END IF;
  
  -- Count unread messages from leads
  SELECT COUNT(*)::INTEGER INTO unread_count
  FROM messages
  WHERE conversation_id = conversation_id_param
    AND is_from_lead = true;
  
  RETURN COALESCE(unread_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to update unread count for a conversation
CREATE OR REPLACE FUNCTION update_unread_count(conversation_id_param UUID)
RETURNS VOID AS $$
DECLARE
  new_count INTEGER;
BEGIN
  new_count := calculate_unread_count(conversation_id_param);
  
  UPDATE conversations
  SET unread_count = new_count
  WHERE id = conversation_id_param;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to update unread count when messages are inserted
CREATE OR REPLACE FUNCTION trigger_update_unread_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if the message is from a lead
  IF NEW.is_from_lead = true THEN
    PERFORM update_unread_count(NEW.conversation_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for message inserts
DROP TRIGGER IF EXISTS update_unread_count_on_message_insert ON messages;
CREATE TRIGGER update_unread_count_on_message_insert
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION trigger_update_unread_count();

-- Trigger function to reset unread count when conversation is marked as read
CREATE OR REPLACE FUNCTION trigger_reset_unread_count()
RETURNS TRIGGER AS $$
BEGIN
  -- If conversation is being marked as read, reset unread count
  IF NEW.is_read = true AND OLD.is_read = false THEN
    NEW.unread_count := 0;
  END IF;
  
  -- If conversation is being marked as unread, recalculate count
  IF NEW.is_read = false AND OLD.is_read = true THEN
    NEW.unread_count := calculate_unread_count(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for conversation updates
DROP TRIGGER IF EXISTS reset_unread_count_on_read ON conversations;
CREATE TRIGGER reset_unread_count_on_read
BEFORE UPDATE OF is_read ON conversations
FOR EACH ROW
EXECUTE FUNCTION trigger_reset_unread_count();

-- Initialize unread_count for existing conversations
-- This will calculate the correct count based on existing messages
UPDATE conversations
SET unread_count = calculate_unread_count(id)
WHERE is_read = false;

-- Set unread_count to 0 for conversations marked as read
UPDATE conversations
SET unread_count = 0
WHERE is_read = true;

-- Add comment for documentation
COMMENT ON COLUMN conversations.unread_count IS 'Number of unread messages from leads in this conversation. Automatically updated by triggers.';

-- Verify the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'conversations' 
AND column_name = 'unread_count';




