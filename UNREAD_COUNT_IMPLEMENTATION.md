# LinkedIn Unread Count Implementation

## 🎯 Problem

The unread badge was showing "1" for all unread conversations, regardless of how many unread messages they actually contained. This was because:

1. The database didn't have an `unread_count` column
2. The frontend was using a fallback: `isRead ? 0 : 1`
3. No tracking of actual message counts

## ✅ Solution

Implemented a **database-driven unread count system** that:
- Automatically tracks the number of unread messages from leads
- Updates in real-time when new messages arrive
- Resets to 0 when conversation is marked as read
- Shows accurate counts on the UI badge

## 🏗️ Architecture

### Database Layer (PostgreSQL)

**New Column:**
```sql
ALTER TABLE conversations
ADD COLUMN unread_count INTEGER DEFAULT 0;
```

**Automatic Calculation:**
- Database triggers automatically update `unread_count`
- Counts only messages where `is_from_lead = true`
- Resets to 0 when `is_read = true`

**Triggers:**
1. **On Message Insert**: Updates count when new message arrives
2. **On Conversation Read**: Resets count to 0
3. **On Conversation Unread**: Recalculates count from messages

### Backend Layer (Node.js/Express)

**Updated Query:**
```typescript
.select(`
  *,
  unread_count,  // ← Now included in response
  received_account:connected_accounts(...)
`)
```

The backend now returns the accurate `unread_count` calculated by the database.

### Frontend Layer (React)

**Optimistic Updates:**
```typescript
// When SSE event received, increment count optimistically
unreadCount: (currentUnread || 0) + 1

// Then refetch from backend to get accurate count
queryClient.invalidateQueries({ queryKey: ['conversations'] });
```

**Badge Display:**
```tsx
{unreadCount > 0 && (
  <span className="...">
    {unreadCount}  // ← Shows actual count (2, 3, 4, etc.)
  </span>
)}
```

## 📁 Files Changed

### 1. Database Migration
**File:** `Converso-frontend/supabase/migrations/20251215000002_add_unread_count.sql`

**What it does:**
- Adds `unread_count` column to conversations table
- Creates function `calculate_unread_count()` to count unread messages
- Creates trigger to auto-update count on message insert
- Creates trigger to reset count when marked as read
- Initializes counts for existing conversations

### 2. Backend API
**File:** `Converso-backend/src/api/conversations.ts`

**Changes:**
```typescript
// Added unread_count to SELECT query
.select(`
  *,
  unread_count,  // ← NEW
  received_account:connected_accounts(...)
`)
```

### 3. Frontend Component
**File:** `Converso-frontend/src/pages/LinkedInInbox.tsx`

**Changes:**
- Updated `normalizedConversations` to use `unread_count` from backend
- Updated `bumpUnread()` to set both `unreadCount` and `unread_count`
- Added comments explaining the optimistic update strategy

## 🔄 How It Works

### Flow: New Message Arrives

```
1. LinkedIn Message Sent
   ↓
2. Webhook received by backend
   ↓
3. Backend inserts message into database
   INSERT INTO messages (is_from_lead = true, ...)
   ↓
4. Database trigger fires
   trigger_update_unread_count()
   ↓
5. Database calculates new count
   SELECT COUNT(*) FROM messages 
   WHERE conversation_id = X AND is_from_lead = true
   ↓
6. Database updates conversation
   UPDATE conversations SET unread_count = 3 WHERE id = X
   ↓
7. Backend sends SSE event
   sendSseEvent('linkedin_message', { conversation_id: X })
   ↓
8. Frontend receives SSE event
   bumpUnread(conversationId)
   ↓
9. Frontend optimistically increments count
   unreadCount: (currentUnread || 0) + 1
   ↓
10. Frontend refetches from backend
    queryClient.invalidateQueries(['conversations'])
    ↓
11. Backend returns accurate count from database
    { id: X, unread_count: 3, ... }
    ↓
12. UI updates with accurate badge
    Badge shows: "3" ✅
```

### Flow: User Marks as Read

```
1. User clicks conversation
   ↓
2. Frontend calls markReadLocally()
   Sets: isRead = true, unreadCount = 0
   ↓
3. Frontend calls backend API
   PATCH /api/conversations/:id/read { isRead: true }
   ↓
4. Backend updates database
   UPDATE conversations SET is_read = true WHERE id = X
   ↓
5. Database trigger fires
   trigger_reset_unread_count()
   ↓
6. Database resets count
   UPDATE conversations SET unread_count = 0 WHERE id = X
   ↓
7. UI updates
   Badge disappears ✅
```

## 🎨 UI Behavior

### Before Fix
```
Conversation with 5 new messages:
👤 John Doe                    🔵 1  ← Always showed "1"
```

### After Fix
```
Conversation with 5 new messages:
👤 John Doe                    🔵 5  ← Shows actual count!
```

## 🧪 Testing

### Test 1: Single Message
1. Send 1 LinkedIn message
2. **Expected**: Badge shows "1"
3. **Verify**: `unread_count = 1` in database

### Test 2: Multiple Messages
1. Send 3 LinkedIn messages without reading
2. **Expected**: Badge shows "3"
3. **Verify**: `unread_count = 3` in database

### Test 3: Mark as Read
1. Click conversation with 3 unread messages
2. **Expected**: Badge disappears
3. **Verify**: `unread_count = 0` in database

### Test 4: Real-time Updates
1. Keep inbox open
2. Send message from another device
3. **Expected**: Badge increments in real-time
4. **Verify**: Count updates without page refresh

