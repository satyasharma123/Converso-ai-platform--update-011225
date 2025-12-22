# 📧 EMAIL SYNC SYSTEM AUDIT REPORT

**Date:** December 2024  
**Scope:** Gmail + Outlook Email Sync (Read-Only Analysis)  
**Purpose:** Understand why emails stop syncing after initial connection and why manual sync doesn't fetch latest emails

---

## 📌 1. EMAIL SYNC ARCHITECTURE (HIGH-LEVEL FLOW)

### Entry Points

The email sync system has **THREE** main entry points:

1. **Account Connection (OAuth Callback)**
   - **File:** `Converso-backend/src/routes/integrations.routes.ts`
   - **Routes:** 
     - `GET /api/integrations/gmail/callback` (lines 70-192)
     - `GET /api/integrations/outlook/callback` (lines 269-391)
   - **Trigger:** User completes OAuth flow
   - **Action:** Calls `initEmailSync(accountId, userId)` in background (non-blocking)
   - **When:** Immediately after account is created/updated in database

2. **Manual Inbox Sync Button**
   - **File:** `Converso-frontend/src/pages/EmailInbox.tsx`
   - **Function:** `triggerEmailSync(isManual: true)` (lines 106-211)
   - **API Calls:**
     - `POST /api/integrations/gmail/sync/:accountId` (line 198-219)
     - `POST /api/integrations/outlook/sync/:accountId` (line 397-418)
   - **Backend Handler:** Calls `initEmailSync(accountId, userId)` in background
   - **When:** User clicks "Sync" button in Email Inbox UI

3. **Frontend Auto-Sync (Client-Side Polling)**
   - **File:** `Converso-frontend/src/pages/EmailInbox.tsx`
   - **Function:** `setInterval` every 15 minutes (lines 232-244)
   - **Trigger:** Automatic, runs while EmailInbox component is mounted
   - **Action:** Calls `triggerEmailSync(false)` (non-manual flag)
   - **When:** Every 15 minutes (900,000ms)

### Core Sync Function

**File:** `Converso-backend/src/services/emailSync.ts`  
**Function:** `initEmailSync(accountId: string, userId: string)` (lines 90-587)

This is the **ONLY** function that performs email synchronization. All entry points eventually call this function.

---

## 📥 2. INITIAL SYNC (ACCOUNT CONNECT)

### Flow When New Account is Connected

1. **OAuth Callback Completes**
   - User authorizes Gmail/Outlook
   - Backend receives OAuth tokens
   - Account record created/updated in `connected_accounts` table
   - **Critical:** `last_synced_at` is set to `NULL` (lines 152, 352)

2. **Background Sync Triggered**
   - `initEmailSync(accountId, userId)` called asynchronously (non-blocking)
   - Function runs in background, doesn't block OAuth redirect

3. **Sync Type Detection**
   - **Code:** Lines 113-118 in `emailSync.ts`
   ```typescript
   const isIncrementalSync = !!account.last_synced_at;
   const sinceDate = isIncrementalSync ? new Date(account.last_synced_at) : null;
   ```
   - **For NEW accounts:** `last_synced_at === null` → `isIncrementalSync = false`
   - **Result:** Uses `EMAIL_INITIAL_SYNC_DAYS` (default: 30 days)

4. **Date Range Used**
   - **Config:** `EMAIL_INITIAL_SYNC_DAYS = 30` (from `config/unipile.ts`)
   - **Gmail:** Fetches emails `after:${30_days_ago_timestamp}` (line 82)
   - **Outlook:** Fetches emails `receivedDateTime ge ${30_days_ago_ISO}` (line 76-82)

5. **Folders Synced**
   - **Code:** Line 139 in `emailSync.ts`
   - **Folders:** `['inbox', 'sent', 'important', 'drafts', 'archive', 'trash']`
   - **Process:** Loops through each folder sequentially (line 144)

6. **Pagination**
   - **Gmail:** Uses `pageToken` for pagination (max 500 per batch, line 113)
   - **Outlook:** Uses `skipToken` for pagination (max 100 per batch, line 116)
   - **Safety Limit:** Max 100 batches per folder (line 148)

7. **Message Storage**
   - **Conversations:** Created/updated in `conversations` table (lines 279-409)
   - **Messages:** Created in `messages` table (lines 411-483)
   - **Body Fetching:** **BODIES ARE FETCHED DURING SYNC** (lines 425-444)
     - **Note:** Code comment says "METADATA ONLY" but implementation fetches bodies
     - Bodies stored in `messages.html_body` and `messages.text_body` (lines 461-462)

