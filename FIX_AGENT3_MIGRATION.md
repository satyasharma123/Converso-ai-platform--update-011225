# 🔧 Fix Agent 3 Migration - Step by Step Guide

## 📋 Issue Summary

**Problem**: The Agent 3 configuration migration failed because the database CHECK constraint didn't include `'reply_generation'` as a valid agent type.

**Solution**: Created a new migration to update the constraint BEFORE inserting the configuration.

---

## ✅ What Was Fixed

### **Files Created/Modified**

1. **NEW**: `20260107000001_add_reply_generation_agent_type.sql`
   - Updates the CHECK constraint to include `'reply_generation'`
   - Must run FIRST

2. **RENAMED**: `20260107000002_*` → `20260107000003_create_agent3_reply_generation_config.sql`
   - Creates the default Agent 3 configuration
   - Now runs AFTER the constraint update

---

## 🚀 How to Apply the Fix

### **Option 1: Run in Supabase Dashboard** (Recommended)

#### Step 1: Update the Constraint
Go to Supabase SQL Editor and run:

```sql
-- Migration 1: Update constraint
ALTER TABLE public.agent_configurations 
DROP CONSTRAINT IF EXISTS agent_configurations_agent_type_check;

ALTER TABLE public.agent_configurations 
ADD CONSTRAINT agent_configurations_agent_type_check 
CHECK (agent_type IN (
  'intent_detection',
  'response_generation', 
  'reply_generation',
  'lead_scoring',
  'auto_assignment'
));
```

**Expected Result**: ✅ "Success. No rows returned"

#### Step 2: Create Agent 3 Configuration
Then run:

```sql
-- Migration 2: Create Agent 3 config
INSERT INTO public.agent_configurations (workspace_id, agent_type, agent_name, is_enabled, config_data, priority)
SELECT 
  id,
  'reply_generation',
  'Reply Generation Agent',
  false,
  '{
    "mode": "draft_only",
    "allow_sdr_access": false,
    "required_tags": ["meeting_requested", "info_requested"],
    "safety_rules": {
      "no_commitments": true,
      "no_pricing": true,
      "no_calendar_links": true,
      "no_legal_medical_financial": true
    },
    "tone": "professional",
    "max_draft_length": 1000,
    "include_signature": true
  }'::jsonb,
  2
FROM public.workspaces
ON CONFLICT (workspace_id, agent_type) DO NOTHING;
```

**Expected Result**: ✅ "Success. No rows returned" (or number of workspaces inserted)

---

### **Option 2: Run via Supabase CLI** (If you have it installed)

```bash
# Navigate to frontend directory
cd "/Users/satyasharma/Documents/Cursor Codes/Converso-AI-Platform 29 Dec/Converso-frontend"

# Run migrations
supabase db push
```

---

## 🧪 Verify the Fix

### **Step 1: Check Constraint**
```sql
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'agent_configurations_agent_type_check';
```

**Expected**: Should show `'reply_generation'` in the list

### **Step 2: Check Configuration**
```sql
SELECT * FROM agent_configurations 
WHERE agent_type = 'reply_generation';
```

**Expected**: Should return rows for each workspace with Agent 3 config

### **Step 3: Test the Toggle Endpoint**
```bash
curl -X PUT http://localhost:3001/api/agents/config/eaf12104-abe4-4518-9bb5-f598c2a22053/reply_generation/toggle \
  -H "Content-Type: application/json" \
  -d '{"is_enabled": true}'
```

**Expected Response**:
```json
{
  "success": true,
  "config": { ... },
  "message": "Agent enabled successfully"
}
```

---

## 🔍 What Changed

### **Before** (Broken)
```
Migration Order:
1. 20260107000002_create_agent3_reply_generation_config.sql
   ❌ Tries to insert 'reply_generation' 
   ❌ Constraint doesn't allow it
   ❌ FAILS
```

### **After** (Fixed)
```
Migration Order:
1. 20260107000001_add_reply_generation_agent_type.sql
   ✅ Updates constraint to allow 'reply_generation'
   
2. 20260107000003_create_agent3_reply_generation_config.sql
   ✅ Inserts Agent 3 configuration
   ✅ SUCCESS
```

