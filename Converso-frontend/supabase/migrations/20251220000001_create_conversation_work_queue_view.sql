-- Migration: Create conversation_work_queue view
-- Purpose: Derive operational metrics for work queue management
-- Phase: Sprint 4.0 - Work Queue Derived View
-- Date: 2024-12-20

-- Drop view if it exists (for idempotency)
DROP VIEW IF EXISTS conversation_work_queue;

-- Create the conversation_work_queue view
CREATE VIEW conversation_work_queue AS
SELECT
  c.id AS conversation_id,
  c.conversation_type,
  c.sender_name,
  c.sender_email,
  c.sender_linkedin_url,
  c.subject,
  c.preview,
  c.assigned_to AS assigned_sdr_id,
  c.custom_stage_id,
  c.stage_assigned_at,
  c.workspace_id,
  c.created_at,
  
  -- Derived timestamp fields from messages
  MAX(m.created_at) AS last_message_at,
  MAX(CASE WHEN m.is_from_lead = true THEN m.created_at ELSE NULL END) AS last_inbound_at,
  MAX(CASE WHEN m.is_from_lead = false THEN m.created_at ELSE NULL END) AS last_outbound_at,
  
  -- Derived boolean: pending_reply
  -- TRUE if last_inbound_at exists AND (last_outbound_at is NULL OR last_inbound_at > last_outbound_at)
  CASE
    WHEN MAX(CASE WHEN m.is_from_lead = true THEN m.created_at ELSE NULL END) IS NOT NULL
      AND (
        MAX(CASE WHEN m.is_from_lead = false THEN m.created_at ELSE NULL END) IS NULL
        OR MAX(CASE WHEN m.is_from_lead = true THEN m.created_at ELSE NULL END) > MAX(CASE WHEN m.is_from_lead = false THEN m.created_at ELSE NULL END)
      )
    THEN true
    ELSE false
  END AS pending_reply,
  
  -- Derived integer: idle_days
  -- Days since last message (any direction)
  CASE
    WHEN MAX(m.created_at) IS NOT NULL
    THEN EXTRACT(DAY FROM (NOW() - MAX(m.created_at)))::INTEGER
    ELSE NULL
  END AS idle_days,
  
  -- Derived boolean: overdue (24-hour SLA)
  -- TRUE if pending_reply AND hours since last_inbound_at > 24
  CASE
    WHEN MAX(CASE WHEN m.is_from_lead = true THEN m.created_at ELSE NULL END) IS NOT NULL
      AND (
        MAX(CASE WHEN m.is_from_lead = false THEN m.created_at ELSE NULL END) IS NULL
        OR MAX(CASE WHEN m.is_from_lead = true THEN m.created_at ELSE NULL END) > MAX(CASE WHEN m.is_from_lead = false THEN m.created_at ELSE NULL END)
      )
      AND EXTRACT(EPOCH FROM (NOW() - MAX(CASE WHEN m.is_from_lead = true THEN m.created_at ELSE NULL END))) / 3600 > 24
    THEN true
    ELSE false
  END AS overdue

FROM conversations c
LEFT JOIN messages m ON m.conversation_id = c.id
GROUP BY
  c.id,
  c.conversation_type,
  c.sender_name,
  c.sender_email,
  c.sender_linkedin_url,
  c.subject,
  c.preview,
  c.assigned_to,
  c.custom_stage_id,
  c.stage_assigned_at,
  c.workspace_id,
  c.created_at;

-- Add comment to view
COMMENT ON VIEW conversation_work_queue IS 'Operational work queue view with derived metrics: last_inbound_at, last_outbound_at, pending_reply, idle_days, overdue. Updated in real-time based on conversations and messages tables.';
