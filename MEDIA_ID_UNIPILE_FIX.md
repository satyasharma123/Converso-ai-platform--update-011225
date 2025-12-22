# ✅ LinkedIn Media ID Unipile Payload Fix

## Overview
Fixed LinkedIn media_id extraction to use the correct Unipile official payload structure: `attachment.media.id` instead of `attachment.media_id`.

## Problem

**Previous (Incorrect):**
```typescript
if (firstAttachment?.media_id) {
  mediaId = firstAttachment.media_id;
}
```

**Correct (Unipile Official):**
```typescript
const mediaAttachment = message.attachments.find(
  (att) => att?.media?.id
);
if (mediaAttachment) {
  media_id = mediaAttachment.media.id;
}
```

**Reference:** https://developer.unipile.com/docs/message-payload

## Unipile Official Payload Structure

```json
{
  "id": "msg_123",
  "text": "Check this out",
  "attachments": [
    {
      "name": "image.png",
      "media": {
        "id": "unipile_media_abc123",
        "type": "image/png",
        "url": "https://..."
      }
    }
  ]
}
```

**Key:** `attachments[].media.id` (NOT `attachments[].media_id`)

## Files Modified

### 1. `Converso-backend/src/unipile/linkedinSync.4actions.ts`

**Two locations updated:**

#### Location 1: Action 4 (Incremental Sync) - Lines ~455-501

**Before:**
```typescript
let mediaId: string | null = null;
if (message.attachments && message.attachments.length > 0) {
  const firstAttachment = message.attachments[0];
  if (firstAttachment?.media_id) {
    mediaId = firstAttachment.media_id;
  }
}
```

**After:**
```typescript
let media_id: string | null = null;
if (Array.isArray(message.attachments)) {
  const mediaAttachment = message.attachments.find(
    (att) => att?.media?.id
  );
  if (mediaAttachment) {
    media_id = mediaAttachment.media.id;
  }
}
```

**Added debug log:**
```typescript
if (media_id) {
  logger.info('[MEDIA_ID_EXTRACTED]', {
    messageId: message.id,
    media_id,
  });
}
```

#### Location 2: Webhook Sync - Lines ~726-760

**Same fix applied to webhook message processing path.**

### 2. `Converso-backend/src/unipile/linkedinMessageMapper.ts`

**Updated `mapMessage` function:**

**Before:**
```typescript
let mediaId: string | null = null;
if (message.attachments && message.attachments.length > 0) {
  const firstAttachment = message.attachments[0];
  if (firstAttachment?.media_id) {
    mediaId = firstAttachment.media_id;
  }
}
```

**After:**
```typescript
let media_id: string | null = null;
if (Array.isArray(message.attachments)) {
  const mediaAttachment = message.attachments.find(
    (att) => att?.media?.id
  );
  if (mediaAttachment) {
    media_id = mediaAttachment.media.id;
  }
}
```

## Implementation Details

### Extraction Logic

```typescript
// Extract media_id from first attachment with media.id (Unipile official payload)
let media_id: string | null = null;

if (Array.isArray(message.attachments)) {
  const mediaAttachment = message.attachments.find(
    (att) => att?.media?.id
  );

  if (mediaAttachment) {
    media_id = mediaAttachment.media.id;
  }
}
```

### Database Upsert

```typescript
await supabaseAdmin
  .from('messages')
  .upsert(
    {
      // ... other fields
      media_id: media_id,
      // ... other fields
    },
    { onConflict: 'linkedin_message_id' }
  );
```

### Debug Logging (Temporary)

```typescript
if (media_id) {
  logger.info('[MEDIA_ID_EXTRACTED]', {
    messageId: message.id,
    media_id,
  });
}
```

## What Changed

### Before (Incorrect)
- ❌ Looked for `attachment.media_id` (flat structure)
- ❌ Only checked first attachment
- ❌ Would never find media_id in real Unipile payloads

### After (Correct)
- ✅ Looks for `attachment.media.id` (nested structure)
- ✅ Uses `.find()` to search all attachments
- ✅ Matches Unipile official documentation
- ✅ Will correctly extract media_id from real payloads

## Rules Followed ✅