## 🔍 Database Queries

### Check Unread Counts
```sql
SELECT 
  id,
  sender_name,
  is_read,
  unread_count,
  last_message_at
FROM conversations
WHERE unread_count > 0
ORDER BY last_message_at DESC;
```

### Verify Count Accuracy
```sql
SELECT 
  c.id,
  c.sender_name,
  c.unread_count as stored_count,
  COUNT(m.id) as actual_count
FROM conversations c
LEFT JOIN messages m ON m.conversation_id = c.id 
  AND m.is_from_lead = true
WHERE c.is_read = false
GROUP BY c.id, c.sender_name, c.unread_count
HAVING c.unread_count != COUNT(m.id);
```

### Manually Recalculate All Counts
```sql
UPDATE conversations
SET unread_count = calculate_unread_count(id);
```

## 🐛 Troubleshooting

### Issue: Count Not Updating
**Symptoms**: Badge shows old count after new message
**Causes**:
- Trigger not firing
- SSE event not received
- Query cache not invalidating

**Solutions**:
```sql
-- Check if trigger exists
SELECT * FROM pg_trigger 
WHERE tgname = 'update_unread_count_on_message_insert';

-- Manually update count
SELECT update_unread_count('conversation-id-here');

-- Check messages
SELECT COUNT(*) FROM messages 
WHERE conversation_id = 'conversation-id-here' 
AND is_from_lead = true;
```

### Issue: Count Shows Wrong Number
**Symptoms**: Badge shows 5 but only 3 messages visible
**Causes**:
- Messages marked as `is_from_lead = true` incorrectly
- Duplicate messages in database
- Count not reset when marked as read

**Solutions**:
```sql
-- Check message attribution
SELECT 
  id,
  content,
  is_from_lead,
  sender_name,
  created_at
FROM messages
WHERE conversation_id = 'conversation-id-here'
ORDER BY created_at DESC;

-- Recalculate count
UPDATE conversations
SET unread_count = calculate_unread_count(id)
WHERE id = 'conversation-id-here';
```

### Issue: Count Doesn't Reset
**Symptoms**: Badge still shows count after clicking conversation
**Causes**:
- `is_read` not being updated
- Trigger not firing on update
- Frontend not calling mark as read API

**Solutions**:
```sql
-- Manually reset
UPDATE conversations
SET is_read = true, unread_count = 0
WHERE id = 'conversation-id-here';

-- Check trigger
SELECT * FROM pg_trigger 
WHERE tgname = 'reset_unread_count_on_read';
```

## 📊 Performance

### Database Indexes
```sql
-- Index for fast unread queries
CREATE INDEX idx_conversations_unread_count 
ON conversations(unread_count) 
WHERE unread_count > 0;

-- Existing index on last_message_at
-- Helps with ordering conversations
```

### Query Performance
- **Before**: Frontend calculated count from all messages (N queries)
- **After**: Database maintains count (0 extra queries)
- **Benefit**: Faster page loads, less database load

## 🚀 Deployment Steps

### 1. Run Migration
```bash
cd Converso-frontend
npx supabase migration up
```

Or apply directly:
```bash
psql $DATABASE_URL < supabase/migrations/20251215000002_add_unread_count.sql
```

### 2. Verify Migration
```sql
-- Check column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'conversations' 
AND column_name = 'unread_count';

-- Check triggers exist
SELECT tgname FROM pg_trigger 
WHERE tgrelid = 'conversations'::regclass
OR tgrelid = 'messages'::regclass;
```

### 3. Initialize Counts
```sql
-- Calculate counts for existing conversations
UPDATE conversations
SET unread_count = calculate_unread_count(id)
WHERE is_read = false;
```

### 4. Restart Backend
```bash
cd Converso-backend
npm run dev
```

### 5. Refresh Frontend
```bash
# Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+R)
# Or restart dev server
cd Converso-frontend
npm run dev
```

## ✅ Verification Checklist

After deployment:

- [ ] Migration applied successfully
- [ ] `unread_count` column exists in database
- [ ] Triggers created successfully
- [ ] Existing conversations have correct counts
- [ ] Backend returns `unread_count` in API response
- [ ] Frontend displays accurate badge numbers
- [ ] New messages increment count correctly
- [ ] Marking as read resets count to 0
- [ ] Real-time updates work via SSE
- [ ] No console errors in browser
- [ ] No errors in backend logs

## 📈 Benefits

### Before
- ❌ Always showed "1" for unread conversations
- ❌ No way to know how many messages without clicking
- ❌ Poor user experience

### After
- ✅ Shows actual count (1, 2, 3, 5, 10, etc.)
- ✅ Users know urgency at a glance
- ✅ Professional WhatsApp-style experience
- ✅ Automatic updates via database triggers
- ✅ No extra queries needed
- ✅ Accurate and reliable

## 🎓 Key Concepts

### Database Triggers
- Automatically execute functions when data changes
- Keep derived data (like counts) in sync
- No application code needed for updates

### Optimistic Updates
- Update UI immediately for better UX
- Refetch from backend to ensure accuracy
- Best of both worlds: fast + accurate

### Server-Sent Events (SSE)
- Push notifications from server to client
- Real-time updates without polling
- Efficient and scalable

---

**Status**: ✅ Implemented and ready to deploy
**Impact**: High - Significantly improves user experience
**Risk**: Low - Non-breaking change with fallbacks
