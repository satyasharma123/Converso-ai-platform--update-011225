-- Debug: Check the actual derived_folder for the specific sent email
-- "Fwd: Why McDonald's, KFC taste bitter for Indian investors"

SELECT 
  c.id as conversation_id,
  c.subject,
  c.sender_email,
  c.email_folder as old_conversation_folder,
  -- Get latest message info
  (SELECT provider_folder 
   FROM messages 
   WHERE conversation_id = c.id 
   ORDER BY created_at DESC 
   LIMIT 1) as latest_message_folder,
  -- Get all message folders
  (SELECT string_agg(DISTINCT provider_folder || ' (' || created_at::text || ')', ', ' ORDER BY provider_folder || ' (' || created_at::text || ')')
   FROM messages 
   WHERE conversation_id = c.id) as all_message_folders,
  -- Count messages
  (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as total_messages
FROM conversations c
WHERE c.conversation_type = 'email'
  AND c.subject LIKE '%McDonald%'
ORDER BY c.id;


