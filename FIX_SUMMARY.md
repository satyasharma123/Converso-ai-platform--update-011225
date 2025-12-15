# LinkedIn Real-time Notifications - Fix Summary

## 🎯 Problem Identified

Your LinkedIn real-time notifications stopped working because **ngrok is tunneling to the wrong port**.

### Current Setup (BROKEN ❌)
```
Unipile Webhook
    ↓
https://andreas-preartistic-airily.ngrok-free.app/api/linkedin/webhook
    ↓
ngrok forwards to → http://localhost:8082 ❌ (FRONTEND - Vite dev server)
    ↓
Frontend doesn't have /api/linkedin/webhook endpoint
    ↓
Result: 403 Forbidden
```

### Correct Setup (WORKING ✅)
```
Unipile Webhook
    ↓
https://your-new-ngrok-url.ngrok-free.app/api/linkedin/webhook
    ↓
ngrok forwards to → http://localhost:3001 ✅ (BACKEND API)
    ↓
Backend receives webhook → syncs messages → sends SSE event
    ↓
Frontend receives SSE → updates UI with unread badge
    ↓
Result: Real-time notifications work!
```

## 🔧 The Fix (Takes 2 Minutes)

### Action 1: Stop Current ngrok
**Terminal 36** (currently running `ngrok http 8082`):
```bash
Press: Ctrl+C
```

### Action 2: Start ngrok on Correct Port
**Terminal 36** (same terminal):
```bash
ngrok http 3001
```

Or use the helper script:
```bash
./start-webhook-tunnel.sh
```

### Action 3: Copy New ngrok URL
From the ngrok terminal output, copy the HTTPS URL:
```
Forwarding    https://your-new-subdomain.ngrok-free.app -> http://localhost:3001
              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
              Copy this URL
```

### Action 4: Update Unipile Webhook
1. Go to: **https://dashboard.unipile.com**
2. Navigate to: **Settings → Webhooks**
3. Update webhook URL to:
   ```
   https://your-new-subdomain.ngrok-free.app/api/linkedin/webhook
   ```
4. Click **Save**

### Action 5: Test It
1. Send a LinkedIn message to your connected account
2. Watch for:
   - Backend logs: `[Webhook] Received event`
   - Frontend console (F12): `[SSE] Received linkedin_message event`
   - UI: Unread badge appears on conversation avatar
   - Click conversation: Auto-refreshes and shows new message

## 📊 Verification Checklist

After completing the fix:

- [ ] ngrok is running on port 3001 (not 8082)
- [ ] ngrok shows: `Forwarding https://xxx.ngrok-free.app -> http://localhost:3001`
- [ ] Webhook URL updated in Unipile dashboard
- [ ] Test message sent via LinkedIn
- [ ] Backend logs show: `[Webhook] Received event`
- [ ] Frontend console shows: `[SSE] Received linkedin_message event`
- [ ] Unread badge appears on conversation
- [ ] Clicking conversation auto-refreshes messages
- [ ] Conversation marked as read after clicking

## 🎨 How It Works (Architecture)

### Real-time Flow
```
1. LinkedIn Message Sent
   ↓
2. Unipile receives message
   ↓
3. Unipile sends webhook → your ngrok URL
   ↓
4. ngrok forwards → Backend (port 3001)
   ↓
5. Backend handler (/api/linkedin/webhook):
   - Finds connected account
   - Syncs messages from Unipile API
   - Marks conversation as unread
   - Sends SSE event: 'linkedin_message'
   ↓
6. Frontend (EventSource listener):
   - Receives SSE event
   - Increments unread count
   - Invalidates React Query cache
   - UI updates with badge
   ↓
7. User clicks conversation:
   - Auto-refreshes messages
   - Marks as read
   - Badge disappears
```

### Components Already Working ✅

**Frontend** (`LinkedInInbox.tsx`):
- ✅ SSE connection to `/api/events/stream`
- ✅ Event listener for `linkedin_message`
- ✅ Unread count badge display
- ✅ Auto-refresh on conversation click
- ✅ Mark as read functionality

**Backend** (`linkedinWebhook.4actions.ts`):
- ✅ Webhook handler at `/api/linkedin/webhook`
- ✅ Message sync from Unipile
- ✅ SSE event broadcasting
- ✅ Conversation unread state management

**Only Issue**: ngrok pointing to wrong port! 🎯

## 🛠️ Helper Scripts Created

### 1. Start Webhook Tunnel
```bash
./start-webhook-tunnel.sh
```
Starts ngrok on port 3001 with helpful instructions.

### 2. Test Webhook
```bash
./test-webhook.sh
```
Runs automated tests to verify:
- Backend is running
- Webhook endpoint is accessible
- SSE endpoint is working
- ngrok tunnel is active
- End-to-end webhook flow

## 📝 Port Reference

| Service | Port | Status | Purpose |
|---------|------|--------|---------|
| Backend API | 3001 | ✅ Running | Webhooks, SSE, Database |
| Frontend | 8082 | ✅ Running | React UI (Vite) |
| **ngrok (current)** | **→ 8082** | **❌ WRONG** | **Forwarding to frontend** |
| **ngrok (should be)** | **→ 3001** | **✅ CORRECT** | **Should forward to backend** |

## 🐛 Common Issues & Solutions

### Issue: Still getting 403 Forbidden
**Cause**: Webhook URL not updated in Unipile
**Fix**: Update webhook URL in Unipile dashboard with new ngrok URL

### Issue: Webhook works but no UI updates
**Cause**: SSE connection not established
**Fix**: 
1. Check browser console for SSE errors
2. Refresh browser to reconnect
3. Verify backend is sending SSE events

### Issue: ngrok URL keeps changing
**Cause**: Free ngrok tunnels get new URLs on restart
**Fix**: 
- Update webhook URL in Unipile each time
- Consider ngrok paid plan for static URLs

### Issue: Unread count not updating
**Cause**: React Query cache not invalidating
**Fix**: Check browser console for `[SSE] Received linkedin_message event`

## 📚 Documentation Files

1. **QUICK_FIX_LINKEDIN_NOTIFICATIONS.md** - Quick reference (this file)
2. **LINKEDIN_WEBHOOK_FIX.md** - Detailed technical documentation
3. **start-webhook-tunnel.sh** - Helper script to start ngrok
4. **test-webhook.sh** - Automated test suite
5. **FIX_SUMMARY.md** - Executive summary

## 🎬 Next Steps

1. **Stop ngrok** in terminal 36 (Ctrl+C)
2. **Restart ngrok** with: `ngrok http 3001`
3. **Copy new URL** from ngrok output
4. **Update Unipile** webhook with new URL + `/api/linkedin/webhook`
5. **Test** by sending a LinkedIn message
6. **Verify** unread badge and auto-refresh work

---

## 💡 Why This Happened

The ngrok command was likely started with `ngrok http 8082` (frontend port) instead of `ngrok http 3001` (backend port). This is an easy mistake because:
- Frontend runs on 8082 (visible in browser)
- Backend runs on 3001 (not visible, works behind the scenes)
- Both are running simultaneously

The fix is simple: just restart ngrok on the correct port! 🚀

---

**Status**: ✅ Issue identified, solution documented, ready to fix!
**Time to fix**: ~2 minutes
**Difficulty**: Easy - just restart ngrok on correct port
