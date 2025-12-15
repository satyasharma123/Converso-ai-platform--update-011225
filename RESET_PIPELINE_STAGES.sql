-- Reset all conversations' pipeline stages to NULL
-- This will remove all conversations from the Sales Pipeline
-- They will only appear again when manually assigned to a stage from Email/LinkedIn Inbox

-- Backup query (run this first to see what will be affected)
-- SELECT id, sender_name, sender_email, custom_stage_id 
-- FROM conversations 
-- WHERE custom_stage_id IS NOT NULL;

-- Reset all custom_stage_id to NULL
UPDATE conversations 
SET custom_stage_id = NULL 
WHERE custom_stage_id IS NOT NULL;

-- Verify the update
SELECT COUNT(*) as total_conversations,
       COUNT(custom_stage_id) as conversations_with_stage
FROM conversations;
