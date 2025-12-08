# LinkedIn 4-Action Sync - Quick Reference Card

## 🚀 Quick Start (3 Steps)

```bash
# 1. Run migration
cd Converso-frontend && npx supabase db push

# 2. Restart backend
cd Converso-backend && npm run dev

# 3. Connect LinkedIn account (via UI Settings page)
# → Automatic sync starts immediately!
```

---

## 📡 API Endpoints Cheat Sheet

```bash
# Full sync (all 4 actions)
POST /api/linkedin/sync/full
{"connectedAccountId":"YOUR_UUID"}

# Check status
GET /api/linkedin/sync/status?connectedAccountId=YOUR_UUID

# Resume interrupted sync
POST /api/linkedin/sync/resume
{"connectedAccountId":"YOUR_UUID"}

# Individual actions
POST /api/linkedin/sync/action1  # Download chats
POST /api/linkedin/sync/action2  # Enrich senders
POST /api/linkedin/sync/action3  # Enrich pictures
POST /api/linkedin/sync/action4  # Download messages
```

---

## 🔍 Essential SQL Queries

```sql
-- Check sync progress
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN initial_sync_done THEN 1 ELSE 0 END) as synced,
  SUM(CASE WHEN sender_enriched THEN 1 ELSE 0 END) as enriched
FROM conversations WHERE conversation_type = 'linkedin';

-- CRITICAL: Verify no null sender names (should be 0!)
SELECT COUNT(*) FROM messages 
WHERE message_type = 'linkedin' AND sender_name IS NULL;

-- View recent messages
SELECT sender_name, content, created_at 
FROM messages 
WHERE message_type = 'linkedin' 
ORDER BY created_at DESC LIMIT 10;
```

---

## 🐛 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Sync not starting | Check backend logs: `grep "Action" logs.txt` |
| Rate limit error | Wait 1 min, then: `POST /api/linkedin/sync/resume` |
| Null sender names | Re-run: `POST /api/linkedin/sync/action4` |
| Webhook not working | Check `UNIPILE_WEBHOOK_SECRET` and URL accessibility |

---

## 📊 Backend Log Tags

```bash
# Monitor sync progress
tail -f backend.log | grep "\[Action"

# You'll see:
[Action 1] Starting chat download...
[Action 2] Starting sender enrichment...
[Action 3] Starting profile picture enrichment...
[Action 4] Starting messages sync...
```

---

## ✅ Success Checklist

- [ ] Migration applied
- [ ] Backend restarted
- [ ] Account connected
- [ ] All 4 actions completed (check logs)
- [ ] Zero null sender names (SQL query)
- [ ] Sync status shows 0 pending
- [ ] UI displays conversations
- [ ] Webhook receives events

---

## 📞 Test Script

```bash
# Interactive test script
./test-linkedin-4action-sync.sh

# Set environment variables first:
export WORKSPACE_ID="your-workspace-uuid"
export CONNECTED_ACCOUNT_ID="your-account-uuid"
```

---

## 🔗 Documentation Files

| File | Purpose |
|------|---------|
| `IMPLEMENTATION_SUMMARY_4ACTION_SYNC.md` | Overview & next steps |
| `LINKEDIN_4ACTION_QUICKSTART.md` | Detailed testing guide |
| `LINKEDIN_4ACTION_SYNC_DOCUMENTATION.md` | Complete technical docs |
| `QUICK_REFERENCE_4ACTION.md` | This cheat sheet |

---

## 🎯 The 4 Actions Explained

1. **Action 1** → Download all chats (creates conversations)
2. **Action 2** → Fetch sender names & LinkedIn URLs
3. **Action 3** → Fetch profile pictures (or use initials)
4. **Action 4** → Download all messages (uses cached sender data)

**Key Point:** sender_name is NEVER null! 
- Lead messages → use cached conversation sender data
- Self messages → use "You"
- Fallback → "LinkedIn Contact"

---

## 🌐 Webhook Configuration

```bash
# Webhook URL format
https://your-domain.com/api/linkedin/webhook

# For local testing with ngrok
ngrok http 3001
# Use: https://abc123.ngrok.io/api/linkedin/webhook

# Environment variable
UNIPILE_WEBHOOK_SECRET=your-secret-here
```

---

## 💻 Quick cURL Examples

```bash
# Get your connected account ID
curl "http://localhost:3001/api/linkedin/accounts?workspace_id=YOUR_WORKSPACE"

# Run full sync
curl -X POST "http://localhost:3001/api/linkedin/sync/full" \
  -H "Content-Type: application/json" \
  -d '{"connectedAccountId":"YOUR_UUID"}'

# Check status
curl "http://localhost:3001/api/linkedin/sync/status?connectedAccountId=YOUR_UUID"

# Test webhook
curl -X POST "http://localhost:3001/api/linkedin/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "message.created",
    "chat_id": "urn:li:fs_conversation:123",
    "account_id": "YOUR_UNIPILE_ACCOUNT_ID"
  }'
```

---

## 🎨 Database Schema Quick Ref

### conversations table (new columns)
- `initial_sync_done: BOOLEAN`
- `sender_enriched: BOOLEAN`
- `picture_enriched: BOOLEAN`
- `sender_attendee_id: TEXT`
- `chat_id: TEXT` (unique)

### messages table (new columns)
- `message_type: TEXT`
- `linkedin_message_id: TEXT` (unique)
- `sender_attendee_id: TEXT`

---

## ⚡ Pro Tips

1. **Run Action 1 first** - Downloads all chats quickly
2. **Actions 2 & 3 can run in parallel** - Both enrich conversations
3. **Action 4 runs last** - Needs sender data from Action 2
4. **Use /status endpoint** - Monitor progress
5. **Use /resume endpoint** - If sync interrupted
6. **Check logs with grep** - `grep "\[Action" backend.log`

---

## 🎯 Most Important Command

```bash
# Verify NO null sender names (should return 0)
SELECT COUNT(*) FROM messages 
WHERE message_type = 'linkedin' AND sender_name IS NULL;
```

**If this returns 0, your implementation is working correctly! 🎉**

---

**Ready?** Run the migration and restart your backend!

**Need details?** See `LINKEDIN_4ACTION_QUICKSTART.md`

**Need help?** See `LINKEDIN_4ACTION_SYNC_DOCUMENTATION.md`
