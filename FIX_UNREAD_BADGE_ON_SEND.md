# Fix: Unread Badge Appearing When Sending Messages

## 🐛 Problem

When you send a reply message in the LinkedIn inbox, the unread badge briefly appears for a few seconds before disappearing. This creates a confusing user experience.

### Why It Happened

1. You send a message → Backend inserts it into database
2. Backend sends SSE event: `linkedin_message`
3. Frontend receives SSE event
4. Frontend calls `bumpUnread()` → Badge appears ❌
5. Frontend refetches data from backend
6. Backend returns correct `unread_count = 0`
7. Badge disappears

**The issue**: Frontend was bumping unread count for ALL messages, including your own replies.

## ✅ Solution

Added `is_from_lead` flag to SSE events so frontend knows whether to bump unread count.

### Logic
```typescript
// Frontend SSE handler
if (data.is_from_lead !== false) {
  // Only bump if message is from lead (not from you)
  bumpUnread(data.conversation_id);
}

// Always refresh data (for both lead and your messages)
queryClient.invalidateQueries(['conversations']);
```

## 🔧 Changes Made

### 1. Backend: Send Message Route
**File**: `Converso-backend/src/routes/linkedin.messages.routes.ts`

**Change**:
```typescript
sendSseEvent('linkedin_message', {
  chat_id,
  account_id,
  conversation_id: conversationId,
  timestamp: responseMessage.created_at || createdAt,
  is_from_lead: responseMessage.is_from_lead || false, // ← NEW
});
```

**Why**: When you send a message, `is_from_lead` is `false`, so frontend won't bump unread count.

### 2. Backend: Webhook Handler
**File**: `Converso-backend/src/unipile/linkedinWebhook.4actions.ts`

**Change**:
```typescript
// Get the latest message to check if it's from lead
const { data: latestMsg } = await supabaseAdmin
  .from('messages')
  .select('is_from_lead')
  .eq('conversation_id', conversationId)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();

sendSseEvent('linkedin_message', {
  chat_id: chatId,
  account_id: accountId,
  conversation_id: conversationId,
  timestamp: event.timestamp || new Date().toISOString(),
  is_from_lead: latestMsg?.is_from_lead ?? true, // ← NEW
});
```

**Why**: When webhook receives a message from the lead, `is_from_lead` is `true`, so frontend will bump unread count.

### 3. Backend: Conversation Sync Route
**File**: `Converso-backend/src/routes/conversations.routes.ts`

**Change**:
```typescript
// Get the latest message to check if it's from lead
const { data: latestMsg } = await supabaseAdmin
  .from('messages')
  .select('is_from_lead')
  .eq('conversation_id', id)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();

sendSseEvent('linkedin_message', {
  conversation_id: id,
  chat_id: conversation.chat_id,
  account_id: account.unipile_account_id,
  timestamp: new Date().toISOString(),
  is_from_lead: latestMsg?.is_from_lead ?? true, // ← NEW
});
```

**Why**: Manual sync should also respect whether the latest message is from lead.

### 4. Frontend: SSE Event Handler
**File**: `Converso-frontend/src/pages/LinkedInInbox.tsx`

**Change**:
```typescript
const handler = (event: MessageEvent) => {
  try {
    const data = JSON.parse(event.data);
    console.log('[SSE] Received linkedin_message event:', data);
    
    if (data?.conversation_id) {
      // Only bump unread count if the message is from the lead
      if (data.is_from_lead !== false) {  // ← NEW CHECK
        bumpUnread(data.conversation_id);
      }
      
      // Always invalidate queries to refresh UI
      queryClient.invalidateQueries({
        predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'conversations',
      });
      
      queryClient.invalidateQueries({ queryKey: ['messages', data.conversation_id] });
    }
  } catch (err) {
    console.error('[SSE] Failed to parse event:', err);
  }
};
```

**Why**: Frontend now checks `is_from_lead` before bumping unread count.

## 🎨 Behavior

### Before Fix
```
You: "Hello Ruhi"
  ↓
Badge appears: 🔵 1  ← Wrong!
  ↓
(2 seconds later)
  ↓
Badge disappears
```

### After Fix
```
You: "Hello Ruhi"
  ↓
No badge appears ✅
  ↓
Message shows in conversation
  ↓
Conversation updates (no unread indicator)
```

### When Lead Replies
```
Lead: "Hello Satya"
  ↓
Badge appears: 🔵 1  ← Correct!
  ↓
Badge stays until you click conversation
```

## 🧪 Testing

### Test 1: Send Your Own Message
1. Open LinkedIn inbox
2. Send a reply to any conversation
3. **Expected**: No unread badge appears
4. **Expected**: Message appears in conversation
5. **Expected**: Conversation updates to top of list

