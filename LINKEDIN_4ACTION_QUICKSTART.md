# LinkedIn 4-Action Sync - Quick Start Guide

## 🚀 What Was Implemented

A comprehensive LinkedIn DM sync pipeline with 4 sequential actions:

1. **Action 1** - Download all chats from Unipile
2. **Action 2** - Enrich sender details (name, LinkedIn URL)
3. **Action 3** - Fetch profile pictures
4. **Action 4** - Download all messages (sender_name never null!)

Plus a webhook handler for real-time incremental sync.

## 📁 New Files Created

### Backend Services
- `Converso-backend/src/unipile/linkedinSync.4actions.ts` - Main 4-action sync service
- `Converso-backend/src/unipile/linkedinWebhook.4actions.ts` - Webhook handler
- `Converso-backend/src/routes/linkedin.sync.routes.ts` - Sync API endpoints

### Database Migration
- `Converso-frontend/supabase/migrations/20251208000008_add_sync_tracking_columns.sql`

### Documentation
- `LINKEDIN_4ACTION_SYNC_DOCUMENTATION.md` - Complete technical docs
- `LINKEDIN_4ACTION_QUICKSTART.md` - This file

## 📝 Files Modified

### Routes
- `Converso-backend/src/routes/index.ts` - Added sync routes
- `Converso-backend/src/routes/linkedinWebhook.routes.ts` - Updated webhook handler
- `Converso-backend/src/routes/linkedin.accounts.routes.ts` - Auto-triggers 4-action sync on connect

## ⚡ Quick Setup Steps

### 1. Run the Database Migration

```bash
# Apply the new migration to add tracking columns
cd Converso-frontend
npx supabase db push
```

Or manually run the SQL:
```sql
-- Run: Converso-frontend/supabase/migrations/20251208000008_add_sync_tracking_columns.sql
```

### 2. Restart Backend Server

```bash
cd Converso-backend
npm run dev
```

### 3. Verify Environment Variables

Make sure these are set in your `.env`:

```bash
UNIPILE_BASE_URL=https://api23.unipile.com:15315/api/v1
UNIPILE_API_KEY=your-api-key-here
UNIPILE_WEBHOOK_SECRET=optional-webhook-secret
```

## 🧪 Testing the Implementation

### Option A: Connect a New LinkedIn Account (Recommended)

1. Go to your app Settings page
2. Click "Connect LinkedIn Account"
3. Complete OAuth flow
4. **Automatic 4-action sync will start immediately!**

Monitor logs:
```bash
# You should see:
[Action 1] Starting chat download...
[Action 1] Found X chats
[Action 2] Starting sender enrichment...
[Action 2] Successfully enriched X conversations
[Action 3] Starting profile picture enrichment...
[Action 3] Successfully enriched X conversation pictures
[Action 4] Starting messages sync...
[Action 4] Successfully synced X messages
```

### Option B: Manual Full Sync (Existing Account)

```bash
# Replace YOUR_CONNECTED_ACCOUNT_ID with actual UUID
curl -X POST 'http://localhost:3001/api/linkedin/sync/full' \
  -H 'Content-Type: application/json' \
  -d '{"connectedAccountId":"YOUR_CONNECTED_ACCOUNT_ID"}'
```

### Option C: Test Individual Actions

```bash
# Get your connected account ID first
curl 'http://localhost:3001/api/linkedin/accounts?workspace_id=YOUR_WORKSPACE_ID'

# Then run actions one by one:

# 1. Download chats
curl -X POST 'http://localhost:3001/api/linkedin/sync/action1' \
  -H 'Content-Type: application/json' \
  -d '{"connectedAccountId":"YOUR_ID"}'

# 2. Enrich senders
curl -X POST 'http://localhost:3001/api/linkedin/sync/action2'

# 3. Enrich pictures
curl -X POST 'http://localhost:3001/api/linkedin/sync/action3'

# 4. Download messages
curl -X POST 'http://localhost:3001/api/linkedin/sync/action4' \
  -H 'Content-Type: application/json' \
  -d '{"connectedAccountId":"YOUR_ID"}'
```

## 📊 Check Sync Status

```bash
curl 'http://localhost:3001/api/linkedin/sync/status?connectedAccountId=YOUR_ID'
```

Expected response:
```json
{
  "total_conversations": 15,
  "messages_synced": 15,
  "senders_enriched": 15,
  "pictures_enriched": 15,
  "pending_messages": 0,
  "pending_senders": 0,
  "pending_pictures": 0,
  "last_synced_at": "2025-12-08T10:00:00Z",
  "sync_status": "success"
}
```

## 🔍 Verify Data in Database

### Check that conversations are synced

```sql
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN initial_sync_done THEN 1 ELSE 0 END) as synced,
  SUM(CASE WHEN sender_enriched THEN 1 ELSE 0 END) as enriched_senders,
  SUM(CASE WHEN picture_enriched THEN 1 ELSE 0 END) as enriched_pictures
FROM conversations
WHERE conversation_type = 'linkedin';
```

### **IMPORTANT: Verify NO null sender names**

```sql
-- This should return 0 rows!
SELECT COUNT(*) 
FROM messages
WHERE message_type = 'linkedin' 
  AND sender_name IS NULL;
```

### Check recent messages

