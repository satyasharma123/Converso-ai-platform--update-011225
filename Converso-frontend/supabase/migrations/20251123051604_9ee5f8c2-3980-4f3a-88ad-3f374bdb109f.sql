-- Add column to track which connected account received the conversation
DO $$
BEGIN
  -- Try to add the column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'conversations' 
    AND column_name = 'received_on_account_id'
  ) THEN
    ALTER TABLE public.conversations 
    ADD COLUMN received_on_account_id uuid REFERENCES public.connected_accounts(id);
  END IF;
END $$;

-- Add index for better query performance (will skip if already exists)
CREATE INDEX IF NOT EXISTS idx_conversations_received_account ON public.conversations(received_on_account_id);

-- Add comment to explain the column
COMMENT ON COLUMN public.conversations.received_on_account_id IS 'References the connected account that received this conversation';