## LinkedIn Preview Troubleshooting Guide

### Changes Made

1. **Added `body_text` field** to preview extraction (LinkedIn messages use this field)
2. **Added debug logging** to track preview extraction
3. **Updated both sync functions** (full sync and incremental sync)

### Files Modified
- `Converso-backend/src/unipile/linkedinSyncService.ts`

### Preview Extraction Order
The system now checks these fields in order:
1. `text`
2. `body_text` ⭐ (newly added - LinkedIn uses this)
3. `content`
4. `body`
5. `snippet`
6. `preview`
7. `subject`

### Steps to Fix

#### 1. Restart Backend
```bash
# Kill the backend process
kill -9 $(lsof -ti:3001)

# Start backend again
cd Converso-backend
npm run dev
```

#### 2. Check Backend Logs
When you run a sync, you should see debug logs like:
```
[LinkedIn Sync] Chat xxx preview extracted: {
  hasMessage: true,
  fields: { text: true, body_text: false, ... },
  previewLength: 45,
  preview: "Hello, this is a test message..."
}
```

#### 3. Verify Database
Run the SQL query in `CHECK_PREVIEW_DATA.sql` in Supabase SQL Editor to check if previews are being saved.

#### 4. Trigger a Fresh Sync
Go to Settings → Connected Accounts → Click sync button for LinkedIn account

#### 5. Check Frontend
- Open LinkedIn Inbox - check if previews appear
- Open Sales Pipeline - check if previews appear for LinkedIn tiles

### Debugging Steps

#### If still no previews after sync:

1. **Check backend logs** for the debug messages
   - Look for: `[LinkedIn Sync] Chat xxx preview extracted`
   - Check if `previewLength` is > 0
   - Check if any fields are `true`

2. **Check database directly**
   ```sql
   SELECT id, sender_name, preview, LENGTH(preview) as len
   FROM conversations
   WHERE conversation_type = 'linkedin'
   AND preview IS NOT NULL
   LIMIT 5;
   ```

3. **Check raw message data**
   - Look at backend logs for the actual message structure
   - Verify which field contains the message text

4. **Check frontend console**
   - Open browser DevTools → Console
   - Look for any errors fetching conversations
   - Check the conversation data structure

### Common Issues

#### Issue: Preview is NULL in database
**Solution**: The message might not have any of the expected fields. Check backend logs to see which fields are available.

#### Issue: Preview exists in DB but not showing in UI
**Solution**: 
- Clear browser cache
- Hard refresh (Cmd+Shift+R or Ctrl+Shift+R)
- Check if `conversation.preview` is being passed to the component

#### Issue: Only some conversations have previews
**Solution**: This is normal if:
- Some conversations don't have messages yet
- Some messages don't have text content (only attachments/reactions)

### Expected Behavior

✅ **Working correctly when:**
- Backend logs show preview extraction with length > 0
- Database shows preview field populated
- Frontend displays 2 lines of preview text below sender name
- Preview is truncated with ellipsis if too long

### Test Checklist

- [ ] Backend restarted with new code
- [ ] Sync triggered for LinkedIn account
- [ ] Backend logs show preview extraction
- [ ] Database has preview data (run CHECK_PREVIEW_DATA.sql)
- [ ] LinkedIn Inbox shows previews
- [ ] Sales Pipeline shows previews for LinkedIn tiles
- [ ] Preview text is properly truncated to 2 lines
- [ ] Preview width respects 85% max-width

### Next Steps if Still Not Working

1. Share backend logs from a sync operation
2. Share result of CHECK_PREVIEW_DATA.sql query
3. Share a sample message structure from Unipile API
4. Check if messages table has content for these conversations
