# LinkedIn Sync - Complete Guide

## 🔧 Webhook Configuration

### Your Current Setup
- **Webhook URL:** `http://localhost:3001/api/unipile/webhook`
- **Events:** On new message, On message read, On message reaction, On message edit, On message delete, On message delivered

### ⚠️ IMPORTANT: Localhost Won't Work!

Unipile's servers cannot reach `localhost`. You need a **public URL**.

#### Option 1: Use ngrok (for development)
```bash
# Install ngrok
brew install ngrok

# Start tunnel
ngrok http 3001

# You'll get a URL like: https://abc123.ngrok.io
# Update Unipile webhook to: https://abc123.ngrok.io/api/unipile/webhook
```

#### Option 2: Deploy to production
Use your production domain:
```
https://your-backend.vercel.app/api/unipile/webhook
```

---

## 📊 Sync Architecture

### How Data Flows:

```
┌─────────────────┐     Webhook      ┌─────────────────┐
│   Unipile API   │ ───────────────► │  Your Backend   │
│  (LinkedIn DMs) │                  │  /api/unipile/  │
└─────────────────┘                  │     webhook     │
                                     └────────┬────────┘
                                              │
                                              ▼
                                     ┌─────────────────┐
                                     │    Supabase     │
                                     │  conversations  │
                                     │    messages     │
                                     └─────────────────┘
```

### Sync Methods:

| Method | When | What |
|--------|------|------|
| **Initial Sync** | Account connect | Downloads last 30 days of chats + messages |
| **Webhook** | Real-time | Instant updates when messages arrive |
| **Polling** | Every 15-30s | Fallback when webhook fails |

---

## 🛠️ Fix Existing "LinkedIn Contact" Names

### Step 1: Restart Backend
```bash
cd Converso-backend
npm run dev
```

### Step 2: Run Name Fix
```bash
curl -X POST "http://localhost:3001/api/linkedin/fix/names" \
  -H "Content-Type: application/json"
```

### Step 3: Download Missing Messages
First get your ID from Supabase:
```sql
SELECT id FROM connected_accounts WHERE account_type = 'linkedin' LIMIT 1;
```

Then:
```bash
curl -X POST "http://localhost:3001/api/linkedin/fix/messages" \
  -H "Content-Type: application/json" \
  -d '{"connectedAccountId": "YOUR_ID_HERE"}'
```

### Step 4: Refresh Browser
```
Cmd + Shift + R
```

---

## 📁 Files Reference

| File | Purpose |
|------|---------|
| `routes/unipile.webhook.routes.ts` | Webhook handler for `/api/unipile/webhook` |
| `routes/linkedin.fix.routes.ts` | One-time fix endpoints |
| `routes/linkedin.sync.routes.ts` | Manual sync endpoints |
| `unipile/linkedinSync.4actions.ts` | Core sync logic (4 actions) |

---

## 🔍 Webhook Events Handled

| Event | Action |
|-------|--------|
| `message_received` | Creates/updates message + conversation |
| `message_delivered` | Updates delivery status |
| `message_read` | Updates read status |
| `message_reaction` | Updates reactions |
| `message_edit` | Updates message content |
| `message_delete` | Marks message as deleted |

---

## 🔄 Trigger Manual Sync

### Full Sync (all 4 actions):
```bash
curl -X POST "http://localhost:3001/api/linkedin/sync/full" \
  -H "Content-Type: application/json" \
  -d '{"connectedAccountId": "YOUR_ID", "days": 30}'
```

### Individual Actions:
```bash
# Action 1: Download chats
curl -X POST "http://localhost:3001/api/linkedin/sync/action1" \
  -H "Content-Type: application/json" \
  -d '{"connectedAccountId": "YOUR_ID"}'

# Action 2: Enrich names
curl -X POST "http://localhost:3001/api/linkedin/sync/action2" \
  -H "Content-Type: application/json"

# Action 3: Enrich pictures
curl -X POST "http://localhost:3001/api/linkedin/sync/action3" \
  -H "Content-Type: application/json"

# Action 4: Download messages
curl -X POST "http://localhost:3001/api/linkedin/sync/action4" \
  -H "Content-Type: application/json" \
  -d '{"connectedAccountId": "YOUR_ID"}'
```

---

## ✅ Checklist

- [ ] Backend restarted with new routes
- [ ] Run `/api/linkedin/fix/names` to fix existing names
- [ ] Run `/api/linkedin/fix/messages` to download missing messages
- [ ] Set up ngrok or deploy to production for webhook
- [ ] Update Unipile webhook URL to public URL
- [ ] Test by sending a message on LinkedIn
