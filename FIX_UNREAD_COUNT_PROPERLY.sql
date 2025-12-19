-- ============================================================================
-- FIX UNREAD COUNT TO TRACK ONLY NEW MESSAGES
-- ============================================================================
-- Problem: Currently counting ALL messages from leads, not just unread ones
-- Solution: Add last_read_at timestamp and count only messages after that time
-- ============================================================================

-- Step 1: Add last_read_at column to conversations table
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ;

-- Step 2: Initialize last_read_at for conversations marked as read
-- Set it to the timestamp of the last message for read conversations
UPDATE public.conversations c
SET last_read_at = (
  SELECT MAX(m.created_at)
  FROM messages m
  WHERE m.conversation_id = c.id
)
WHERE c.is_read = true AND c.last_read_at IS NULL;

-- Step 3: Fix the calculate_unread_count function
-- Only count messages that arrived AFTER last_read_at
CREATE OR REPLACE FUNCTION calculate_unread_count(conversation_id_param UUID)
RETURNS INTEGER AS $$
DECLARE
  unread_count INTEGER;
  last_read_timestamp TIMESTAMPTZ;
BEGIN
  -- Get conversation's last_read_at timestamp
  SELECT last_read_at INTO last_read_timestamp
  FROM conversations
  WHERE id = conversation_id_param;
  
  -- If last_read_at is NULL, count all messages from leads
  -- Otherwise, only count messages that arrived after last_read_at
  IF last_read_timestamp IS NULL THEN
    SELECT COUNT(*)::INTEGER INTO unread_count
    FROM messages
    WHERE conversation_id = conversation_id_param
      AND is_from_lead = true;
  ELSE
    SELECT COUNT(*)::INTEGER INTO unread_count
    FROM messages
    WHERE conversation_id = conversation_id_param
      AND is_from_lead = true
      AND created_at > last_read_timestamp;
  END IF;
  
  RETURN COALESCE(unread_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Step 4: Update the trigger to set last_read_at when conversation is marked as read
CREATE OR REPLACE FUNCTION trigger_reset_unread_count()
RETURNS TRIGGER AS $$
BEGIN
  -- If conversation is being marked as read, set last_read_at and reset count
  IF NEW.is_read = true AND (OLD.is_read = false OR OLD.is_read IS NULL) THEN
    -- Set last_read_at to NOW (time when user marked it as read)
    NEW.last_read_at := NOW();
    NEW.unread_count := 0;
  END IF;
  
  -- If conversation is being marked as unread, clear last_read_at and recalculate count
  IF NEW.is_read = false AND OLD.is_read = true THEN
    NEW.last_read_at := NULL;
    NEW.unread_count := calculate_unread_count(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS reset_unread_count_on_read ON conversations;
CREATE TRIGGER reset_unread_count_on_read
BEFORE UPDATE OF is_read ON conversations
FOR EACH ROW
EXECUTE FUNCTION trigger_reset_unread_count();

-- Step 5: Recalculate unread_count for all conversations
-- This will properly count only messages after last_read_at
UPDATE conversations
SET unread_count = calculate_unread_count(id);

-- Step 6: Create index for better performance
CREATE INDEX IF NOT EXISTS idx_conversations_last_read_at 
ON public.conversations(last_read_at) 
WHERE last_read_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
ON public.messages(conversation_id, created_at, is_from_lead);

-- Add comment for documentation
COMMENT ON COLUMN conversations.last_read_at IS 'Timestamp when the conversation was last marked as read. Used to calculate unread count.';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify the fix:

-- 1. Check unread counts for all conversations
SELECT 
  id,
  sender_name,
  is_read,
  last_read_at,
  unread_count,
  calculate_unread_count(id) as calculated_count
FROM conversations
ORDER BY last_message_at DESC
LIMIT 20;

-- 2. Check messages for a specific conversation (replace with actual ID)
-- SELECT 
--   conversation_id,
--   sender_name,
--   created_at,
--   is_from_lead,
--   created_at > (SELECT last_read_at FROM conversations WHERE id = 'CONVERSATION_ID_HERE') as is_unread
-- FROM messages
-- WHERE conversation_id = 'CONVERSATION_ID_HERE'
-- ORDER BY created_at DESC;