- ✅ Did NOT change database schema
- ✅ Did NOT touch frontend
- ✅ Did NOT backfill old messages
- ✅ Only affects LinkedIn messages
- ✅ Text-only messages remain unaffected (media_id = NULL)
- ✅ Uses exact extraction logic as specified
- ✅ Includes temp debug log
- ✅ Does NOT read `attachment.media_id`
- ✅ Does NOT read `att://` URLs
- ✅ Does NOT decode URLs
- ✅ Does NOT modify existing endpoints

## Acceptance Criteria ✅

- ✅ New LinkedIn image messages will populate `messages.media_id`
- ✅ Old messages remain NULL (no backfill)
- ✅ No duplicate inserts (uses `onConflict: 'linkedin_message_id'`)
- ✅ No breaking changes (only extraction logic changed)

## Testing

### Expected Behavior

**Message with media attachment:**
```json
{
  "id": "msg_123",
  "attachments": [
    {
      "media": {
        "id": "unipile_media_abc123"
      }
    }
  ]
}
```

**Result:**
- `messages.media_id` = `"unipile_media_abc123"`
- Log: `[MEDIA_ID_EXTRACTED] { messageId: "msg_123", media_id: "unipile_media_abc123" }`

**Message without media:**
```json
{
  "id": "msg_456",
  "text": "Just text"
}
```

**Result:**
- `messages.media_id` = `NULL`
- No log

**Message with attachment but no media.id:**
```json
{
  "id": "msg_789",
  "attachments": [
    {
      "name": "file.pdf"
    }
  ]
}
```

**Result:**
- `messages.media_id` = `NULL`
- No log

### Manual Testing

1. **Send a LinkedIn message with an image**
2. **Check backend logs** for:
   ```
   [MEDIA_ID_EXTRACTED] { messageId: "...", media_id: "..." }
   ```
3. **Query database:**
   ```sql
   SELECT 
     linkedin_message_id,
     content,
     media_id,
     attachments
   FROM messages
   WHERE media_id IS NOT NULL
   ORDER BY created_at DESC
   LIMIT 5;
   ```

### Expected Database State

**New messages with media:**
```
linkedin_message_id | media_id              | attachments
--------------------|-----------------------|-------------
msg_123            | unipile_media_abc123  | [{"media":{"id":"unipile_media_abc123"}}]
```

**Old messages (unchanged):**
```
linkedin_message_id | media_id | attachments
--------------------|----------|-------------
msg_old_456        | NULL     | [{"url":"att://..."}]
```

**Text-only messages:**
```
linkedin_message_id | media_id | attachments
--------------------|----------|-------------
msg_text_789       | NULL     | NULL
```

## Impact Assessment

### ✅ Safe Changes
- No database schema changes
- No frontend changes
- No endpoint changes
- Only extraction logic updated
- Backward compatible (NULL for old messages)

### ✅ Code Coverage
- ✅ Action 4 sync (incremental)
- ✅ Webhook sync (real-time)
- ✅ Message mapper (send message route)

### ✅ Message Types Unaffected
- ✅ Text-only messages (media_id = NULL)
- ✅ Reactions (unchanged)
- ✅ Delivery status (unchanged)
- ✅ Email messages (not touched)

## Next Steps

1. ✅ Code updated with correct extraction logic
2. ⏳ Test with real LinkedIn messages containing media
3. ⏳ Verify `[MEDIA_ID_EXTRACTED]` logs appear
4. ⏳ Confirm database has `media_id` populated
5. ⏳ Remove debug logs after verification (optional)

## Files Modified Summary

1. `Converso-backend/src/unipile/linkedinSync.4actions.ts`
   - Action 4 sync path (~20 lines)
   - Webhook sync path (~20 lines)

2. `Converso-backend/src/unipile/linkedinMessageMapper.ts`
   - `mapMessage` function (~10 lines)

**Total Lines Changed:** ~50 lines  
**Linter Errors:** 0  
**Breaking Changes:** 0  
**Database Changes:** 0  
**Frontend Changes:** 0  

---

**Created:** 2024-12-23  
**Status:** Ready to Test  
**Reference:** https://developer.unipile.com/docs/message-payload
