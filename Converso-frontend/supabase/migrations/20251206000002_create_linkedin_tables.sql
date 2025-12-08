-- Create separate tables for LinkedIn data
-- This separates LinkedIn conversations from email conversations

-- Table: linkedin_conversations
CREATE TABLE IF NOT EXISTS public.linkedin_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unipile_chat_id TEXT UNIQUE NOT NULL,
  title TEXT,
  participant_ids JSONB,
  latest_message_at TIMESTAMPTZ,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES public.connected_accounts(id) ON DELETE CASCADE NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: linkedin_messages
CREATE TABLE IF NOT EXISTS public.linkedin_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unipile_message_id TEXT UNIQUE NOT NULL,
  conversation_id UUID REFERENCES public.linkedin_conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id TEXT,
  sender_name TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  direction TEXT CHECK (direction IN ('in', 'out')),
  attachments JSONB,
  raw_json JSONB,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES public.connected_accounts(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_linkedin_conversations_workspace ON public.linkedin_conversations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_conversations_account ON public.linkedin_conversations(account_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_conversations_unipile_chat ON public.linkedin_conversations(unipile_chat_id);

CREATE INDEX IF NOT EXISTS idx_linkedin_messages_conversation ON public.linkedin_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_messages_workspace ON public.linkedin_messages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_messages_account ON public.linkedin_messages(account_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_messages_unipile_message ON public.linkedin_messages(unipile_message_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_messages_timestamp ON public.linkedin_messages(timestamp);

-- Enable RLS
ALTER TABLE public.linkedin_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linkedin_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for linkedin_conversations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'linkedin_conversations'
      AND policyname = 'Users can view linkedin conversations in their workspace'
  ) THEN
    CREATE POLICY "Users can view linkedin conversations in their workspace"
      ON public.linkedin_conversations FOR SELECT
      TO authenticated
      USING (
        workspace_id IN (
          SELECT workspace_id FROM public.profiles WHERE id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'linkedin_conversations'
      AND policyname = 'Service role can manage all linkedin conversations'
  ) THEN
    CREATE POLICY "Service role can manage all linkedin conversations"
      ON public.linkedin_conversations FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- RLS Policies for linkedin_messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'linkedin_messages'
      AND policyname = 'Users can view linkedin messages in their workspace'
  ) THEN
    CREATE POLICY "Users can view linkedin messages in their workspace"
      ON public.linkedin_messages FOR SELECT
      TO authenticated
      USING (
        workspace_id IN (
          SELECT workspace_id FROM public.profiles WHERE id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'linkedin_messages'
      AND policyname = 'Service role can manage all linkedin messages'
  ) THEN
    CREATE POLICY "Service role can manage all linkedin messages"
      ON public.linkedin_messages FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_linkedin_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_linkedin_conversations_updated_at ON public.linkedin_conversations;
CREATE TRIGGER trigger_update_linkedin_conversations_updated_at
  BEFORE UPDATE ON public.linkedin_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_linkedin_conversations_updated_at();




