-- ================================================
-- ADD is_sent COLUMN TO MESSAGES TABLE
-- Following LinkedIn architecture: all sent emails stored in messages
-- ================================================

-- Add email fields to messages table FIRST (before using them in index)
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS conversation_type TEXT;

ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS is_sent BOOLEAN DEFAULT FALSE;

ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS sender_email TEXT;

ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS subject TEXT;

ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS text_body TEXT;

ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS html_body TEXT;

ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS gmail_message_id TEXT;

ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS outlook_message_id TEXT;

-- Add index for sent message queries AFTER columns exist
CREATE INDEX IF NOT EXISTS idx_messages_sent_email 
ON messages(conversation_id, is_sent, created_at DESC) 
WHERE conversation_type = 'email' AND is_sent = TRUE;

-- Add comments
COMMENT ON COLUMN messages.is_sent IS 'TRUE if user sent this message (for email Sent folder queries)';
COMMENT ON COLUMN messages.conversation_type IS 'email or linkedin - follows conversation pattern';
COMMENT ON COLUMN messages.sender_email IS 'Sender email address';
COMMENT ON COLUMN messages.subject IS 'Email subject (for sent emails)';
COMMENT ON COLUMN messages.text_body IS 'Plain text version of email body';
COMMENT ON COLUMN messages.html_body IS 'HTML version of email body';
COMMENT ON COLUMN messages.gmail_message_id IS 'Gmail message ID for sent emails';
COMMENT ON COLUMN messages.outlook_message_id IS 'Outlook message ID for sent emails';

-- ✅ SAFETY: Only affects messages table, LinkedIn data completely safe



