# How to Seed the Database

## Problem
The database is empty, causing blank pages. Seeding requires either:
1. Service Role Key (to bypass RLS)
2. Or running SQL directly in Supabase Dashboard

## Solution: Use Supabase SQL Editor

### Step 1: Get Your User IDs

1. Go to Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor**
4. Run this query to see existing users:

```sql
SELECT id, email FROM auth.users;
```

Note down the UUIDs (they look like: `123e4567-e89b-12d3-a456-426614174000`)

### Step 2: Run the Seed Script

1. In Supabase Dashboard → **SQL Editor**
2. Click **New Query**
3. Copy and paste the contents of `Converso-backend/src/scripts/seed.sql`
4. **OR** use this simplified version:

```sql
-- Quick Seed Script
DO $$
DECLARE
  admin_user_id UUID;
  account_sales_id UUID;
  account_linkedin_id UUID;
  conv1_id UUID;
  conv2_id UUID;
  conv3_id UUID;
BEGIN
  -- Get first user (or replace with specific email)
  SELECT id INTO admin_user_id FROM auth.users LIMIT 1;
  
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'No users found. Please create a user via frontend signup first.';
  END IF;
  
  -- Create pipeline stages
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
  
  -- Create connected accounts
  INSERT INTO connected_accounts (user_id, account_type, account_email, account_name, is_active)
  VALUES 
    (admin_user_id, 'email', 'sales@converso.com', 'Sales Team Email', true),
    (admin_user_id, 'email', 'support@converso.com', 'Support Email', true),
    (admin_user_id, 'linkedin', NULL, 'LinkedIn Business Account', true)
  ON CONFLICT DO NOTHING;
  
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
  
  RAISE NOTICE '✅ Seed completed successfully!';
END $$;
```

5. Click **Run** (or press Cmd/Ctrl + Enter)

### Step 3: Verify

After running the script, verify data was created:

```sql
-- Check conversations
SELECT COUNT(*) FROM conversations;

-- Check pipeline stages
SELECT COUNT(*) FROM pipeline_stages;

-- Check connected accounts
SELECT COUNT(*) FROM connected_accounts;

-- Check messages
SELECT COUNT(*) FROM messages;
```

### Step 4: Test in Frontend

1. Refresh your browser at `http://localhost:8080`
2. Navigate to:
   - `/inbox/email` - Should show email conversations
   - `/inbox/linkedin` - Should show LinkedIn conversations
   - `/inbox/conversations` - Should show all conversations
   - `/pipeline` - Should show pipeline stages

## Alternative: Get Service Role Key

If you prefer to use the seed script:

1. Go to Supabase Dashboard → **Settings** → **API**
2. Copy the **Service Role Key** (⚠️ Keep this secret!)
3. Add to `Converso-backend/.env`:
   ```
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```
4. Run: `npm run seed:mock`

## Troubleshooting

### "No users found"
- Create a user first via frontend signup
- Or manually create in Supabase Dashboard → Authentication → Users

### "Row Level Security policy violation"
- Use the SQL Editor method (bypasses RLS)
- Or add service role key to use seed scripts

### Pages still blank after seeding
- Check browser console for errors
- Verify API calls are working: `curl http://localhost:3001/api/conversations?userId=YOUR_USER_ID&userRole=admin`
- Make sure you're logged in with a user that exists in the database

