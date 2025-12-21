-- Migration: Add email action status tracking
-- Date: 2024-12-16
-- Purpose: Track if an email has been replied to or forwarded (for UI icons)

-- Add email_action_status to conversations table (EMAIL ONLY)
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS email_action_status TEXT DEFAULT NULL;

-- Add comment to clarify usage
COMMENT ON COLUMN public.conversations.email_action_status IS 
  'Tracks email actions for UI icons. Values: replied, replied_all, forwarded. NULL for untouched emails. ONLY used for conversation_type = email. LinkedIn messages do NOT use this field.';

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_conversations_email_action 
ON public.conversations(email_action_status) 
WHERE conversation_type = 'email' AND email_action_status IS NOT NULL;

-- ✅ LinkedIn Safety: This field is only for emails
-- LinkedIn conversations will always have email_action_status = NULL
-- The field is never set for conversation_type = 'linkedin'