8. **Completion**
   - **Status Update:** Sets sync_status to 'completed' (line 540)
   - **Critical:** Updates `last_synced_at` to `NOW()` (lines 543-547)
   ```typescript
   await supabaseAdmin
     .from('connected_accounts')
     .update({ last_synced_at: new Date().toISOString() })
     .eq('id', accountId)
     .eq('account_type', 'email');
   ```

---

## 🔁 3. MANUAL INBOX SYNC (CURRENT BEHAVIOR)

### Flow When User Clicks "Sync" Button

1. **Frontend Trigger**
   - **File:** `Converso-frontend/src/pages/EmailInbox.tsx`
   - **Function:** `triggerEmailSync(isManual: true)` (line 106)
   - **Logic:** Loops through all email accounts (line 109)
   - **API Call:** `POST /api/integrations/gmail/sync/:accountId` or `/outlook/sync/:accountId`

2. **Backend Handler**
   - **File:** `Converso-backend/src/routes/integrations.routes.ts`
   - **Routes:** Lines 198-219 (Gmail), 397-418 (Outlook)
   - **Action:** Calls `initEmailSync(accountId, userId)` in background
   - **Response:** Returns immediately with "sync initiated" message

3. **Sync Function Execution**
   - **Same Function:** `initEmailSync()` is called
   - **Incremental Check:** Lines 113-118 check `account.last_synced_at`
   - **Expected Behavior:** If `last_synced_at` exists, should use incremental sync

4. **Date Range Logic**
   - **If `last_synced_at` exists:**
     - `sinceDate = new Date(account.last_synced_at)` (line 115)
     - Passed to `fetchGmailEmailMetadata()` or `fetchOutlookEmailMetadata()` (lines 170, 181)
   - **If `last_synced_at` is NULL:**
     - Uses `EMAIL_INITIAL_SYNC_DAYS` (30 days)

5. **Provider Integration Functions**
   - **Gmail:** `fetchGmailEmailMetadata()` (line 62-140 in `gmailIntegration.ts`)
     - **Incremental:** Uses `sinceDate` to build `after:${timestamp}` query (lines 80-82)
     - **Initial:** Uses `getDaysAgoTimestamp(daysBack)` (line 82)
   - **Outlook:** `fetchOutlookEmailMetadata()` (line 60-140 in `outlookIntegration.ts`)
     - **Incremental:** Uses `sinceDate.toISOString()` in filter (line 76-77)
     - **Initial:** Uses `daysBack` to calculate threshold date (line 79-81)

---

## ⏱ 4. INCREMENTAL SYNC STATUS

### ✅ **INCREMENTAL SYNC IS IMPLEMENTED**

**Evidence:**

1. **State Storage**
   - **Field:** `last_synced_at` in `connected_accounts` table
   - **Type:** `timestamp` (nullable)
   - **Updated:** After successful sync completion (lines 543-547)

2. **Detection Logic**
   - **Code:** Lines 113-118 in `emailSync.ts`
   ```typescript
   const isIncrementalSync = !!account.last_synced_at;
   const sinceDate = isIncrementalSync ? new Date(account.last_synced_at) : null;
   ```

3. **Usage in Fetch Queries**
   - **Gmail:** `sinceDate` passed to `fetchGmailEmailMetadata()` (line 170)
     - Used in query: `after:${sinceDate.getTime() / 1000}` (line 81)
   - **Outlook:** `sinceDate` passed to `fetchOutlookEmailMetadata()` (line 181)
     - Used in filter: `receivedDateTime ge ${sinceDate.toISOString()}` (line 76-77)

4. **Update After Sync**
   - **Code:** Lines 543-547
   - **When:** After all folders synced successfully
   - **Value:** Current timestamp (`new Date().toISOString()`)

### ⚠️ **POTENTIAL ISSUES**

1. **Account Reconnection Resets `last_synced_at`**
   - **Code:** Lines 152, 352 in `integrations.routes.ts`
   - **Issue:** When OAuth tokens are refreshed/reconnected, `last_synced_at` is set to `NULL`
   - **Impact:** Next sync becomes full sync (30 days) instead of incremental

2. **No Folder-Level Cursors**
   - **Current:** Only account-level `last_synced_at`
   - **Impact:** If one folder fails, entire sync resets to 30 days
   - **Missing:** Per-folder sync timestamps

