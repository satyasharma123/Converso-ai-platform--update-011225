# Reconnect Email Accounts - Complete Guide

## ✅ Issue 1: Email Body Fetching (Reconnect Solution)

### Problem
Many emails show `HTML: none | Text: none` because they don't have `gmail_message_id` or `outlook_message_id` in the messages table.

### Root Cause
Old emails were synced before we added the logic to store provider message IDs at the message level. Without these IDs, we cannot fetch the full email body from Gmail/Outlook APIs.

### Solution: Reconnect Email Accounts

When you reconnect an email account, the sync process will:
1. **Re-sync all emails** from the provider (Gmail/Outlook)
2. **Store provider message IDs** (`gmail_message_id` or `outlook_message_id`) for each message
3. **Fetch and store email bodies** (`html_body` and `text_body`) during sync
4. **Enable on-demand fetching** for any messages that don't have bodies yet

## 🔄 How to Reconnect Email Accounts

### Step 1: Go to Settings
1. Click your profile in the top right
2. Select "Settings"
3. Go to "Connected Accounts" tab

### Step 2: Disconnect Email Account
1. Find the email account you want to reconnect
2. Click "Disconnect" or "Remove"
3. Confirm the disconnection

### Step 3: Reconnect Email Account
1. Click "Connect Email Account"
2. Choose Gmail or Outlook
3. Follow OAuth flow to authorize
4. Wait for initial sync to complete

### Step 4: Monitor Sync Progress
Watch the backend logs (Terminal 6) for:
```
[Email Sync] Starting sync for account: your@email.com
[Email Sync] Fetching body for message: xyz
[Email Sync] Body fetched: HTML=12589b, Text=0b
[Email Sync] Sync completed: 150 emails synced
```

## ⚠️ Important Notes

### What Gets Re-Synced
- ✅ All emails from the last 30 days (configurable)
- ✅ Email metadata (subject, sender, timestamp)
- ✅ Email bodies (HTML and plain text)
- ✅ Provider message IDs for future fetching
- ✅ Attachments metadata

### What Doesn't Get Re-Synced
- ❌ Manual notes/tags you added in Converso
- ❌ Stage assignments
- ❌ Conversation assignments to team members
- ❌ Custom fields

**These are preserved** because they're stored in the conversations table, not the messages table.

### Sync Time Estimates
- **Gmail**: ~2-5 seconds per 100 emails
- **Outlook**: ~3-7 seconds per 100 emails
- **Total**: For 500 emails, expect 1-3 minutes

## 🎯 Expected Behavior After Reconnect

### Before Reconnect
```
Debug Info: HTML: none | Text: none | Preview: 199b
```
Backend logs:
```
[Messages] Skipping body fetch for message xxx: No provider message ID
```

### After Reconnect
```
Debug Info: HTML: 17345b | Text: none | Preview: 199b
```
Backend logs:
```
[Messages] Fetching body for message xxx (messageId: yyy)
[Messages] ✅ Body fetched for message xxx: HTML=17345b, Text=0b
```

## 🐛 Troubleshooting

### Issue: Sync Takes Too Long
**Cause**: Large mailbox (1000+ emails)
**Solution**: 
1. Check backend logs for progress
2. Wait for sync to complete (can take 5-10 minutes)
3. Don't disconnect during sync

### Issue: Some Emails Still Show "HTML: none"
**Cause**: These emails might be:
1. Very old (outside sync window)
2. Deleted from provider
3. API rate limited

**Solution**:
1. Check backend logs when clicking the email
2. Look for "Skipping body fetch" or "Error fetching body"
3. If "Error fetching body", try again later (rate limit)
4. If "Skipping body fetch", email is too old to fetch

### Issue: Reconnect Fails with "OAuth Error"
**Cause**: OAuth credentials expired or invalid
**Solution**:
1. Clear browser cache
2. Try reconnecting in incognito mode
3. Check if email account has 2FA enabled
4. Ensure IMAP/API access is enabled in Gmail/Outlook settings

### Issue: Duplicate Emails After Reconnect
**Cause**: Shouldn't happen - sync checks for existing messages
**Solution**:
1. Check backend logs for "Message already exists"
2. If duplicates appear, report to dev team
3. Don't reconnect multiple times in a row

## 📊 Monitoring Reconnect Success

### 1. Check Backend Logs (Terminal 6)
Look for:
```bash
# Successful sync
[Email Sync] Sync completed: 150 emails synced

# Body fetching during sync
[Email Sync] Body fetched: HTML=12589b, Text=0b

# Existing messages skipped
[Email Sync] Message already exists: xyz
```

### 2. Check Frontend Debug Banner
After reconnect, click on emails that previously showed "HTML: none":
- **Before**: `HTML: none | Text: none | Preview: 199b`
- **After**: `HTML: 17345b | Text: none | Preview: 199b` ✅

### 3. Check Database (Optional)
Run this SQL to verify message IDs are populated:
```sql
SELECT 
  id,
  subject,
  gmail_message_id,
  outlook_message_id,
  html_body IS NOT NULL as has_html,
  text_body IS NOT NULL as has_text
FROM messages
WHERE conversation_id = 'your-conversation-id'
ORDER BY created_at DESC;
```

## 🚀 Alternative: Selective Re-Sync (Advanced)

If you don't want to reconnect the entire account, you can manually trigger a re-sync for specific conversations:

### Option 1: Delete and Re-Import Conversation
1. Delete the conversation in Converso
2. Wait for next sync cycle (every 5 minutes)
3. Conversation will be re-imported with full bodies

### Option 2: Manual Database Update (Dev Only)
```sql
-- Clear message IDs to force re-fetch
UPDATE messages
SET gmail_message_id = NULL, outlook_message_id = NULL
WHERE conversation_id = 'your-conversation-id';

-- Next time you open the email, it will try to fetch
-- But this won't work if the original message ID is lost!
```

**⚠️ Not recommended** - reconnecting is safer.

## 📝 Reconnect Checklist

Before reconnecting:
- [ ] Note which emails show "HTML: none"
- [ ] Check backend is running (Terminal 6)
- [ ] Ensure stable internet connection
- [ ] Have OAuth credentials ready (Gmail/Outlook login)

During reconnect:
- [ ] Watch backend logs for sync progress
- [ ] Don't close browser during OAuth flow
- [ ] Wait for "Sync completed" message

After reconnect:
- [ ] Hard refresh browser (Cmd+Shift+R)
- [ ] Click on emails that previously showed "HTML: none"
- [ ] Verify debug banner shows "HTML: Xb"
- [ ] Check email displays with full content

## 🎉 Success Criteria

Reconnect is successful when:
1. ✅ Backend logs show "Sync completed: X emails synced"
2. ✅ Emails that showed "HTML: none" now show "HTML: Xb"
3. ✅ Email bodies display with proper formatting
4. ✅ No "Skipping body fetch" errors in backend logs
5. ✅ All manual tags/stages/assignments are preserved

---

**Ready to reconnect?** Follow the steps above and monitor the backend logs! 🚀

