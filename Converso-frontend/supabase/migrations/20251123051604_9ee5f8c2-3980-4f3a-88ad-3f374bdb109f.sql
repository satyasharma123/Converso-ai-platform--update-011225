-- Add column to track which connected account received the conversation
ALTER TABLE public.conversations 
ADD COLUMN received_on_account_id uuid REFERENCES public.connected_accounts(id);

-- Add index for better query performance
CREATE INDEX idx_conversations_received_account ON public.conversations(received_on_account_id);

-- Add comment to explain the column
COMMENT ON COLUMN public.conversations.received_on_account_id IS 'References the connected account that received this conversation';