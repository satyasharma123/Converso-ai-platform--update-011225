-- Add column to track who sent the last message
-- This helps display "You: " or "{FirstName}: " prefix in message previews

ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS last_message_from_lead BOOLEAN DEFAULT NULL;

-- Add comment to explain the column
COMMENT ON COLUMN conversations.last_message_from_lead IS 
  'TRUE if the last message was from the lead, FALSE if from you, NULL if unknown';

-- Update existing conversations based on their latest message
-- This will set the correct value for all existing conversations
UPDATE conversations c
SET last_message_from_lead = (
  SELECT m.is_from_lead
  FROM messages m
  WHERE m.conversation_id = c.id
  ORDER BY m.created_at DESC
  LIMIT 1
)
WHERE c.conversation_type = 'linkedin';
