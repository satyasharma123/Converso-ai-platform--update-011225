# Test SSE Real-Time Notifications

## Problem Identified

**Root Cause:** Unipile webhooks cannot reach `localhost:3001` - they need a publicly accessible URL.

**Current State:**
- ✅ SSE connection established (`[SSE] Connection established` in console)
- ✅ Polling works (updates every 5 seconds)
- ❌ Real-time webhook events not received (Unipile can't reach localhost)
- ❌ No `linkedin_message` SSE events emitted

## Solution 1: Test SSE Flow Locally (Without Unipile)

### Step 1: Restart Backend
The backend has been updated with a test endpoint. Restart it:
```bash
cd Converso-backend
npm run dev
```

### Step 2: Open Browser Console
Navigate to: `http://localhost:8082/inbox/linkedin`

You should see:
```
[SSE] Connection established
```

### Step 3: Simulate Webhook Event
In a new terminal, run:
```bash
curl -X POST http://localhost:3001/api/test/simulate-linkedin-message \
  -H "Content-Type: application/json" \
  -d '{"conversation_id": "3b0b8b5b-f0ff-1279-8c2e-a6d070e67887"}'
```

### Step 4: Verify in Browser Console
You should immediately see:
```
[SSE] Received linkedin_message event: {conversation_id: "3b0b8b5b-f0ff-1279-8c2e-a6d070e67887", ...}
```

And the chat should:
- ✅ Become unread (blue background)
- ✅ Show unread badge on avatar
- ✅ Move to top of list
- ✅ No manual refresh needed

---

## Solution 2: Enable Real Webhooks (Production Setup)

### Option A: Use ngrok (Recommended for Development)

1. **Start ngrok tunnel:**
   ```bash
   ngrok http 3001
   ```

2. **Copy the public URL** (e.g., `https://abc123.ngrok-free.app`)

3. **Update Unipile webhook:**
   - Go to: https://app.unipile.com
   - Navigate to: Settings → Webhooks
   - Set webhook URL to: `https://your-ngrok-url.ngrok-free.app/api/unipile/webhook`
   - Save

4. **Test with real LinkedIn message:**
   - Send a message from another LinkedIn account
   - Should appear instantly in your inbox (no refresh)

### Option B: Deploy Backend to Production

1. Deploy backend to a cloud service (Railway, Render, Heroku, etc.)
2. Get public URL (e.g., `https://converso-backend.railway.app`)
3. Update Unipile webhook URL to: `https://your-domain.com/api/unipile/webhook`

---

## Verification Checklist

### SSE Connection
- [ ] Browser console shows: `[SSE] Connection established`
- [ ] Network tab shows: `GET /api/events/stream` with status `200` (pending)

### Test Endpoint
- [ ] `POST /api/test/simulate-linkedin-message` returns success
- [ ] Browser console shows: `[SSE] Received linkedin_message event`
- [ ] Chat becomes unread immediately

### Real Webhooks (After ngrok/deployment)
- [ ] Send LinkedIn message from another account
- [ ] Backend logs show: `[Webhook] Received event`
- [ ] Backend logs show: `[Webhook] Synced X messages`
- [ ] SSE event emitted
- [ ] Frontend updates instantly

---

## Current Implementation Status

✅ **Completed:**
- SSE server setup (`/api/events/stream`)
- SSE client connection in frontend
- Event emission on webhook receive
- Event emission on manual sync
- Optimistic unread bump
- Query invalidation on SSE event
- Console logging for debugging

❌ **Missing:**
- Public webhook URL (localhost not accessible from Unipile)

---

## Quick Test Command

```bash
# Terminal 1: Backend should be running
cd Converso-backend && npm run dev

# Terminal 2: Simulate webhook
curl -X POST http://localhost:3001/api/test/simulate-linkedin-message \
  -H "Content-Type: application/json" \
  -d '{"conversation_id": "3b0b8b5b-f0ff-1279-8c2e-a6d070e67887"}'

# Expected: Browser console shows SSE event + chat becomes unread
```

---

## Next Steps

1. **Immediate:** Test SSE flow with simulate endpoint (verify code works)
2. **Short-term:** Set up ngrok for development testing
3. **Long-term:** Deploy backend to production with public URL
