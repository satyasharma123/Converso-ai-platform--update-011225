-- ============================================
-- Converso Database Seed Script
-- Run this in Supabase Dashboard -> SQL Editor
-- This bypasses RLS since it runs as the database owner
-- ============================================

DO $$
DECLARE
  admin_user_id UUID;
  account_sales_id UUID;
  account_support_id UUID;
  account_linkedin_id UUID;
  stage_new_lead_id UUID;
  stage_contacted_id UUID;
  stage_qualified_id UUID;
  conv1_id UUID;
  conv2_id UUID;
  conv3_id UUID;
  conv4_id UUID;
  conv5_id UUID;
  conv6_id UUID;
BEGIN
  -- Get first user (or create one via frontend signup first)
  SELECT id INTO admin_user_id FROM auth.users LIMIT 1;
  
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'No users found. Please create a user via frontend signup first at /signup';
  END IF;
  
  RAISE NOTICE 'Using user ID: %', admin_user_id;
  
  -- ============================================
  -- 1. Create Pipeline Stages
  -- ============================================
  RAISE NOTICE 'Creating pipeline stages...';
  
  -- Insert pipeline stages (skip if already exist)
  INSERT INTO pipeline_stages (name, description, display_order)
  SELECT * FROM (VALUES 
    ('New Lead', 'Newly received leads', 0),
    ('Contacted', 'Initial contact made', 1),
    ('Qualified', 'Lead qualified for sales', 2),
    ('Proposal Sent', 'Proposal sent to lead', 3),
    ('Negotiation', 'In negotiation phase', 4),
    ('Closed Won', 'Deal closed successfully', 5),
    ('Closed Lost', 'Deal lost', 6)
  ) AS v(name, description, display_order)
  WHERE NOT EXISTS (
    SELECT 1 FROM pipeline_stages WHERE pipeline_stages.name = v.name
  );
  
  -- Get stage IDs
  SELECT id INTO stage_new_lead_id FROM pipeline_stages WHERE name = 'New Lead' LIMIT 1;
  SELECT id INTO stage_contacted_id FROM pipeline_stages WHERE name = 'Contacted' LIMIT 1;
  SELECT id INTO stage_qualified_id FROM pipeline_stages WHERE name = 'Qualified' LIMIT 1;
  
  RAISE NOTICE '✓ Pipeline stages created';
  
  -- ============================================
  -- 2. Create Connected Accounts
  -- ============================================
  RAISE NOTICE 'Creating connected accounts...';
  
  -- Insert connected accounts (skip if already exist)
  INSERT INTO connected_accounts (user_id, account_type, account_email, account_name, is_active)
  SELECT * FROM (VALUES 
    (admin_user_id, 'email'::conversation_type, 'sales@converso.com', 'Sales Team Email', true),
    (admin_user_id, 'email'::conversation_type, 'support@converso.com', 'Support Email', true),
    (admin_user_id, 'linkedin'::conversation_type, NULL, 'LinkedIn Business Account', true)
  ) AS v(user_id, account_type, account_email, account_name, is_active)
  WHERE NOT EXISTS (
    SELECT 1 FROM connected_accounts 
    WHERE connected_accounts.account_name = v.account_name 
      AND connected_accounts.user_id = v.user_id
  );
  
  -- Get account IDs
  SELECT id INTO account_sales_id FROM connected_accounts WHERE account_name = 'Sales Team Email' AND user_id = admin_user_id LIMIT 1;
  SELECT id INTO account_support_id FROM connected_accounts WHERE account_name = 'Support Email' AND user_id = admin_user_id LIMIT 1;
  SELECT id INTO account_linkedin_id FROM connected_accounts WHERE account_name = 'LinkedIn Business Account' AND user_id = admin_user_id LIMIT 1;
  
  RAISE NOTICE '✓ Connected accounts created';
  
  -- ============================================
  -- 3. Create Conversations
  -- ============================================
  RAISE NOTICE 'Creating conversations...';
  
  INSERT INTO conversations (
    sender_name, 
    sender_email, 
    sender_linkedin_url,
    subject, 
    preview, 
    conversation_type, 
    status, 
    is_read, 
    last_message_at,
    received_on_account_id,
    assigned_to,
    custom_stage_id
  )
  VALUES 
    -- Email conversations
    (
      'John Doe',
      'john.doe@example.com',
      NULL,
      'Interested in your product',
      'Hi, I would like to learn more about your services. Can we schedule a call?',
      'email',
      'new',
      false,
      NOW(),
      account_sales_id,
      NULL,
      stage_new_lead_id
    ),
    (
      'Jane Smith',
      'jane.smith@example.com',
      NULL,
      'Follow up on meeting',
      'Thank you for the great presentation yesterday. I''d like to discuss pricing...',
      'email',
      'engaged',
      true,
      NOW() - INTERVAL '1 hour',
      account_sales_id,
      admin_user_id,
      stage_contacted_id
    ),
    (
      'Sarah Williams',
      'sarah.williams@example.com',
      NULL,
      'Product demo request',
      'We are looking for a solution like yours. Can we schedule a demo?',
      'email',
      'new',
      false,
      NOW() - INTERVAL '30 minutes',
      account_sales_id,
      NULL,
      stage_new_lead_id
    ),
    (
      'David Brown',
      'david.brown@example.com',
      NULL,
      'Pricing inquiry',
      'What are your pricing plans? We have a team of 50 people.',
      'email',
      'qualified',
      true,
      NOW() - INTERVAL '90 minutes',
      account_sales_id,
      admin_user_id,
      stage_qualified_id
    ),
    -- LinkedIn conversations
    (
      'Mike Johnson',
      NULL,
      'https://linkedin.com/in/mikejohnson',
      NULL,
      'I saw your post about the new features. Very interested in learning more!',
      'linkedin',
      'qualified',
      false,
      NOW() - INTERVAL '2 hours',
      account_linkedin_id,
      admin_user_id,
      stage_qualified_id
    ),
    (
      'Emily Davis',
      NULL,
      'https://linkedin.com/in/emilydavis',
      NULL,
      'Love what you''re building! Would love to connect and learn more.',
      'linkedin',
      'new',
      false,
      NOW() - INTERVAL '3 hours',
      account_linkedin_id,
      NULL,
      stage_new_lead_id
    );
  
  -- Get conversation IDs (after insert)
  SELECT id INTO conv1_id FROM conversations WHERE sender_name = 'John Doe' AND sender_email = 'john.doe@example.com' LIMIT 1;
  SELECT id INTO conv2_id FROM conversations WHERE sender_name = 'Jane Smith' AND sender_email = 'jane.smith@example.com' LIMIT 1;
  SELECT id INTO conv3_id FROM conversations WHERE sender_name = 'Sarah Williams' AND sender_email = 'sarah.williams@example.com' LIMIT 1;
  SELECT id INTO conv4_id FROM conversations WHERE sender_name = 'David Brown' AND sender_email = 'david.brown@example.com' LIMIT 1;
  SELECT id INTO conv5_id FROM conversations WHERE sender_name = 'Mike Johnson' AND sender_linkedin_url = 'https://linkedin.com/in/mikejohnson' LIMIT 1;
  SELECT id INTO conv6_id FROM conversations WHERE sender_name = 'Emily Davis' AND sender_linkedin_url = 'https://linkedin.com/in/emilydavis' LIMIT 1;
  
  RAISE NOTICE '✓ Conversations created';
  
  -- ============================================
  -- 4. Create Messages
  -- ============================================
  RAISE NOTICE 'Creating messages...';
  
  -- Messages for John Doe conversation
  IF conv1_id IS NOT NULL THEN
    INSERT INTO messages (conversation_id, sender_name, sender_id, content, is_from_lead, created_at)
    VALUES 
      (conv1_id, 'John Doe', NULL, 'Hi, I would like to learn more about your services. Can we schedule a call?', true, NOW() - INTERVAL '1 day'),
      (conv1_id, 'SDR User', admin_user_id, 'Hi John! Thank you for reaching out. I''d be happy to schedule a call. What time works best for you?', false, NOW() - INTERVAL '23 hours')
    ;
  END IF;
  
  -- Messages for Jane Smith conversation
  IF conv2_id IS NOT NULL THEN
    INSERT INTO messages (conversation_id, sender_name, sender_id, content, is_from_lead, created_at)
    VALUES 
      (conv2_id, 'Jane Smith', NULL, 'Thank you for the great presentation yesterday. I''d like to discuss pricing options.', true, NOW() - INTERVAL '1 hour'),
      (conv2_id, 'SDR User', admin_user_id, 'Hi Jane! Great to hear from you. I''ll send over our pricing options right away.', false, NOW() - INTERVAL '55 minutes')
    ;
  END IF;
  
  -- Messages for Sarah Williams conversation
  IF conv3_id IS NOT NULL THEN
    INSERT INTO messages (conversation_id, sender_name, sender_id, content, is_from_lead, created_at)
    VALUES 
      (conv3_id, 'Sarah Williams', NULL, 'We are looking for a solution like yours. Can we schedule a demo?', true, NOW() - INTERVAL '30 minutes')
    ;
  END IF;
  
  -- Messages for David Brown conversation
  IF conv4_id IS NOT NULL THEN
    INSERT INTO messages (conversation_id, sender_name, sender_id, content, is_from_lead, created_at)
    VALUES 
      (conv4_id, 'David Brown', NULL, 'What are your pricing plans? We have a team of 50 people.', true, NOW() - INTERVAL '90 minutes'),
      (conv4_id, 'SDR User', admin_user_id, 'Hi David! For teams of 50, we have a special enterprise plan. Let me send you the details.', false, NOW() - INTERVAL '85 minutes')
    ;
  END IF;
  
  -- Messages for Mike Johnson conversation (LinkedIn)
  IF conv5_id IS NOT NULL THEN
    INSERT INTO messages (conversation_id, sender_name, sender_id, content, is_from_lead, created_at)
    VALUES 
      (conv5_id, 'Mike Johnson', NULL, 'I saw your post about the new features. Very interested in learning more!', true, NOW() - INTERVAL '2 hours')
    ;
  END IF;
  
  -- Messages for Emily Davis conversation (LinkedIn)
  IF conv6_id IS NOT NULL THEN
    INSERT INTO messages (conversation_id, sender_name, sender_id, content, is_from_lead, created_at)
    VALUES 
      (conv6_id, 'Emily Davis', NULL, 'Love what you''re building! Would love to connect and learn more.', true, NOW() - INTERVAL '3 hours')
    ;
  END IF;
  
  RAISE NOTICE '✓ Messages created';
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ Seed completed successfully!';
  RAISE NOTICE '📊 Created:';
  RAISE NOTICE '   - 7 pipeline stages';
  RAISE NOTICE '   - 3 connected accounts';
  RAISE NOTICE '   - 6 conversations (4 email, 2 LinkedIn)';
  RAISE NOTICE '   - 9 messages';
  RAISE NOTICE '';
  RAISE NOTICE '🎉 Your database is now populated!';
  RAISE NOTICE '💡 Refresh your frontend to see the data';
  
END $$;

