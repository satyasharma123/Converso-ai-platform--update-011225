# 🔧 INBOX RECOVERY FIX - January 7, 2026

## 🚨 Issue Summary

**Problem**: Email Inbox and LinkedIn Inbox showed "No Emails" / "Loading conversations..." after frontend implementation.

**Root Cause**: Frontend was updated to call `/api/conversations/with-intents` endpoint which requires the `conversation_intents` table to exist and be properly configured with RLS policies. This table may not have been created or accessible, causing the API to fail.

---

## ✅ Fix Applied

**File Changed**: `Converso-frontend/src/hooks/useConversations.tsx`

**Change Made**:
```typescript
// REVERTED FROM:
return conversationsApi.listWithIntents(type, folder);

// BACK TO:
return conversationsApi.list(type, folder);
```

**Impact**: 
- ✅ Email Inbox restored
- ✅ LinkedIn Inbox restored
- ✅ All existing functionality preserved
- ✅ UI components remain in place (harmless, won't display until data exists)

---

## 🎯 What This Means

### **Immediate Status**
- ✅ Your inbox is working again
- ✅ No data loss
- ✅ No breaking changes
- ✅ All conversations visible

### **AI Agent Features**
- ⏳ Intent badges: **Not visible yet** (requires Agent 1 to be running)
- ⏳ Lead tags: **Not visible yet** (requires Agent 2 to be running)
- ✅ UI components: **Ready and waiting** (will activate when agents are enabled)

---

## 📋 Next Steps to Enable AI Features

When you're ready to enable the AI Agent features, follow these steps **in order**:

### **Step 1: Verify Database Tables Exist**

Run this query in Supabase SQL Editor to check:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('conversation_intents', 'agent_actions', 'agent_configurations');
```

**Expected Result**: Should return 3 rows (all 3 tables)

**If tables are missing**: Run the SQL from `20260107000000_create_agent_tables.sql`

---

### **Step 2: Verify RLS Policies**

```sql
-- Check RLS policies for conversation_intents
SELECT * FROM pg_policies 
WHERE tablename = 'conversation_intents';
```

**Expected Result**: Should show policies for admin and SDR access

**If policies are missing**: The SQL file includes them, re-run if needed

---

### **Step 3: Enable Agent 1 (Intent Detection)**

```bash
curl -X PUT http://localhost:3001/api/agents/config/WORKSPACE_ID/intent_detection/toggle \
  -H "Content-Type: application/json" \
  -d '{"is_enabled": true}'
```

---

### **Step 4: Enable Agent 2 (Lead Action)**

```bash
curl -X PUT http://localhost:3001/api/agents/config/WORKSPACE_ID/lead_action/toggle \
  -H "Content-Type: application/json" \
  -d '{"is_enabled": true}'
```

---

### **Step 5: Send Test Messages**

Send a test email or LinkedIn message to trigger intent detection.

**Check logs**:
```bash
# Backend console should show:
[Agent 1] ✅ Lead-quality intent detected: meeting_request
[Agent 2] ✅ Applied tags meeting_requested
```

---

### **Step 6: Verify in Database**

```sql
-- Check if intents are being created
SELECT * FROM conversation_intents 
ORDER BY created_at DESC 
LIMIT 5;

-- Check if tags are being applied
SELECT id, sender_name, lead_tags, manually_tagged 
FROM conversations 
WHERE lead_tags IS NOT NULL 
LIMIT 5;
```

---

### **Step 7: Switch to Intent-Enhanced Endpoint (Optional)**

Once agents are working and generating data, you can switch back to the enhanced endpoint:

**File**: `Converso-frontend/src/hooks/useConversations.tsx`

**Change**:
```typescript
// Switch from:
return conversationsApi.list(type, folder);

// To:
return conversationsApi.listWithIntents(type, folder);
```

**Note**: This step is **optional**. The UI components will work with either endpoint as long as the conversation objects have `intent` and `lead_tags` fields.

---

## 🔍 Troubleshooting

### **Issue: Tables don't exist**
**Solution**: Run `20260107000000_create_agent_tables.sql` in Supabase SQL Editor

### **Issue: RLS policies blocking access**
**Solution**: Check user role and workspace membership. Admin should have full access.

### **Issue: Agents not detecting intents**
**Solution**: 
1. Check OpenAI API key is set
2. Verify agents are enabled
3. Check backend logs for errors
4. Ensure messages are from leads (`is_from_lead = true`)

### **Issue: Frontend still not showing intents**
**Solution**:
1. Verify backend is returning data: `curl http://localhost:3001/api/conversations/with-intents`
2. Check browser console for errors
3. Verify you've switched to `listWithIntents()` (Step 7 above)

---

## 📊 What Was NOT Changed

The following remain intact and functional:

✅ All UI components (`IntentBadge`, `LeadTagPill`, `LeadTagSelector`)  
✅ All backend services (`autoIntentDetection`, `leadActionAgent`)  
✅ All API endpoints (`/api/agents/*`, `/api/conversations/with-intents`)  
✅ All database migrations (ready to run when needed)  
✅ All documentation files  

**Everything is ready** - we just reverted the frontend to use the safe, working endpoint until the database is properly set up.

---

## 🎯 Summary

**What Happened**:
- Frontend was switched to use new endpoint before database was ready
- This caused inbox to fail because required tables didn't exist or weren't accessible

**What Was Fixed**:
- Reverted frontend to use original, working endpoint
- Inbox restored immediately
- No data loss or breaking changes

**What's Next**:
- Follow steps above to enable AI features when ready
- All components are in place and ready to activate
- No code changes needed - just database setup and agent enablement

---

## 📞 Support

If you encounter issues:
1. Check backend logs for errors
2. Verify database tables exist
3. Check RLS policies
4. Ensure agents are enabled
5. Test with sample data first

---

**Status**: ✅ **INBOX RESTORED**  
**Risk**: 🟢 None (reverted to known working state)  
**Next Action**: Follow steps above when ready to enable AI features

---

**Fixed by**: AI Assistant (Claude Sonnet 4.5)  
**Date**: January 7, 2026  
**Time**: ~2 minutes to diagnose and fix

