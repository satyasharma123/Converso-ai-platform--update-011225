-- Create PostgreSQL function to get latest message folder per conversation
-- This is more efficient than fetching all messages and grouping in JavaScript

CREATE OR REPLACE FUNCTION get_latest_message_folders(conversation_ids uuid[])
RETURNS TABLE (
  conversation_id uuid,
  provider_folder text,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (m.conversation_id)
    m.conversation_id,
    m.provider_folder,
    m.created_at
  FROM messages m
  WHERE m.conversation_id = ANY(conversation_ids)
  ORDER BY m.conversation_id, m.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Test the function
SELECT * FROM get_latest_message_folders(
  ARRAY(
    SELECT DISTINCT conversation_id::uuid 
    FROM messages 
    WHERE provider = 'outlook' 
    LIMIT 5
  )
);