3. **No Error Recovery**
   - **If sync fails:** `last_synced_at` is NOT updated
   - **Impact:** Next sync will retry from same point (good)
   - **But:** If sync partially completes (some folders succeed, one fails), `last_synced_at` is NOT updated

---

## 📂 5. FOLDER SYNC MODEL

### Folder Structure

**Folders Synced:** `['inbox', 'sent', 'important', 'drafts', 'archive', 'trash']` (line 139)

### Sync Behavior

1. **Sequential Processing**
   - **Code:** `for (const folder of foldersToSync)` (line 144)
   - **Process:** One folder at a time, not parallel

2. **Folder Normalization**
   - **Function:** `normalizeProviderFolder()` (lines 30-54)
   - **Purpose:** Maps provider-specific folder names to normalized names
   - **Gmail:** `INBOX` → `inbox`, `SENT` → `sent`, etc.
   - **Outlook:** `Inbox` → `inbox`, `SentItems` → `sent`, etc.

3. **Provider-Specific Queries**
   - **Gmail:** Uses Gmail query syntax (`in:inbox`, `in:sent`, etc.) (lines 86-108)
   - **Outlook:** Uses Microsoft Graph API folder endpoints (lines 86-108)

4. **Folder Storage**
   - **Message Level:** `provider_folder` stored in `messages` table (line 455)
   - **Conversation Level:** `email_folder` stored in `conversations` table (line 328, deprecated)

5. **Independent State**
   - **Current:** NO folder-level sync state
   - **All folders:** Share same `last_synced_at` timestamp
   - **Impact:** If inbox syncs successfully but sent fails, entire sync is marked incomplete

---

## 🔄 6. BACKGROUND SYNC STATUS

### ❌ **NO BACKEND CRON JOB**

**Evidence:**
- Searched for: `cron`, `schedule`, `setInterval`, `setTimeout.*sync`
- **Result:** No backend scheduled tasks found
- **Package:** `node-cron` exists in `package.json` but NOT used for email sync

### ✅ **FRONTEND CLIENT-SIDE POLLING EXISTS**

**File:** `Converso-frontend/src/pages/EmailInbox.tsx` (lines 232-244)

**Implementation:**
```typescript
useEffect(() => {
  if (!user || !workspace) return;
  
  const syncInterval = setInterval(() => {
    console.log('⏰ Auto-sync triggered (15-minute interval)');
    triggerEmailSync(false);
  }, 15 * 60 * 1000); // 15 minutes
  
  return () => clearInterval(syncInterval);
}, [user?.id, workspace?.id]);
```

**Behavior:**
- **Frequency:** Every 15 minutes
- **Trigger:** Only when EmailInbox component is mounted
- **Action:** Calls `triggerEmailSync(false)` (non-manual flag)
- **Limitation:** Only works if user has EmailInbox page open

**Issues:**
1. **Page-Dependent:** If user closes EmailInbox, auto-sync stops
2. **No Backend Persistence:** Backend doesn't know about this polling
3. **Multiple Users:** Each user's browser runs its own interval (inefficient)

---

## ⚠️ 7. ROOT CAUSES FOR "EMAILS NOT SYNCING"

### Issue #1: Account Reconnection Resets Incremental Sync

**Problem:**
- When OAuth tokens expire or user reconnects account, `last_synced_at` is set to `NULL` (lines 152, 352)
- Next sync becomes full sync (30 days) instead of incremental
- **But:** If account was connected days/weeks ago, new emails from last 30 days may already be synced
- **Result:** Deduplication prevents re-insertion, but sync appears to "do nothing"

**Location:**
- `Converso-backend/src/routes/integrations.routes.ts` lines 152, 352

### Issue #2: Manual Sync Uses Same Function (Should Work)

**Analysis:**
- Manual sync calls `initEmailSync()` which checks `last_synced_at`
- **Should work correctly** if `last_synced_at` exists
- **Potential issue:** If `last_synced_at` is NULL (account reconnected), uses 30-day window
- **Deduplication:** Prevents duplicate messages, so sync appears to "do nothing"

### Issue #3: Deduplication May Block New Emails

**Deduplication Logic:**
- **Code:** Lines 411-423 in `emailSync.ts`
- **Check:** `provider_message_id` uniqueness
- **Query:**
  ```typescript
  const { data: existingMessage } = await supabaseAdmin
    .from('messages')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('provider_message_id', parsed.messageId)
    .single();
  ```
