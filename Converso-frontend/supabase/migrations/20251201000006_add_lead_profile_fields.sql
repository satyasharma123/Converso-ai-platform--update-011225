-- Add company_name and location columns to conversations table for lead profile
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_conversations_company_name 
  ON public.conversations(company_name)
  WHERE conversation_type IN ('email', 'linkedin');

CREATE INDEX IF NOT EXISTS idx_conversations_location 
  ON public.conversations(location)
  WHERE conversation_type IN ('email', 'linkedin');

-- Notify PostgREST to reload schema
SELECT pg_notify('pgrst', 'reload schema');




