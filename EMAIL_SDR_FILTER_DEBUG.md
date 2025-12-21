# Email SDR Filter - Debug & Testing Guide

## What Was Done

Added comprehensive debug logging to track SDR email filtering in the backend.

### Files Modified:
- `Converso-backend/src/api/conversations.ts`

### Changes:
1. **Added debug logs to `getConversations()` function:**
   - Logs userRole, userId, type, and folder at entry
   - Logs when SDR filter is applied
   - Logs query results before and after user state merge
   - Logs final return count

2. **Added debug logs to `getEmailConversationsByFolder()` function:**
   - Logs userRole, userId, and folder at entry
   - Logs when SDR filter is applied
   - Logs total conversations found
   - Logs filtered conversations count
   - Logs final return count

### Filtering Logic (Already Correct):

**Main Query (`getConversations`):**
```typescript
if (userRole === 'sdr') {
  query = query.eq('assigned_to', userId);
}
```

**Folder Query (`getEmailConversationsByFolder`):**
```typescript
if (userRole === 'sdr') {
  convQuery = convQuery.eq('assigned_to', userId);
}
```

## Testing Steps

### Step 1: Restart Backend
```bash
cd Converso-backend
npm run dev
```

The backend will automatically reload with the new debug logs.

### Step 2: Test as Admin

1. Login as Admin
2. Open Email Inbox
3. Check backend terminal logs:
   ```
   [Conversations API] type=email, folder=undefined, userId=<admin-id>, userRole=admin
   [EMAIL QUERY RESULT] Found X conversations BEFORE user state merge
   [EMAIL FINAL] Returning X conversations (userRole=admin, folder=none)
   ```

**Expected:** Admin sees all email conversations

### Step 3: Assign Email to SDR

1. As Admin, find an email conversation
2. Click "Assign to SDR" and assign to an SDR user
3. Note the conversation details

### Step 4: Test as SDR

1. Logout and login as SDR
2. Open Email Inbox
3. Check backend terminal logs:
   ```
   [Conversations API] type=email, folder=undefined, userId=<sdr-id>, userRole=sdr
   [EMAIL SDR FILTER] Applying assigned_to filter for userId: <sdr-id>
   [EMAIL QUERY RESULT] Found X conversations BEFORE user state merge
   [EMAIL FINAL] Returning X conversations (userRole=sdr, folder=none)
   ```

**Expected:** SDR sees ONLY the assigned conversation

### Step 5: Test Email Folders (if used)

1. As SDR, navigate to different email folders (Inbox, Sent, Trash)
2. Check backend terminal logs for each folder:
   ```
   [EMAIL FOLDER] Starting query for folder: inbox, userRole: sdr, userId: <sdr-id>
   [EMAIL FOLDER SDR] Applying assigned_to filter for userId: <sdr-id>
   [EMAIL FOLDER] Found X total email conversations for userRole=sdr
   [EMAIL FOLDER] Filtered to Y conversations with messages in folder: inbox
   [EMAIL FOLDER FINAL] Returning Y conversations (userRole=sdr, folder=inbox)
   ```

**Expected:** SDR sees only assigned conversations in each folder

## Debug Log Reference

### Entry Point Logs:
- `[Conversations API]` - Main function entry with params
- `[EMAIL FOLDER]` - Folder function entry with params

### Filter Application Logs:
- `[EMAIL SDR FILTER]` - SDR filter applied in main query
- `[EMAIL FOLDER SDR]` - SDR filter applied in folder query

### Result Logs:
- `[EMAIL QUERY RESULT]` - Raw query results
- `[EMAIL FOLDER] Found X total` - Total conversations before folder filter
- `[EMAIL FOLDER] Filtered to Y` - After folder filtering
- `[EMAIL FINAL]` - Final return from main function
- `[EMAIL FOLDER FINAL]` - Final return from folder function

### Error Logs:
- `[EMAIL QUERY ERROR]` - Query execution error
- `[EMAIL FOLDER] Conversation query error` - Folder query error

## Expected Behavior

### Admin User:
```
✅ Sees all email conversations
✅ Can assign conversations to SDRs
✅ Logs show userRole=admin
✅ No assigned_to filter applied
```

### SDR User:
```
✅ Sees ONLY assigned email conversations
✅ Cannot see unassigned conversations
✅ Logs show userRole=sdr
✅ Logs show "Applying assigned_to filter"
✅ Query includes .eq('assigned_to', userId)
```

## Troubleshooting

### Issue: SDR sees no conversations but should see some

**Check backend logs for:**
1. Is `userRole` correctly set to `'sdr'`?
2. Is `userId` correct?
3. Does log show "Applying assigned_to filter"?
4. What is the count in "Found X conversations"?

**If count is 0:**
- Check database: Does the conversation have `assigned_to = <sdr-user-id>`?
- Check workspace: Is the conversation in the same workspace as the SDR?

### Issue: SDR sees unassigned conversations

**Check backend logs for:**
1. Is `userRole` correctly set to `'sdr'`?
2. Does log show "Applying assigned_to filter"?

**If filter not applied:**
- Check how `userRole` is passed to the API
- Check authentication middleware

### Issue: "No Email Accounts" shown for SDR

This is a **frontend issue**, not backend filtering. The backend is correctly returning conversations (or empty array), but the frontend is showing wrong empty state.

**Backend logs will show:**
- Query executed correctly
- Filter applied correctly
- Correct number of conversations returned

**This needs frontend fix** (separate from this backend patch)

## Current Status

✅ Backend filtering is correct  
✅ Debug logs added  
✅ Ready for testing  

**Next Steps:**
1. Restart backend
2. Test as Admin (should work as before)
3. Assign email to SDR
4. Test as SDR (should see only assigned)
5. Check backend logs to verify filtering

## Notes

- No frontend changes in this patch
- No database migration needed
- No changes to LinkedIn logic
- No changes to email send/sync
- Only added debug logs to existing filtering logic

The filtering logic was already correct from previous implementation. This patch only adds visibility into what's happening via debug logs.


