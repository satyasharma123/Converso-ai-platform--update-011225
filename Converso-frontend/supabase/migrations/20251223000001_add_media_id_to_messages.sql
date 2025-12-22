-- Migration: Add media_id column to messages table
-- Date: 2024-12-23
-- Purpose: Store Unipile media IDs for LinkedIn attachments

-- Add media_id column to messages table
ALTER TABLE messages
ADD COLUMN media_id TEXT NULL;

-- Add comment to document the column
COMMENT ON COLUMN messages.media_id IS 'Unipile media ID for LinkedIn attachments';