### Test 2: Receive Message from Lead
1. Have someone send you a LinkedIn message
2. **Expected**: Unread badge appears immediately
3. **Expected**: Badge shows correct count
4. **Expected**: Badge disappears when you click conversation

### Test 3: Multiple Messages
1. Send 2 of your own messages
2. **Expected**: No badges appear
3. Receive 3 messages from lead
4. **Expected**: Badge shows "3"
5. Send 1 more of your own message
6. **Expected**: Badge still shows "3" (doesn't increment)

## 🔍 Debugging

### Check SSE Events in Console
```javascript
// Open browser console (F12)
// You should see:

// When you send:
[SSE] Received linkedin_message event: {
  conversation_id: "...",
  is_from_lead: false  // ← Should be false
}

// When lead sends:
[SSE] Received linkedin_message event: {
  conversation_id: "...",
  is_from_lead: true   // ← Should be true
}
```

### Check Backend Logs
```bash
# When you send message:
[LinkedIn] send-message completed
# SSE event sent with is_from_lead: false

# When webhook receives message:
[Webhook] Synced X messages for chat...
# SSE event sent with is_from_lead: true
```

### Verify Database
```sql
-- Check messages
SELECT 
  id,
  content,
  is_from_lead,
  sender_name,
  created_at
FROM messages
WHERE conversation_id = 'conversation-id-here'
ORDER BY created_at DESC
LIMIT 10;

-- Your messages should have:
-- is_from_lead = false
-- sender_name = 'You'

-- Lead messages should have:
-- is_from_lead = true
-- sender_name = 'Ruhi Sharma' (or lead's name)
```

## 🐛 Troubleshooting

### Issue: Badge Still Appears When Sending
**Symptoms**: Badge briefly shows when you send a message

**Causes**:
- Backend not sending `is_from_lead` flag
- Frontend not checking the flag
- Cached old code in browser

**Solutions**:
```bash
# 1. Restart backend
cd Converso-backend && npm run dev

# 2. Hard refresh browser
# Mac: Cmd+Shift+R
# Windows: Ctrl+Shift+R

# 3. Check console for SSE events
# Should show is_from_lead: false for your messages
```

### Issue: Badge Doesn't Appear for Lead Messages
**Symptoms**: No badge when lead sends message

**Causes**:
- `is_from_lead` incorrectly set to `false`
- Message attribution wrong in database
- SSE event not firing

**Solutions**:
```sql
-- Check message attribution
SELECT 
  content,
  is_from_lead,
  sender_name,
  sender_attendee_id
FROM messages
WHERE conversation_id = 'conversation-id-here'
ORDER BY created_at DESC
LIMIT 5;

-- If is_from_lead is wrong, fix it:
UPDATE messages
SET is_from_lead = true
WHERE conversation_id = 'conversation-id-here'
AND sender_name != 'You';
```

### Issue: Backwards Compatibility
**Symptoms**: Old SSE events without `is_from_lead` flag

**Solution**: The code handles this gracefully:
```typescript
if (data.is_from_lead !== false) {
  // If undefined or true, bump unread
  // This maintains backwards compatibility
  bumpUnread(data.conversation_id);
}
```

## 📊 SSE Event Schema

### New Schema (After Fix)
```typescript
{
  chat_id: string;
  account_id: string;
  conversation_id: string;
  timestamp: string;
  is_from_lead: boolean;  // ← NEW FIELD
}
```

### Field Meanings
- `is_from_lead: true` → Message from lead (bump unread)
- `is_from_lead: false` → Message from you (don't bump unread)
- `is_from_lead: undefined` → Legacy event (bump unread for safety)

## ✅ Verification Checklist

After deploying:

- [ ] Backend restarted
- [ ] Frontend hard refreshed
- [ ] Send your own message → No badge appears
- [ ] Receive lead message → Badge appears
- [ ] Badge shows correct count
- [ ] Badge disappears when clicked
- [ ] Console shows `is_from_lead` in SSE events
- [ ] No errors in backend logs
- [ ] No errors in browser console

## 🎯 Benefits

### Before
- ❌ Badge appears when you send messages
- ❌ Confusing user experience
- ❌ Looks like a bug

### After
- ✅ Badge only appears for lead messages
- ✅ Clear, intuitive behavior
- ✅ Professional UX (like WhatsApp, Slack, etc.)
- ✅ No false notifications

## 📈 Impact

- **User Experience**: High improvement
- **Code Changes**: Minimal (4 files)
- **Risk**: Very low (backwards compatible)
- **Testing**: Easy to verify

---

**Status**: ✅ Fixed and ready to test
**Breaking Changes**: None (backwards compatible)
**Deployment**: Just restart backend and refresh frontend
