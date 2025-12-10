-- Add lead profile fields to conversations table
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS mobile TEXT,
  ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 50 CHECK (score >= 0 AND score <= 100),
  ADD COLUMN IF NOT EXISTS sender_profile_picture_url TEXT;

-- Create lead_notes table for storing notes
CREATE TABLE IF NOT EXISTS public.lead_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_name TEXT NOT NULL,
  note_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_lead_notes_conversation_id 
  ON public.lead_notes(conversation_id);

CREATE INDEX IF NOT EXISTS idx_lead_notes_user_id 
  ON public.lead_notes(user_id);

CREATE INDEX IF NOT EXISTS idx_lead_notes_created_at 
  ON public.lead_notes(created_at DESC);

-- Enable RLS for lead_notes
ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;

-- RLS policies for lead_notes
-- Users can view notes for conversations they have access to
CREATE POLICY "Users can view notes from their conversations"
  ON public.lead_notes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = lead_notes.conversation_id
        AND (
          public.has_role(auth.uid(), 'admin')
          OR conversations.assigned_to = auth.uid()
        )
    )
  );

-- Users can insert notes to their conversations
CREATE POLICY "Users can insert notes to their conversations"
  ON public.lead_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = conversation_id
        AND (
          public.has_role(auth.uid(), 'admin')
          OR conversations.assigned_to = auth.uid()
        )
    )
  );

-- Users can update their own notes
CREATE POLICY "Users can update their own notes"
  ON public.lead_notes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own notes
CREATE POLICY "Users can delete their own notes"
  ON public.lead_notes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create trigger for lead_notes updated_at
CREATE TRIGGER update_lead_notes_updated_at
  BEFORE UPDATE ON public.lead_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Notify PostgREST to reload schema
SELECT pg_notify('pgrst', 'reload schema');
