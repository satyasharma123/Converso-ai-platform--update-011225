-- Database Seed Script
-- Run this in Supabase Dashboard -> SQL Editor
-- This bypasses RLS since it runs as the database owner

-- 1. Create Pipeline Stages (if they don't exist)
INSERT INTO pipeline_stages (name, description, display_order)
VALUES 
  ('New Lead', 'Newly received leads', 0),
  ('Contacted', 'Initial contact made', 1),
  ('Qualified', 'Lead qualified for sales', 2),
  ('Proposal Sent', 'Proposal sent to lead', 3),
  ('Negotiation', 'In negotiation phase', 4),
  ('Closed Won', 'Deal closed successfully', 5),
  ('Closed Lost', 'Deal lost', 6)
ON CONFLICT (name) DO NOTHING;

-- 2. Get stage IDs for reference
-- Note: You'll need to replace these UUIDs with actual IDs from your database
-- Run this query first to get the IDs:
-- SELECT id, name FROM pipeline_stages ORDER BY display_order;

-- 3. Create Connected Accounts
-- Note: Replace 'YOUR_ADMIN_USER_ID' with actual UUID from auth.users table
-- To get user IDs, run: SELECT id, email FROM auth.users;

-- Example (replace with actual UUIDs):
/*
INSERT INTO connected_accounts (user_id, account_type, account_email, account_name, is_active)
VALUES 
  ('YOUR_ADMIN_USER_ID', 'email', 'sales@converso.com', 'Sales Team Email', true),
  ('YOUR_ADMIN_USER_ID', 'email', 'support@converso.com', 'Support Email', true),
  ('YOUR_ADMIN_USER_ID', 'linkedin', NULL, 'LinkedIn Business Account', true);
*/

-- 4. Create Sample Conversations
-- Note: Replace UUIDs with actual IDs from previous inserts
/*
INSERT INTO conversations (
  sender_name, 
  sender_email, 
  subject, 
  preview, 
  conversation_type, 
  status, 
  is_read, 
  last_message_at,
  received_on_account_id
)
VALUES 
  (
    'John Doe',
    'john.doe@example.com',
    'Interested in your product',
    'Hi, I would like to learn more about your services. Can we schedule a call?',
    'email',
    'new',
    false,
    NOW(),
    (SELECT id FROM connected_accounts WHERE account_name = 'Sales Team Email' LIMIT 1)
  ),
  (
    'Jane Smith',
    'jane.smith@example.com',
    'Follow up on meeting',
    'Thank you for the great presentation yesterday. I''d like to discuss pricing...',
    'email',
    'engaged',
    true,
    NOW() - INTERVAL '1 hour',
    (SELECT id FROM connected_accounts WHERE account_name = 'Sales Team Email' LIMIT 1)
  ),
  (
    'Mike Johnson',
    NULL,
    NULL,
    'I saw your post about the new features. Very interested in learning more!',
    'linkedin',
    'qualified',
    false,
    NOW() - INTERVAL '2 hours',
    (SELECT id FROM connected_accounts WHERE account_name = 'LinkedIn Business Account' LIMIT 1)
  );
*/

-- 5. Create Sample Messages
-- Note: Replace conversation_id with actual conversation IDs
/*
INSERT INTO messages (conversation_id, sender_name, content, is_from_lead, created_at)
SELECT 
  c.id,
  c.sender_name,
  c.preview,
  true,
  c.last_message_at
FROM conversations c
WHERE c.sender_name IN ('John Doe', 'Jane Smith', 'Mike Johnson');
*/

-- Quick seed script (run after getting user IDs):
-- Replace 'YOUR_USER_ID' with actual UUID from: SELECT id, email FROM auth.users;

DO $$
DECLARE
  admin_user_id UUID;
  stage_new_lead_id UUID;
  stage_contacted_id UUID;
  account_sales_id UUID;
  account_linkedin_id UUID;
  conv1_id UUID;
  conv2_id UUID;
  conv3_id UUID;
BEGIN
  -- Get admin user ID (use first user or specific email)
  SELECT id INTO admin_user_id FROM auth.users 
  WHERE email = 'admin@converso.ai' OR email LIKE '%@%' 
  LIMIT 1;
  
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'No user found. Please create a user first via frontend signup.';
  END IF;
  
  -- Get stage IDs
  SELECT id INTO stage_new_lead_id FROM pipeline_stages WHERE name = 'New Lead';
  SELECT id INTO stage_contacted_id FROM pipeline_stages WHERE name = 'Contacted';
  
  -- Create connected accounts
  INSERT INTO connected_accounts (user_id, account_type, account_email, account_name, is_active)
  VALUES 
    (admin_user_id, 'email', 'sales@converso.com', 'Sales Team Email', true),
    (admin_user_id, 'email', 'support@converso.com', 'Support Email', true),
    (admin_user_id, 'linkedin', NULL, 'LinkedIn Business Account', true)
  ON CONFLICT DO NOTHING
  RETURNING id INTO account_sales_id;
  
  SELECT id INTO account_sales_id FROM connected_accounts WHERE account_name = 'Sales Team Email' LIMIT 1;
  SELECT id INTO account_linkedin_id FROM connected_accounts WHERE account_name = 'LinkedIn Business Account' LIMIT 1;
  
  -- Create conversations
  INSERT INTO conversations (
    sender_name, sender_email, subject, preview, conversation_type, 
    status, is_read, last_message_at, received_on_account_id
  )
  VALUES 
    (
      'John Doe', 'john.doe@example.com', 'Interested in your product',
      'Hi, I would like to learn more about your services. Can we schedule a call?',
      'email', 'new', false, NOW(), account_sales_id
    ),
    (
      'Jane Smith', 'jane.smith@example.com', 'Follow up on meeting',
      'Thank you for the great presentation yesterday. I''d like to discuss pricing...',
      'email', 'engaged', true, NOW() - INTERVAL '1 hour', account_sales_id
    ),
    (
      'Mike Johnson', NULL, NULL,
      'I saw your post about the new features. Very interested in learning more!',
      'linkedin', 'qualified', false, NOW() - INTERVAL '2 hours', account_linkedin_id
    )
  RETURNING id INTO conv1_id;
  
  -- Get conversation IDs
  SELECT id INTO conv1_id FROM conversations WHERE sender_name = 'John Doe' LIMIT 1;
  SELECT id INTO conv2_id FROM conversations WHERE sender_name = 'Jane Smith' LIMIT 1;
  SELECT id INTO conv3_id FROM conversations WHERE sender_name = 'Mike Johnson' LIMIT 1;
  
  -- Create messages
  IF conv1_id IS NOT NULL THEN
    INSERT INTO messages (conversation_id, sender_name, content, is_from_lead, created_at)
    VALUES 
      (conv1_id, 'John Doe', 'Hi, I would like to learn more about your services. Can we schedule a call?', true, NOW() - INTERVAL '1 day'),
      (conv1_id, 'SDR User', 'Hi John! Thank you for reaching out. I''d be happy to schedule a call.', false, NOW() - INTERVAL '23 hours');
  END IF;
  
  IF conv2_id IS NOT NULL THEN
    INSERT INTO messages (conversation_id, sender_name, content, is_from_lead, created_at)
    VALUES 
      (conv2_id, 'Jane Smith', 'Thank you for the great presentation yesterday. I''d like to discuss pricing options.', true, NOW() - INTERVAL '1 hour'),
      (conv2_id, 'SDR User', 'Hi Jane! Great to hear from you. I''ll send over our pricing options right away.', false, NOW() - INTERVAL '55 minutes');
  END IF;
  
  IF conv3_id IS NOT NULL THEN
    INSERT INTO messages (conversation_id, sender_name, content, is_from_lead, created_at)
    VALUES 
      (conv3_id, 'Mike Johnson', 'I saw your post about the new features. Very interested in learning more!', true, NOW() - INTERVAL '2 hours');
  END IF;
  
  RAISE NOTICE 'Seed completed successfully!';
END $$;