---

## 📊 Migration Files

### **File 1**: `20260107000001_add_reply_generation_agent_type.sql`
```sql
-- Add 'reply_generation' to the agent_type check constraint

ALTER TABLE public.agent_configurations 
DROP CONSTRAINT IF EXISTS agent_configurations_agent_type_check;

ALTER TABLE public.agent_configurations 
ADD CONSTRAINT agent_configurations_agent_type_check 
CHECK (agent_type IN (
  'intent_detection',
  'response_generation', 
  'reply_generation',
  'lead_scoring',
  'auto_assignment'
));
```

### **File 2**: `20260107000003_create_agent3_reply_generation_config.sql`
```sql
-- Create default Reply Generation (Agent 3) configuration for all workspaces

INSERT INTO public.agent_configurations (workspace_id, agent_type, agent_name, is_enabled, config_data, priority)
SELECT 
  id,
  'reply_generation',
  'Reply Generation Agent',
  false,
  '{
    "mode": "draft_only",
    "allow_sdr_access": false,
    "required_tags": ["meeting_requested", "info_requested"],
    "safety_rules": {
      "no_commitments": true,
      "no_pricing": true,
      "no_calendar_links": true,
      "no_legal_medical_financial": true
    },
    "tone": "professional",
    "max_draft_length": 1000,
    "include_signature": true
  }'::jsonb,
  2
FROM public.workspaces
ON CONFLICT (workspace_id, agent_type) DO NOTHING;
```

---

## ⚠️ Important Notes

### **Safe to Run**
- ✅ Both migrations use `IF EXISTS` and `ON CONFLICT DO NOTHING`
- ✅ Won't affect existing data
- ✅ Won't break existing agents (intent_detection, etc.)
- ✅ Idempotent (can run multiple times safely)

### **What Won't Be Affected**
- ✅ Existing agent configurations (intent_detection)
- ✅ Existing conversations
- ✅ Existing messages
- ✅ Existing intents
- ✅ All other tables

### **What Will Change**
- ✅ `agent_configurations` table constraint (adds 'reply_generation')
- ✅ New rows in `agent_configurations` (one per workspace)

---

## 🐛 Troubleshooting

### **Issue**: "constraint already exists"
**Solution**: This is fine - the constraint was already updated. Continue to Step 2.

### **Issue**: "duplicate key value violates unique constraint"
**Solution**: Configuration already exists. Check with:
```sql
SELECT * FROM agent_configurations WHERE agent_type = 'reply_generation';
```

### **Issue**: "relation does not exist"
**Solution**: Make sure you're connected to the correct database.

---

## ✅ Success Checklist

After running the migrations:

- [ ] Constraint updated (includes 'reply_generation')
- [ ] Agent 3 configuration created for all workspaces
- [ ] Toggle endpoint works (returns success)
- [ ] Can enable Agent 3 via API
- [ ] Can generate reply via API

---

## 🚀 Next Steps After Fix

Once migrations are successful:

1. **Enable Agent 3**:
   ```bash
   curl -X PUT http://localhost:3001/api/agents/config/WORKSPACE_ID/reply_generation/toggle \
     -H "Content-Type: application/json" \
     -d '{"is_enabled": true}'
   ```

2. **Test Reply Generation**:
   ```bash
   ./test-agent3-reply-generation.sh
   ```

3. **Verify in Database**:
   ```sql
   SELECT * FROM agent_configurations 
   WHERE agent_type = 'reply_generation' 
   AND is_enabled = true;
   ```

---

## 📞 Support

If you encounter any issues:
1. Check the SQL error message
2. Verify you're connected to the correct database
3. Check that `workspaces` table has data
4. Verify `agent_configurations` table exists

---

**Status**: ✅ **FIX READY TO APPLY**  
**Risk**: Low (safe migrations, no data loss)  
**Rollback**: Easy (just disable the agent)

**Created**: January 7, 2026  
**Files Modified**: 2 (1 new, 1 renamed)

