# 🚀 QUICK START: Agent 1 & Agent 2

## ⚡ 5-Minute Setup Guide

### **Step 1: Run Database Migration** (2 minutes)

1. Open Supabase SQL Editor
2. Copy entire contents of `RUN_THIS_IN_SUPABASE_AGENT2.sql`
3. Paste and click "Run"
4. Wait for success message

**Expected Output**:
```
✅ Agent 2 (Lead Action Agent) migration completed successfully!
```

---

### **Step 2: Enable Agents** (1 minute)

```bash
# Set your workspace ID
export WORKSPACE_ID="your-workspace-id-here"

# Enable Agent 1 (Intent Detection)
curl -X PUT http://localhost:3001/api/agents/config/$WORKSPACE_ID/intent_detection/toggle \
  -H "Content-Type: application/json" \
  -d '{"is_enabled": true}'

# Enable Agent 2 (Lead Action)
curl -X PUT http://localhost:3001/api/agents/config/$WORKSPACE_ID/lead_action/toggle \
  -H "Content-Type: application/json" \
  -d '{"is_enabled": true}'
```

**Expected Response**:
```json
{
  "success": true,
  "is_enabled": true,
  "message": "Agent enabled successfully"
}
```

---

### **Step 3: Test with Real Message** (2 minutes)

1. Send a test email to your platform with meeting request:
   ```
   Subject: Demo Request
   Body: Hi, I'd like to schedule a demo call this week. Are you available?
   ```

2. Check backend console logs:
   ```bash
   # Should see:
   [Agent 1] ✅ Lead-quality intent detected: meeting_request
   [Agent 2] ✅ Applied tags meeting_requested
   [Agent 2] ✅ Updated pipeline stage to "Contacted"
   ```

3. Verify in database:
   ```sql
   SELECT 
     sender_name,
     lead_tags,
     custom_stage_id
   FROM conversations
   WHERE lead_tags IS NOT NULL
   ORDER BY created_at DESC
   LIMIT 5;
   ```

---

## ✅ Success Indicators

You'll know it's working when you see:

1. **Console Logs**:
   - `[Agent 1] ✅ Lead-quality intent detected`
   - `[Agent 2] ✅ Applied tags`
   - `[Agent 2] ✅ Updated pipeline stage`

2. **Database**:
   - `conversation_intents` table has new rows
   - `conversations.lead_tags` has values like `["meeting_requested"]`
   - `conversations.custom_stage_id` is updated

3. **API Responses**:
   - `GET /api/conversations/with-intents` returns conversations with intent data
   - Tags are visible in conversation objects

---

## 🧪 Quick Test Script

```bash
# Set environment variables
export WORKSPACE_ID="your-workspace-id"
export CONVERSATION_ID="your-conversation-id"

# Run test script
./test-agent2-lead-action.sh
```

**Expected Output**:
```
✅ Agent 2 is ENABLED
✅ Agent 2 executed successfully
✅ Manual tags applied successfully
✅ Manual override respected (Agent 2 skipped)
✅ Tags removed successfully
```

---

## 🐛 Quick Troubleshooting

### **Problem**: Agents not running
**Solution**:
```bash
# Check if agents are enabled
curl http://localhost:3001/api/agents/config/$WORKSPACE_ID/intent_detection
curl http://localhost:3001/api/agents/config/$WORKSPACE_ID/lead_action
```

### **Problem**: No intents detected
**Solution**:
- Verify OpenAI API key is set: `echo $OPENAI_API_KEY`
- Check message is from a lead: `is_from_lead = true`
- Check console logs for errors

### **Problem**: Tags not applied
**Solution**:
```sql
-- Check if conversation is manually tagged
SELECT manually_tagged, lead_tags 
FROM conversations 
WHERE id = 'YOUR_CONV_ID';

-- If manually_tagged = true, remove tags to reset:
UPDATE conversations 
SET lead_tags = NULL, manually_tagged = false 
WHERE id = 'YOUR_CONV_ID';
```

---

## 📊 What to Monitor

### **Console Logs**
```bash
# Watch for these messages:
[Agent 1] ✅ Lead-quality intent detected
[Agent 2] ✅ Applied tags
[Agent 2] ✅ Updated pipeline stage
```

### **Database Queries**
```sql
-- Check recent intents
SELECT * FROM conversation_intents 
ORDER BY created_at DESC LIMIT 10;

-- Check tagged conversations
SELECT sender_name, lead_tags, manually_tagged 
FROM conversations 
WHERE lead_tags IS NOT NULL 
ORDER BY updated_at DESC LIMIT 10;

-- Check agent actions
SELECT * FROM agent_actions 
ORDER BY created_at DESC LIMIT 10;
```

---

## 🎯 Next Steps

1. ✅ Verify agents are working
2. ✅ Monitor console logs
3. ✅ Check database for tagged conversations
4. 🔄 Implement frontend UI (pending)
5. 🔄 Add analytics dashboard (future)

---

## 📞 Need Help?

1. Check `AGENT1_AGENT2_COMPLETE_SUMMARY.md` for full documentation
2. Run `./test-agent2-lead-action.sh` for automated testing
3. Check console logs for detailed error messages
4. Verify agents are enabled via API

---

**Time to Setup**: ~5 minutes  
**Difficulty**: Easy  
**Risk**: Low (non-breaking, respects manual overrides)

**Status**: ✅ Ready to deploy

