# LinkedIn Webhook Fix - Real-time Notifications Not Working

## Problem Identified

The LinkedIn webhook notifications are not working because **ngrok is forwarding to the wrong port**.

### Current Setup (INCORRECT)
- Backend API running on: `http://localhost:3001`
- Frontend running on: `http://localhost:8082`
- **ngrok forwarding to: `http://localhost:8082`** ❌ (WRONG - this is the frontend!)
- Webhook requests hitting frontend → **403 Forbidden**

### Root Cause
When Unipile sends webhook events to your ngrok URL, they're being routed to the frontend (port 8082) instead of the backend API (port 3001). The frontend doesn't have the `/api/linkedin/webhook` endpoint, so it returns 403 Forbidden.

## Solution

### Step 1: Stop Current ngrok Tunnel
```bash
# Press Ctrl+C in the terminal running ngrok
```

### Step 2: Start ngrok on Correct Port
```bash
# Forward to backend API port (3001)
ngrok http 3001
```

### Step 3: Update Webhook URL in Unipile
1. Copy the new ngrok HTTPS URL (e.g., `https://your-subdomain.ngrok-free.app`)
2. Go to Unipile Dashboard: https://dashboard.unipile.com
3. Navigate to: **Settings → Webhooks**
4. Update webhook URL to: `https://your-subdomain.ngrok-free.app/api/linkedin/webhook`
5. Save changes

### Step 4: Test the Webhook
```bash
# Send a test LinkedIn message to verify webhook is working
# Check backend logs for:
[Webhook] Received event
[Webhook] Synced X messages for chat...
```

## How Real-time Updates Work

### Architecture
```
LinkedIn Message Sent
    ↓
Unipile receives message
    ↓
Unipile sends webhook → https://your-ngrok-url.ngrok-free.app/api/linkedin/webhook
    ↓
Backend receives webhook → /api/linkedin/webhook
    ↓
Backend syncs messages from Unipile API
    ↓
Backend sends SSE event → 'linkedin_message'
    ↓
Frontend receives SSE event → Updates UI in real-time
    ↓
Unread count badge appears on avatar
    ↓
Conversation auto-refreshes when clicked (WhatsApp style)
```

### Frontend Implementation (Already Working)

The frontend is already configured correctly in `LinkedInInbox.tsx`:

```typescript
// SSE Connection (lines 125-164)
useEffect(() => {
  const base = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const es = new EventSource(`${base}/api/events/stream`);

  const handler = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      console.log('[SSE] Received linkedin_message event:', data);
      
      if (data?.conversation_id) {
        bumpUnread(data.conversation_id);  // ← Increments unread count
        
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({
          predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'conversations',
        });
        
        queryClient.invalidateQueries({ 
          queryKey: ['messages', data.conversation_id] 
        });
      }
    } catch (err) {
      console.error('[SSE] Failed to parse event:', err);
    }
  };

  es.addEventListener('linkedin_message', handler);
  // ... cleanup
}, [bumpUnread, queryClient]);

// Unread Badge Display (lines 372-377)
<TabsTrigger value="unread">
  Unread
  {unreadCount > 0 && (
    <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold text-white bg-blue-600 rounded-full">
      {unreadCount}
    </span>
  )}
</TabsTrigger>

// WhatsApp-style Auto-refresh (lines 167-187)
const handleConversationClick = useCallback(
  async (conversationId: string) => {
    setSelectedConversation(conversationId);

    // Mark as read
    const conv = normalizedConversations.find((c) => c.id === conversationId);
    if (conv && !conv.isRead) {
      markReadLocally(conversationId);
      toggleRead.mutate({ conversationId, isRead: true });
    }

    // Force-refresh messages (WhatsApp-style)
    await queryClient.invalidateQueries({ 
      queryKey: ['messages', conversationId] 
    });
  },
  [markReadLocally, normalizedConversations, queryClient, toggleRead]
);
```

### Backend Webhook Handler (Already Working)

The backend webhook handler in `linkedinWebhook.4actions.ts` is also correctly implemented:

