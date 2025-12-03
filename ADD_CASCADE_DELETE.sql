-- Add CASCADE DELETE to ensure when connected_accounts are deleted,
-- all related conversations and messages are automatically deleted

-- Step 1: Drop existing foreign key constraint on conversations table
ALTER TABLE conversations 
DROP CONSTRAINT IF EXISTS conversations_received_on_account_id_fkey;

-- Step 2: Add new foreign key with CASCADE DELETE
ALTER TABLE conversations
ADD CONSTRAINT conversations_received_on_account_id_fkey 
FOREIGN KEY (received_on_account_id) 
REFERENCES connected_accounts(id) 
ON DELETE CASCADE;

-- Step 3: Drop existing foreign key constraint on messages table (if direct relationship exists)
ALTER TABLE messages 
DROP CONSTRAINT IF EXISTS messages_conversation_id_fkey;

-- Step 4: Add new foreign key with CASCADE DELETE for messages
ALTER TABLE messages
ADD CONSTRAINT messages_conversation_id_fkey 
FOREIGN KEY (conversation_id) 
REFERENCES conversations(id) 
ON DELETE CASCADE;

-- Step 5: Drop existing foreign key constraint on sync_status table
ALTER TABLE sync_status 
DROP CONSTRAINT IF EXISTS sync_status_inbox_id_fkey;

-- Step 6: Add new foreign key with CASCADE DELETE for sync_status
ALTER TABLE sync_status
ADD CONSTRAINT sync_status_inbox_id_fkey 
FOREIGN KEY (inbox_id) 
REFERENCES connected_accounts(id) 
ON DELETE CASCADE;

-- Verify constraints
SELECT 
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  confrelid::regclass AS referenced_table,
  confdeltype AS on_delete_action
FROM pg_constraint
WHERE contype = 'f' 
  AND (conrelid::regclass::text IN ('conversations', 'messages', 'sync_status'))
ORDER BY conrelid::regclass::text;

-- on_delete_action: 'c' = CASCADE, 'a' = NO ACTION, 'r' = RESTRICT, 'n' = SET NULL
