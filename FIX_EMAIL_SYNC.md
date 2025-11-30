# Fix Email Sync - Complete Guide

## Problem
The Email Inbox page shows "Loading conversations..." but no emails appear because:
1. ❌ No workspace exists in the database
2. ❌ Outlook-specific fields are missing from the database schema
3. ❌ Email sync cannot complete without these requirements

## Quick Fix (5 minutes)

### Step 1: Apply Database Setup Script

1. **Go to Supabase Dashboard**
   - Open https://supabase.com/dashboard
   - Select your project
   - Click on "SQL Editor" in the left sidebar

2. **Run the Setup Script**
   - Open the file `SETUP_DATABASE_FOR_EMAIL_SYNC.sql` (in project root)
   - Copy the entire contents
   - Paste into Supabase SQL Editor
   - Click "Run" (or press Cmd+Enter / Ctrl+Enter)

3. **Verify Success**
   - You should see output showing:
     - ✅ Workspace created or exists
     - ✅ Outlook fields added
     - ✅ Indexes created
   - Check the verification results at the bottom of the output

### Step 2: Restart Backend (if needed)

```bash
# In one terminal:
cd Converso-backend
npm run dev

# In another terminal:
cd Converso-frontend
npm run dev
```

### Step 3: Verify Email Accounts are Connected

1. Go to **Settings** → **Integrations**
2. Check if your email accounts (Gmail/Outlook) are listed
3. If not connected:
   - Click "Connect Gmail" or "Connect Outlook"
   - Follow the OAuth flow
   - Grant required permissions

### Step 4: Trigger Email Sync

**Option A: Automatic (recommended)**
- Just reload the Email Inbox page
- Sync will start automatically for all connected accounts
- Watch for the blue sync banner at the top

**Option B: Manual**
- Go to Settings → Integrations
- Find your email account
- Click "Sync Now" button (if available)

### Step 5: Monitor Sync Progress

1. **In the Email Inbox page:**
   - Look for blue banner: "🔄 Email sync in progress..."
   - This shows which accounts are syncing

2. **Check Browser Console (F12):**
   - Look for sync status messages
   - Check for any error messages

3. **Check Backend Logs:**
   - In the terminal running the backend
   - Look for sync progress messages like:
     - "Starting email sync for account..."
     - "Synced X emails for account..."
     - "Email sync completed"

## Troubleshooting

### Problem: "Failed to sync Outlook - Request failed"

**Causes:**
1. Outlook OAuth token expired
2. Missing database fields (fixed by Step 1)
3. API rate limiting

**Solutions:**
1. **Reconnect Outlook Account:**
   - Go to Settings → Integrations
   - Disconnect the Outlook account
   - Connect again with fresh OAuth

2. **Check Backend Logs:**
   ```bash
   # Look for error details
   cd Converso-backend
   npm run dev
   ```

3. **Verify Database Fields:**
   - Run this in Supabase SQL Editor:
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'conversations' AND column_name LIKE 'outlook%';
   ```
   - Should show: `outlook_message_id`, `outlook_conversation_id`

### Problem: No emails appear after sync

1. **Check if sync completed:**
   ```sql
   -- Run in Supabase SQL Editor
   SELECT * FROM public.sync_status ORDER BY updated_at DESC;
   ```
   - Status should be 'completed', not 'error'

2. **Check if conversations were created:**
   ```sql
   SELECT COUNT(*) as email_count, workspace_id
   FROM public.conversations 
   WHERE conversation_type = 'email'
   GROUP BY workspace_id;
   ```
   - Should show emails grouped by workspace

3. **Check workspace assignment:**
   ```sql
   SELECT id, name FROM public.workspaces;
   ```
   - Verify workspace exists

### Problem: "Loading conversations..." forever

**Check API Response:**
1. Open Browser DevTools (F12)
2. Go to Network tab
3. Reload page
4. Look for `/api/conversations` request
5. Check the response:
   - If empty `[]`: Sync hasn't completed or failed
   - If error: Check backend logs
   - If auth error: Check if user is logged in

**Check Backend:**
```bash
# Test API directly
curl -s http://localhost:3001/api/connected-accounts

# Should return your connected accounts
# If empty, no accounts are connected
```

## Expected Timeline

- **Database Setup:** < 1 minute
- **First Sync (Gmail):** 2-5 minutes (last 90 days of emails)
- **First Sync (Outlook):** 3-7 minutes (last 90 days of emails)
- **Subsequent Syncs:** < 30 seconds (only new emails)

## Sync Details

### What Gets Synced:
- ✅ Last 90 days of emails
- ✅ Email metadata (sender, subject, preview)
- ✅ Email IDs for later retrieval
- ❌ Full email bodies (loaded on-demand when you open an email)

### Gmail Sync:
- Uses Gmail API
- Fetches from inbox
- Supports pagination (500 emails per batch)
- Automatically refreshes OAuth tokens

### Outlook Sync:
- Uses Microsoft Graph API
- Fetches from all mail
- Supports pagination (100 emails per batch)
- Automatically refreshes OAuth tokens

## Verification Checklist

After following the steps above, verify:

- [ ] Workspace exists in database
- [ ] Outlook fields added to conversations and messages tables
- [ ] Email accounts are connected (Settings → Integrations)
- [ ] Sync status shows 'completed' (no errors)
- [ ] Conversations appear in Email Inbox
- [ ] Can open and read individual emails
- [ ] Sync banner appears when syncing
- [ ] Backend logs show no errors

## Need More Help?

Check these files for more details:
- `SETUP_DATABASE_FOR_EMAIL_SYNC.sql` - Database setup script
- `APPLY_OUTLOOK_MIGRATION.md` - Outlook fields migration
- Backend logs in terminal running `npm run dev`
- Browser console (F12) for frontend errors

## Architecture Overview

```
Frontend (Email Inbox)
    ↓
Calls /api/conversations
    ↓
Backend filters by workspace
    ↓
Returns conversations from database
    ↓
Frontend displays emails

Sync Flow:
    ↓
useEmailSync hook triggers
    ↓
Calls /api/emails/init-sync
    ↓
Backend starts sync in background
    ↓
Fetches emails from Gmail/Outlook
    ↓
Stores in conversations + messages tables
    ↓
Updates sync_status table
    ↓
Frontend polls sync_status
    ↓
Shows progress banner
    ↓
Reloads conversations when complete
```
