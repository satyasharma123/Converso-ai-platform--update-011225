# Apply Outlook Migration

## Quick Fix: Add Outlook Fields to Database

The email sync needs Outlook-specific fields in the database. Run this SQL in your Supabase SQL Editor:

```sql
-- Add Outlook-specific fields to conversations and messages tables
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS outlook_message_id TEXT,
ADD COLUMN IF NOT EXISTS outlook_conversation_id TEXT;

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS outlook_message_id TEXT;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_conversations_outlook_message_id ON public.conversations(outlook_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_outlook_message_id ON public.messages(outlook_message_id);
```

## Steps to Apply:

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to SQL Editor
4. Paste the SQL above
5. Click "Run"

## Verify the Migration

Run this query to check if the fields were added:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'conversations' 
AND column_name LIKE 'outlook%';
```

You should see:
- `outlook_message_id`
- `outlook_conversation_id`

## After Migration

1. Restart your backend server (if running)
2. Reload the Email Inbox page
3. The sync should automatically start for connected accounts
4. Check the sync banner at the top for progress

## Troubleshooting

If emails still don't appear:
1. Check Settings > Integrations to verify Outlook account is connected
2. Check browser console for errors (F12 > Console tab)
3. Check backend logs for sync errors
4. You can manually trigger sync by clicking "Sync Now" in Settings > Integrations
