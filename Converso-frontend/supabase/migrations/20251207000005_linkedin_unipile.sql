-- LinkedIn Unipile integration schema updates

-- Conversations table additions
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS sender_attendee_id TEXT,
  ADD COLUMN IF NOT EXISTS sender_profile_picture_url TEXT,
  ADD COLUMN IF NOT EXISTS sender_linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS chat_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_member_urn TEXT;

-- Messages table additions
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS linkedin_message_id TEXT,
  ADD COLUMN IF NOT EXISTS sender_attendee_id TEXT,
  ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS message_type TEXT;

-- Unique index for linkedin_message_id to enable upsert
CREATE UNIQUE INDEX IF NOT EXISTS uniq_messages_linkedin_message_id
  ON public.messages(linkedin_message_id)
  WHERE linkedin_message_id IS NOT NULL;

-- Cleanup old LinkedIn data before new sync
DELETE FROM public.messages WHERE message_type = 'linkedin';
DELETE FROM public.conversations WHERE conversation_type = 'linkedin';