- **Behavior:** If message exists, skips entire message (line 422)

**Potential Issues:**
1. **If `provider_message_id` is missing/null:** May cause false positives
2. **If Gmail/Outlook changes message IDs:** New messages won't be detected
3. **Race condition:** If sync runs twice simultaneously, both may see "no existing message"

### Issue #4: Sync Status Not Updated on Partial Failure

**Problem:**
- If sync fails mid-way (e.g., token expires during folder sync), `last_synced_at` is NOT updated
- **Good:** Prevents data loss
- **Bad:** Next sync retries from same point, but if error persists, sync never progresses

**Code:** Lines 550-586 (error handling doesn't update `last_synced_at`)

### Issue #5: Frontend Auto-Sync Only Works When Page Open

**Problem:**
- Auto-sync runs every 15 minutes, but only if EmailInbox page is open
- **Impact:** If user closes browser or navigates away, no automatic sync occurs
- **No backend persistence:** Backend doesn't know when to sync automatically

### Issue #6: No Webhook/Push Notifications

**Missing:**
- Gmail Push notifications (webhooks)
- Outlook webhooks
- **Impact:** System must poll to detect new emails
- **Current:** Only polls when user manually syncs or has EmailInbox open

---

## 🧠 8. KEY OBSERVATIONS

### ✅ What Works

1. **Incremental sync logic exists and is implemented correctly**
2. **`last_synced_at` is updated after successful sync**
3. **Deduplication prevents duplicate messages**
4. **Folder-level sync works (all 6 folders)**
5. **Manual sync button triggers correct function**

### ⚠️ What Doesn't Work Well

1. **Account reconnection resets `last_synced_at` to NULL**
   - Causes full sync instead of incremental
   - May appear to "do nothing" due to deduplication

2. **No backend background sync**
   - Relies on frontend polling (only when page open)
   - No server-side cron job

3. **No folder-level sync state**
   - All folders share same `last_synced_at`
   - If one folder fails, entire sync is incomplete

4. **Error handling doesn't update `last_synced_at`**
   - Partial failures prevent progress tracking

5. **Frontend auto-sync is page-dependent**
   - Only works when EmailInbox component is mounted
   - Stops when user navigates away

### 🔍 Critical Findings

1. **Incremental sync IS implemented** but may not work if:
   - Account was reconnected (resets `last_synced_at`)
   - Sync failed previously (`last_synced_at` not updated)

2. **Manual sync SHOULD work** if `last_synced_at` exists
   - If it doesn't work, likely because:
     - `last_synced_at` is NULL (account reconnected)
     - Deduplication prevents new messages from appearing
     - Sync is failing silently

3. **No automatic background sync**
   - System relies on:
     - Initial sync on account connect
     - Manual sync button
     - Frontend polling (only when page open)

4. **Deduplication is message-level, not conversation-level**
   - New messages in existing threads may be skipped if `provider_message_id` matches
   - But: Thread grouping logic should handle this

### 📊 Data Flow Summary

```
Account Connect
  ↓
initEmailSync() called (last_synced_at = NULL)
  ↓
Full sync (30 days)
  ↓
last_synced_at = NOW()
  ↓
Manual Sync / Auto-Sync
  ↓
initEmailSync() called (last_synced_at exists)
  ↓
Incremental sync (since last_synced_at)
  ↓
last_synced_at = NOW()
```

**Break Point:** If `last_synced_at` is NULL, system falls back to 30-day window.

---

## 📋 SUMMARY

### Incremental Sync: ✅ **IMPLEMENTED**
- Uses `last_synced_at` from `connected_accounts` table
- Passes `sinceDate` to provider APIs
- Updates `last_synced_at` after successful sync

### Background Sync: ❌ **NOT IMPLEMENTED (Backend)**
- No cron jobs
- No scheduled tasks
- Only frontend polling (15 minutes, page-dependent)

### Manual Sync: ✅ **SHOULD WORK**
- Calls same `initEmailSync()` function
- Uses incremental logic if `last_synced_at` exists
- **May fail if:** `last_synced_at` is NULL or sync errors occur

### Root Causes:
1. **Account reconnection resets `last_synced_at`**
2. **No backend background sync**
3. **Frontend polling only works when page open**
4. **Deduplication may hide sync activity**

---

**END OF AUDIT REPORT**
