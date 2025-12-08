-- Ensure sender_linkedin_url column exists
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS sender_linkedin_url TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS sender_linkedin_url TEXT;
