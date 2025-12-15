# 🚨 Quick Fix: LinkedIn Real-time Notifications Not Working

## The Problem
LinkedIn messages are not showing up in real-time. Webhook is returning **403 Forbidden**.

## Root Cause
**ngrok is forwarding to the WRONG PORT!**
- ❌ Currently: ngrok → port 8082 (Frontend)
- ✅ Should be: ngrok → port 3001 (Backend API)

## The Fix (3 Steps)

### Step 1: Stop Current ngrok
In terminal 36 (where ngrok is running):
```bash
Press Ctrl+C
```

### Step 2: Start ngrok on Correct Port
```bash
# Option A: Use the helper script
./start-webhook-tunnel.sh

# Option B: Run ngrok directly
ngrok http 3001
```

### Step 3: Update Webhook URL in Unipile
1. Copy the new ngrok HTTPS URL from terminal (e.g., `https://andreas-preartistic-airily.ngrok-free.app`)
2. Go to: https://dashboard.unipile.com
3. Navigate to: **Settings → Webhooks**
4. Update URL to: `https://your-ngrok-url.ngrok-free.app/api/linkedin/webhook`
5. Click **Save**

## Verify It's Working

### Test 1: Send a LinkedIn Message
Send a message to your connected LinkedIn account

### Test 2: Check Backend Logs
You should see:
```
[Webhook] Received event
[Webhook] Synced X messages for chat...
```

### Test 3: Check Frontend Console (F12)
You should see:
```
[SSE] Received linkedin_message event
```

### Test 4: Check UI
- Unread badge should appear on conversation avatar
- Clicking conversation should auto-refresh and show new message
- Conversation should be marked as read after clicking

## Quick Test Script
```bash
# Run automated tests
./test-webhook.sh
```

## Port Reference
| Service | Port | What It Does |
|---------|------|--------------|
| Backend API | 3001 | Handles webhooks, SSE, database |
| Frontend | 8082 | React UI (Vite dev server) |
| ngrok | → 3001 | **Must forward to Backend!** |

## Still Not Working?

### Issue: 403 Forbidden
- **Check**: Is ngrok forwarding to port 3001?
- **Fix**: Restart ngrok with `ngrok http 3001`

### Issue: Webhook works but no UI updates
- **Check**: Browser console for SSE connection
- **Fix**: Refresh browser page to reconnect SSE

### Issue: ngrok URL keeps changing
- **Cause**: Free ngrok tunnels get new URLs on restart
- **Fix**: Update webhook URL in Unipile each time
- **Alternative**: Upgrade to ngrok paid plan for static URLs

## Architecture Diagram
```
LinkedIn Message
    ↓
Unipile API
    ↓
Webhook → https://your-ngrok-url.ngrok-free.app/api/linkedin/webhook
    ↓
ngrok tunnel → http://localhost:3001 (Backend API) ✅
    ↓
Backend syncs messages & sends SSE event
    ↓
Frontend receives SSE → Updates UI with unread badge
```

## Files Created
- `LINKEDIN_WEBHOOK_FIX.md` - Detailed documentation
- `start-webhook-tunnel.sh` - Helper script to start ngrok
- `test-webhook.sh` - Automated test script
- `QUICK_FIX_LINKEDIN_NOTIFICATIONS.md` - This file

---

**TL;DR**: Stop ngrok, restart it with `ngrok http 3001`, update webhook URL in Unipile dashboard.
