# 🎯 Quick Guide: Unread Count Feature

## Problem Fixed
Badge was showing "1" for all unread conversations instead of the actual count of unread messages.

## Solution
Implemented database-driven unread count tracking with automatic updates.

---

## 🚀 Quick Deploy (3 Steps)

### Step 1: Apply Database Migration
```bash
# Option A: Using Supabase Dashboard (Recommended)
1. Go to: https://supabase.com/dashboard
2. Open: SQL Editor
3. Paste: Contents of Converso-frontend/supabase/migrations/20251215000002_add_unread_count.sql
4. Click: Run

# Option B: Using Script
./deploy-unread-count.sh
```

### Step 2: Restart Backend
```bash
# Backend will automatically use new unread_count column
cd Converso-backend
npm run dev
```

### Step 3: Refresh Frontend
```bash
# Hard refresh browser: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
# Or restart dev server:
cd Converso-frontend
npm run dev
```

---

## ✅ How to Test

### Test 1: Single Message
1. Send 1 LinkedIn message
2. **Expected**: Badge shows `🔵 1`

### Test 2: Multiple Messages
1. Send 3 LinkedIn messages (don't read them)
2. **Expected**: Badge shows `🔵 3`

### Test 3: Mark as Read
1. Click conversation with unread messages
2. **Expected**: Badge disappears

### Test 4: Real-time Updates
1. Keep inbox open
2. Send message from another device
3. **Expected**: Badge increments automatically

---

## 🎨 What Changed

### Before
```
👤 John Doe (5 unread messages)     🔵 1  ← Always "1"
```

### After
```
👤 John Doe (5 unread messages)     🔵 5  ← Actual count!
```

---

## 📁 Files Changed

### 1. Database Migration (NEW)
`Converso-frontend/supabase/migrations/20251215000002_add_unread_count.sql`
- Adds `unread_count` column
- Creates triggers for automatic updates
- Initializes counts for existing conversations

### 2. Backend API (UPDATED)
`Converso-backend/src/api/conversations.ts`
- Now includes `unread_count` in query response

### 3. Frontend Component (UPDATED)
`Converso-frontend/src/pages/LinkedInInbox.tsx`
- Uses `unread_count` from backend
- Optimistic updates for better UX

---

## 🔍 Verification

### Check Database
```sql
-- See unread counts
SELECT sender_name, unread_count, is_read
FROM conversations
WHERE unread_count > 0
ORDER BY last_message_at DESC;
```

### Check Backend Response
```bash
curl http://localhost:3001/api/conversations?type=linkedin | jq '.data[] | {sender_name, unread_count}'
```

### Check Frontend Console
```javascript
// Should see in browser console (F12):
[SSE] Received linkedin_message event: {...}
```

---

## 🐛 Troubleshooting

### Issue: Badge Still Shows "1"
**Solution**: 
1. Check if migration applied: Run verification query
2. Restart backend to pick up new column
3. Hard refresh browser (Cmd+Shift+R)

### Issue: Count Not Updating
**Solution**:
```sql
-- Manually recalculate
UPDATE conversations
SET unread_count = calculate_unread_count(id);
```

### Issue: Count Doesn't Reset
**Solution**:
```sql
-- Check if conversation marked as read
SELECT id, sender_name, is_read, unread_count
FROM conversations
WHERE id = 'conversation-id-here';

-- Manually reset
UPDATE conversations
SET is_read = true, unread_count = 0
WHERE id = 'conversation-id-here';
```

---

## 📚 Full Documentation

For detailed information, see:
- **UNREAD_COUNT_IMPLEMENTATION.md** - Complete technical guide
- **deploy-unread-count.sh** - Automated deployment script

---

## ✨ Benefits

- ✅ Shows actual message count (1, 2, 3, 5, etc.)
- ✅ Automatic updates via database triggers
- ✅ Real-time UI updates via SSE
- ✅ No extra database queries needed
- ✅ Professional WhatsApp-style UX

---

**Status**: ✅ Ready to deploy
**Time to deploy**: 5 minutes
**Risk**: Low (non-breaking change)
