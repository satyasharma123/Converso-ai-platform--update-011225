-- Test queries for conversation_work_queue view
-- Run these in Supabase SQL Editor to verify the view works correctly

-- Test 1: Basic view query (first 10 rows)
SELECT * FROM conversation_work_queue LIMIT 10;

-- Test 2: Check pending_reply logic
SELECT
  conversation_id,
  sender_name,
  last_inbound_at,
  last_outbound_at,
  pending_reply,
  idle_days,
  overdue
FROM conversation_work_queue
WHERE pending_reply = true
LIMIT 10;

-- Test 3: Check overdue items
SELECT
  conversation_id,
  sender_name,
  conversation_type,
  last_inbound_at,
  idle_days,
  overdue
FROM conversation_work_queue
WHERE overdue = true
ORDER BY last_inbound_at ASC
LIMIT 10;

-- Test 4: Check conversations without messages
SELECT
  conversation_id,
  sender_name,
  last_message_at,
  last_inbound_at,
  last_outbound_at,
  pending_reply,
  idle_days
FROM conversation_work_queue
WHERE last_message_at IS NULL
LIMIT 10;

-- Test 5: Group by conversation_type
SELECT
  conversation_type,
  COUNT(*) AS total_conversations,
  COUNT(CASE WHEN pending_reply = true THEN 1 END) AS pending_reply_count,
  COUNT(CASE WHEN overdue = true THEN 1 END) AS overdue_count,
  AVG(idle_days) AS avg_idle_days
FROM conversation_work_queue
GROUP BY conversation_type;

-- Test 6: Check workspace isolation
SELECT
  workspace_id,
  COUNT(*) AS total_conversations,
  COUNT(CASE WHEN pending_reply = true THEN 1 END) AS pending_reply_count
FROM conversation_work_queue
GROUP BY workspace_id;

-- Test 7: Verify timestamp logic (email conversations)
SELECT
  conversation_id,
  sender_email,
  last_message_at,
  last_inbound_at,
  last_outbound_at,
  CASE
    WHEN last_inbound_at > last_outbound_at THEN 'Lead replied last'
    WHEN last_outbound_at > last_inbound_at THEN 'We replied last'
    WHEN last_inbound_at IS NOT NULL AND last_outbound_at IS NULL THEN 'Lead only'
    WHEN last_outbound_at IS NOT NULL AND last_inbound_at IS NULL THEN 'We only'
    ELSE 'No messages'
  END AS message_flow,
  pending_reply
FROM conversation_work_queue
WHERE conversation_type = 'email'
LIMIT 10;

-- Test 8: Check assigned vs unassigned
SELECT
  CASE WHEN assigned_sdr_id IS NULL THEN 'Unassigned' ELSE 'Assigned' END AS assignment_status,
  COUNT(*) AS count,
  COUNT(CASE WHEN pending_reply = true THEN 1 END) AS pending_count,
  COUNT(CASE WHEN overdue = true THEN 1 END) AS overdue_count
FROM conversation_work_queue
GROUP BY assignment_status;
