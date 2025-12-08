-- Add workspace_id to conversations and messages tables
-- Create sync_status table for tracking email sync progress

-- Add workspace_id to conversations table
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Add workspace_id to messages table
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Add email metadata fields to conversations for lazy loading
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS gmail_message_id TEXT,
ADD COLUMN IF NOT EXISTS gmail_thread_id TEXT,
ADD COLUMN IF NOT EXISTS email_timestamp TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS has_full_body BOOLEAN DEFAULT false;

-- Add full body field to messages for storing email body when fetched
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS email_body TEXT,
ADD COLUMN IF NOT EXISTS gmail_message_id TEXT;

-- Create sync_status table
CREATE TABLE IF NOT EXISTS public.sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  inbox_id UUID REFERENCES public.connected_accounts(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'error')),
  last_synced_at TIMESTAMP WITH TIME ZONE,
  sync_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, inbox_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_sync_status_workspace_inbox ON public.sync_status(workspace_id, inbox_id);
CREATE INDEX IF NOT EXISTS idx_conversations_workspace ON public.conversations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_messages_workspace ON public.messages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_conversations_email_timestamp ON public.conversations(email_timestamp);
CREATE INDEX IF NOT EXISTS idx_conversations_gmail_message_id ON public.conversations(gmail_message_id);

-- Enable RLS on sync_status
ALTER TABLE public.sync_status ENABLE ROW LEVEL SECURITY;

-- RLS policies for sync_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'sync_status' 
    AND policyname = 'Users can view sync status for their workspace'
  ) THEN
    CREATE POLICY "Users can view sync status for their workspace"
      ON public.sync_status FOR SELECT
      TO authenticated
      USING (true); -- Admins can view all, will filter by workspace in queries
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'sync_status' 
    AND policyname = 'Admins can manage sync status'
  ) THEN
    CREATE POLICY "Admins can manage sync status"
      ON public.sync_status FOR ALL
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