```sql
SELECT 
  m.sender_name,
  m.content,
  m.is_from_lead,
  m.created_at,
  c.sender_name as conversation_sender
FROM messages m
JOIN conversations c ON m.conversation_id = c.id
WHERE m.message_type = 'linkedin'
ORDER BY m.created_at DESC
LIMIT 10;
```

## 🔔 Testing Webhooks

### 1. Configure Webhook URL in Unipile

Your webhook endpoint:
```
https://your-domain.com/api/linkedin/webhook
```

### 2. Test Locally (with ngrok or similar)

```bash
# Start ngrok
ngrok http 3001

# Use ngrok URL in Unipile webhook config
https://abc123.ngrok.io/api/linkedin/webhook
```

### 3. Send Test Message

1. Send a LinkedIn DM to your connected account
2. Check backend logs for:
```
[Webhook] Received event { type: 'message.created', chat_id: '...' }
[Webhook] Synced 1 messages for chat ...
```

### 4. Manual Webhook Test

```bash
curl -X POST 'http://localhost:3001/api/linkedin/webhook' \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "message.created",
    "chat_id": "YOUR_CHAT_ID",
    "account_id": "YOUR_UNIPILE_ACCOUNT_ID",
    "timestamp": "2025-12-08T10:00:00Z"
  }'
```

## 📋 API Endpoints Reference

### Sync Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/linkedin/sync/full` | POST | Run all 4 actions |
| `/api/linkedin/sync/action1` | POST | Download chats only |
| `/api/linkedin/sync/action2` | POST | Enrich senders only |
| `/api/linkedin/sync/action3` | POST | Enrich pictures only |
| `/api/linkedin/sync/action4` | POST | Download messages only |
| `/api/linkedin/sync/resume` | POST | Resume incomplete sync |
| `/api/linkedin/sync/status` | GET | Get sync status |

### Webhook Endpoint

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/linkedin/webhook` | POST | Receive Unipile webhooks |

## 🎯 Key Features

### ✅ Never Null Sender Names
- Messages from leads use conversation's cached sender data
- Messages from self use "You"
- Fallback to "LinkedIn Contact" if data missing

### ✅ Resumable Sync
- Each action tracks completion independently
- Can resume from where it left off
- `/api/linkedin/sync/resume` endpoint

### ✅ Rate Limit Handling
- Built-in rate limiter (60 req/min)
- Automatic retry on 429 errors
- Graceful degradation

### ✅ Efficient Caching
- Sender data cached in conversation table
- Webhook uses cached data (no repeated API calls)
- In-memory attendee cache for webhook

### ✅ Error Handling
- Graceful failures with fallbacks
- Detailed logging with action tags
- Never blocks entire sync on single failure

## 🐛 Troubleshooting

### Sync not starting
```bash
# Check connected account exists
curl 'http://localhost:3001/api/linkedin/accounts?workspace_id=YOUR_ID'

# Check backend logs
tail -f backend-logs.txt | grep "LinkedIn"
```

### Rate limit errors
```bash
# Wait 1 minute, then resume
curl -X POST 'http://localhost:3001/api/linkedin/sync/resume' \
  -d '{"connectedAccountId":"YOUR_ID"}'
```

### Webhook not working
```bash
# Check signature header (if using webhook secret)
# Verify webhook URL is publicly accessible
# Check Unipile webhook configuration

# Test without signature verification (temporarily remove UNIPILE_WEBHOOK_SECRET)
```

### Messages missing sender names
```bash
# This should NOT happen! Run verification query:
SELECT * FROM messages WHERE message_type='linkedin' AND sender_name IS NULL;

# If any found, run Action 4 again:
curl -X POST 'http://localhost:3001/api/linkedin/sync/action4' \
  -d '{"connectedAccountId":"YOUR_ID"}'
```

## 🎉 Success Criteria

Your implementation is working correctly if:

1. ✅ All 4 actions complete without errors
2. ✅ Conversations have `sender_name`, `sender_linkedin_url`
3. ✅ **Zero messages with null `sender_name`**
4. ✅ Pictures show in UI (or initials as fallback)
5. ✅ Webhooks sync new messages in real-time
6. ✅ Sync status shows all items complete

## 📚 Next Steps

1. **Monitor first sync** - Watch backend logs during initial sync
2. **Verify data** - Run SQL queries to check data quality
3. **Test webhook** - Send a LinkedIn DM and verify real-time sync
4. **Check UI** - Ensure LinkedIn inbox displays correctly
5. **Set up monitoring** - Track sync failures and rate limits

## 🔗 Related Documentation

- Full technical docs: `LINKEDIN_4ACTION_SYNC_DOCUMENTATION.md`
- Unipile API: Check your Integration Document
- Database schema: `20251208000008_add_sync_tracking_columns.sql`

## ⚠️ Important Notes

1. **LinkedIn login flow unchanged** - No changes to OAuth flow (as requested)
2. **Backward compatible** - Old sync service still available as fallback
3. **Production ready** - Includes rate limiting, error handling, logging
4. **Webhook optional** - Works with or without webhook secret

## 💡 Pro Tips

- Run Action 1 first to download all chats quickly
- Actions 2 and 3 can run in parallel (both enrich conversations)
- Action 4 should run last (requires sender data from Action 2)
- Use `/status` endpoint to monitor progress
- Use `/resume` endpoint if sync is interrupted
- Check logs for `[Action X]` tags to track progress

---

**Need help?** Check the full documentation in `LINKEDIN_4ACTION_SYNC_DOCUMENTATION.md`