```typescript
// Main webhook handler (line 588)
export async function handleLinkedInWebhook(req: Request, res: Response) {
  const event = req.body as WebhookEvent;
  const chatId = event.chat_id || event.message?.chat_id;
  const accountId = event.account_id || event.message?.account_id;

  // Find connected account
  // Ensure conversation exists
  // Sync messages incrementally
  const syncedCount = await syncChatMessages(
    chatId,
    accountId,
    conversationId,
    senderName,
    senderLinkedinUrl,
    senderAttendeeId,
    event.last_message_timestamp || event.timestamp
  );

  // Send SSE event to frontend
  if (syncedCount > 0) {
    sendSseEvent('linkedin_message', {
      chat_id: chatId,
      account_id: accountId,
      conversation_id: conversationId,
      timestamp: event.timestamp || new Date().toISOString(),
    });
  }

  return res.json({ status: 'ok' });
}
```

## Verification Checklist

After fixing ngrok port:

- [ ] ngrok is running on port 3001 (backend)
- [ ] Webhook URL updated in Unipile dashboard
- [ ] Backend logs show `[Webhook] Received event` when message arrives
- [ ] Frontend console shows `[SSE] Received linkedin_message event`
- [ ] Unread badge appears on conversation avatar
- [ ] Clicking conversation auto-refreshes and shows new message
- [ ] Conversation marked as read after clicking

## Common Issues

### Issue 1: Still Getting 403 Forbidden
- **Cause**: Webhook URL still pointing to old ngrok URL or wrong port
- **Fix**: Update webhook URL in Unipile dashboard with new ngrok URL

### Issue 2: Webhook works but no SSE events
- **Cause**: SSE connection not established or closed
- **Fix**: Check browser console for SSE connection errors
- **Check**: `EventSource` connection to `/api/events/stream`

### Issue 3: Unread count not updating
- **Cause**: SSE event received but query cache not invalidating
- **Fix**: Check browser console for `[SSE] Received linkedin_message event`
- **Verify**: `bumpUnread()` function is being called

### Issue 4: ngrok tunnel expires
- **Cause**: Free ngrok tunnels expire after 2 hours
- **Fix**: Restart ngrok and update webhook URL in Unipile
- **Alternative**: Use ngrok paid plan for persistent URLs

## Environment Variables

Ensure these are set correctly:

```bash
# Backend (.env)
PORT=3001
UNIPILE_API_KEY=your_unipile_api_key
UNIPILE_API_URL=https://api.unipile.com:13443
UNIPILE_WEBHOOK_SECRET=your_webhook_secret (optional)

# Frontend (.env)
VITE_API_URL=http://localhost:3001
```

## Testing the Fix

### 1. Manual Test
```bash
# Send a test webhook from terminal
curl -X POST http://localhost:3001/api/linkedin/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "type": "message.received",
    "chat_id": "test-chat-id",
    "account_id": "test-account-id",
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
  }'
```

### 2. Live Test
1. Send a LinkedIn message to your connected account
2. Watch backend logs for webhook event
3. Watch frontend console for SSE event
4. Verify unread badge appears
5. Click conversation and verify auto-refresh

## Quick Reference

| Service | Port | URL |
|---------|------|-----|
| Backend API | 3001 | http://localhost:3001 |
| Frontend | 8082 | http://localhost:8082 |
| ngrok (should forward to) | → 3001 | https://xxx.ngrok-free.app → http://localhost:3001 |
| Webhook endpoint | - | https://xxx.ngrok-free.app/api/linkedin/webhook |
| SSE endpoint | - | http://localhost:3001/api/events/stream |

## Next Steps

1. **Stop current ngrok** (Ctrl+C in terminal 36)
2. **Start ngrok on port 3001**: `ngrok http 3001`
3. **Copy new ngrok URL** from terminal output
4. **Update Unipile webhook** with new URL + `/api/linkedin/webhook`
5. **Test with a LinkedIn message**
6. **Verify unread badge and auto-refresh work**

---

**Status**: Ready to fix - just need to restart ngrok on correct port!
