-- Test the derived_folder logic for Outlook sent messages
-- This simulates what the backend should be computing

-- Get conversations that have sent messages
WITH sent_message_conversations AS (
  SELECT DISTINCT conversation_id
  FROM messages
  WHERE provider = 'outlook'
    AND provider_folder = 'sent'
),
-- Get latest message per conversation using the new function
latest_folders AS (
  SELECT * FROM get_latest_message_folders(
    ARRAY(SELECT conversation_id FROM sent_message_conversations)
  )
)
-- Show what derived_folder should be for these conversations
SELECT 
  c.id as conversation_id,
  c.subject,
  c.sender_email,
  c.email_folder as old_folder,
  lf.provider_folder as derived_folder,
  lf.created_at as latest_message_date,
  -- Check if there are multiple messages in this conversation
  (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as total_messages,
  -- Show all folders this conversation has messages in
  (SELECT string_agg(DISTINCT provider_folder, ', ' ORDER BY provider_folder) 
   FROM messages 
   WHERE conversation_id = c.id) as all_folders
FROM conversations c
JOIN latest_folders lf ON lf.conversation_id = c.id
ORDER BY lf.created_at DESC;
