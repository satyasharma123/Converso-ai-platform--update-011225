-- ============================================
-- ADD MISSING COLUMNS TO CONVERSATIONS TABLE
-- Run this FIRST before cleanup script
-- ============================================

-- Add email_body column to store full email content
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS email_body TEXT NULL;

-- Add has_full_body flag to track if body was fetched
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS has_full_body BOOLEAN DEFAULT FALSE;

-- Add Gmail-specific fields
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS gmail_message_id TEXT NULL;

ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS gmail_thread_id TEXT NULL;

-- Add Outlook-specific fields
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS outlook_message_id TEXT NULL;

ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS outlook_conversation_id TEXT NULL;

-- Add email timestamp field
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS email_timestamp TIMESTAMPTZ NULL;

-- Verify columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'conversations'
  AND column_name IN ('email_body', 'has_full_body', 'gmail_message_id', 'gmail_thread_id', 
                       'outlook_message_id', 'outlook_conversation_id', 'email_timestamp')
ORDER BY column_name;

-- Result should show all 7 columns
