# 🔧 EMAIL SYNC FIX PLAN (SAFE IMPLEMENTATION)

**Date:** December 2024  
**Status:** Analysis Complete - Ready for Implementation  
**Scope:** Gmail + Outlook Email Sync Reliability Fixes

---

## 📋 VALIDATION SUMMARY

### ✅ Confirmed Behaviors

1. **`last_synced_at` Management:**
   - **Set:** After successful sync completion (`emailSync.ts` lines 543-547)
   - **Reset:** On OAuth reconnect callback (`integrations.routes.ts` lines 152, 352)
   - **Preserved:** On token refresh during sync (`emailSync.ts` lines 200-207)

2. **Manual vs Auto Sync:**
   - **Current:** Both call identical `initEmailSync()` function
   - **Frontend:** Passes `isManual` flag but backend ignores it
   - **Behavior:** Identical - both use `last_synced_at` check (incremental vs initial)

3. **Sync Window Determination:**
   - **Initial:** `EMAIL_INITIAL_SYNC_DAYS` (30 days) when `last_synced_at === null`
   - **Incremental:** `sinceDate = last_synced_at` when it exists
   - **Provider Functions:** Both `fetchGmailEmailMetadata()` and `fetchOutlookEmailMetadata()` accept `sinceDate` parameter

4. **OAuth Reconnect vs Token Refresh:**
   - **OAuth Reconnect:** Full OAuth flow → resets `last_synced_at` to NULL
   - **Token Refresh:** Updates tokens only → preserves `last_synced_at`
   - **Issue:** Reconnect unnecessarily resets sync state

---

## 🎯 PROBLEM STATEMENT

### Root Causes Identified

1. **OAuth Reconnect Resets Sync State**
   - When user reconnects account, `last_synced_at` is set to NULL
   - Next sync becomes full sync (30 days) instead of incremental
   - Deduplication prevents re-insertion, making sync appear "broken"

2. **Manual Sync Has No Special Behavior**
   - Manual sync uses same logic as auto sync
   - If `last_synced_at` is NULL, uses 30-day window
   - User expects manual sync to fetch recent emails regardless

3. **No Distinction Between Sync Modes**
   - All syncs use same function with same logic
   - No way to force "recent only" sync
   - No way to preserve sync state on reconnect

---

## 🛠️ SAFE CHANGE PLAN

### Principle: Minimal Changes, Maximum Safety

**Strategy:**
- Add sync mode parameter to `initEmailSync()`
- Preserve `last_synced_at` on OAuth reconnect (unless explicitly reset)
- Add manual sync mode that fetches last N days regardless of `last_synced_at`
- Keep all existing behavior as fallback

---

## 📝 PROPOSED CHANGES

### Change 1: Add Sync Mode Parameter

**File:** `Converso-backend/src/services/emailSync.ts`

**Function:** `initEmailSync()`

**Change:**
- Add optional `syncMode` parameter: `'initial' | 'incremental' | 'manual-recent'`
- Default: `'incremental'` (preserves existing behavior)
- Logic:
  - `'initial'`: Always use `EMAIL_INITIAL_SYNC_DAYS` (ignore `last_synced_at`)
  - `'incremental'`: Use `last_synced_at` if exists, else `EMAIL_INITIAL_SYNC_DAYS`
  - `'manual-recent'`: Always use `EMAIL_MANUAL_SYNC_DAYS` (new config, default 7 days)

**Why Safe:**
- Backward compatible (default preserves existing behavior)
- No breaking changes to existing calls
- Explicit mode selection prevents ambiguity

---

### Change 2: Preserve `last_synced_at` on OAuth Reconnect

**File:** `Converso-backend/src/routes/integrations.routes.ts`

**Functions:**
- `GET /api/integrations/gmail/callback` (line 70-192)
- `GET /api/integrations/outlook/callback` (line 269-391)

**Change:**
- **Remove:** `last_synced_at: null` from update statements (lines 152, 352)
- **Keep:** Only update OAuth tokens and `sync_status`
- **Preserve:** Existing `last_synced_at` value

**Why Safe:**
- OAuth reconnect should only update tokens, not reset sync state
- If user wants full resync, they can manually trigger initial sync
- Prevents accidental loss of sync progress

**Edge Case Handling:**
- If account was never synced (`last_synced_at` is NULL), initial sync will still trigger
- If account was synced, incremental sync continues seamlessly

---

### Change 3: Add Manual Sync Mode to Routes

**File:** `Converso-backend/src/routes/integrations.routes.ts`

**Functions:**
- `POST /api/integrations/gmail/sync/:accountId` (line 198-219)
- `POST /api/integrations/outlook/sync/:accountId` (line 397-418)

**Change:**
- Pass `syncMode: 'manual-recent'` to `initEmailSync()`
- This ensures manual sync always fetches recent emails (last 7 days by default)

**Why Safe:**
- Manual sync becomes explicit "recent only" behavior
- User expectation: "Sync now" = fetch latest emails
- Doesn't affect auto sync or initial sync

---

### Change 4: Add Manual Sync Config

**File:** `Converso-backend/src/config/unipile.ts`

**Change:**
- Add: `EMAIL_MANUAL_SYNC_DAYS = parseInt(process.env.EMAIL_MANUAL_SYNC_DAYS || '7', 10)`
- Default: 7 days (configurable via env var)

**Why Safe:**
- Separate config for manual sync window
- Allows tuning without affecting initial/incremental sync
- Environment variable allows per-deployment configuration

---

### Change 5: Update Account Connection Sync Call

**File:** `Converso-backend/src/routes/integrations.routes.ts`

**Functions:**
- Gmail callback (line 181)
- Outlook callback (line 380)

**Change:**
- Pass `syncMode: 'initial'` explicitly to `initEmailSync()`
- Makes intent clear: new account = initial sync

**Why Safe:**
- Explicit mode selection
- Ensures new accounts always get full initial sync
- No behavior change, just clarity

---

## 📊 FUNCTION MODIFICATION LIST

### Files to Modify (5 files total)

1. **`Converso-backend/src/services/emailSync.ts`**
   - Function: `initEmailSync(accountId, userId, syncMode?)`
   - Lines: ~90-587
   - Changes: Add sync mode parameter, update date window logic

2. **`Converso-backend/src/routes/integrations.routes.ts`**
   - Functions:
     - `GET /api/integrations/gmail/callback` (line 70-192)
     - `POST /api/integrations/gmail/sync/:accountId` (line 198-219)
     - `GET /api/integrations/outlook/callback` (line 269-391)
     - `POST /api/integrations/outlook/sync/:accountId` (line 397-418)
   - Changes: Remove `last_synced_at: null`, add `syncMode` parameter

3. **`Converso-backend/src/config/unipile.ts`**
   - Change: Add `EMAIL_MANUAL_SYNC_DAYS` constant
   - Lines: ~15

4. **`Converso-backend/src/routes/emailSync.routes.ts`** (if exists)
   - Function: `POST /api/emails/init-sync` (line 79-103)
   - Change: Add optional `syncMode` query parameter support

5. **`Converso-backend/src/services/gmailIntegration.ts`** (no changes needed)
   - Already supports `sinceDate` parameter
   - No modifications required

6. **`Converso-backend/src/services/outlookIntegration.ts`** (no changes needed)
   - Already supports `sinceDate` parameter
   - No modifications required

---

## ⚠️ RISKS AND MITIGATION

### Risk 1: Breaking Existing Sync Behavior

**Risk:** Changing sync logic might break existing incremental syncs

**Mitigation:**
- Default `syncMode` preserves existing behavior
- Only explicit calls use new modes
- Test with accounts that have `last_synced_at` set

**Test Case:**
- Account with `last_synced_at` = 2 hours ago
- Call `initEmailSync()` without `syncMode`
- Should use incremental sync (since 2 hours ago)

---

### Risk 2: OAuth Reconnect Loses Sync State Intentionally

**Risk:** What if user WANTS to reset sync state on reconnect?

**Mitigation:**
- Add explicit reset option: `?reset_sync=true` query parameter
- Only reset if explicitly requested
- Default: preserve sync state

**Test Case:**
- Account with `last_synced_at` = yesterday
- Reconnect account WITHOUT `reset_sync=true`
- `last_synced_at` should remain = yesterday

---

### Risk 3: Manual Sync Fetches Too Much/Little Data

**Risk:** 7-day window might be wrong for some use cases

**Mitigation:**
- Make `EMAIL_MANUAL_SYNC_DAYS` configurable via env var
- Document default (7 days)
- Allow override per deployment

**Test Case:**
- Set `EMAIL_MANUAL_SYNC_DAYS=3`
- Manual sync should fetch last 3 days only

---

### Risk 4: Token Refresh Breaks Sync State

**Risk:** Token refresh might accidentally reset `last_synced_at`

**Mitigation:**
- Token refresh code (emailSync.ts lines 200-207) already preserves `last_synced_at`
- No changes needed to token refresh logic
- Verify token refresh doesn't touch `last_synced_at`

**Test Case:**
- Account with `last_synced_at` = yesterday
- Trigger token refresh during sync
- `last_synced_at` should remain = yesterday

---

### Risk 5: LinkedIn Integration Affected

**Risk:** Changes might accidentally affect LinkedIn sync

**Mitigation:**
- All changes are email-specific (`account_type === 'email'`)
- LinkedIn uses different sync functions
- No shared code paths modified

**Test Case:**
- Verify LinkedIn sync still works after changes
- Check that LinkedIn accounts are not affected

---

## 🧪 TESTING PLAN

### Test Scenarios

1. **New Account Connection**
   - Connect Gmail account
   - Verify: `last_synced_at` starts as NULL
   - Verify: Initial sync uses 30-day window
   - Verify: After sync, `last_synced_at` is set

2. **Incremental Sync**
   - Account with `last_synced_at` = 2 hours ago
   - Trigger auto sync
   - Verify: Fetches emails since 2 hours ago
   - Verify: `last_synced_at` updated to NOW

3. **Manual Sync**
   - Account with `last_synced_at` = 1 week ago
   - Click manual sync button
   - Verify: Fetches last 7 days (not since 1 week ago)
   - Verify: `last_synced_at` updated to NOW

4. **OAuth Reconnect (Preserve State)**
   - Account with `last_synced_at` = yesterday
   - Reconnect account (OAuth callback)
   - Verify: `last_synced_at` remains = yesterday
   - Verify: Next sync uses incremental (since yesterday)

5. **OAuth Reconnect (Reset State)**
   - Account with `last_synced_at` = yesterday
   - Reconnect with `?reset_sync=true`
   - Verify: `last_synced_at` set to NULL
   - Verify: Next sync uses initial (30 days)

6. **Token Refresh**
   - Account with `last_synced_at` = yesterday
   - Trigger token refresh during sync
   - Verify: `last_synced_at` preserved = yesterday
   - Verify: Sync continues with new token

---

## 📈 IMPLEMENTATION ORDER

### Phase 1: Add Sync Mode (Safest First)

1. Add `EMAIL_MANUAL_SYNC_DAYS` config
2. Add `syncMode` parameter to `initEmailSync()` (optional, default preserves behavior)
3. Update date window logic based on `syncMode`
4. Test: Existing syncs should work unchanged

### Phase 2: Update Manual Sync Routes

1. Update manual sync routes to pass `syncMode: 'manual-recent'`
2. Test: Manual sync should fetch last 7 days

### Phase 3: Preserve Sync State on Reconnect

1. Remove `last_synced_at: null` from OAuth callbacks
2. Add optional `reset_sync` query parameter
3. Test: Reconnect preserves sync state

### Phase 4: Explicit Initial Sync

1. Update account connection calls to pass `syncMode: 'initial'`
2. Test: New accounts get full initial sync

---

## ✅ SUCCESS CRITERIA

### Functional Requirements

- ✅ Manual sync fetches last 7 days regardless of `last_synced_at`
- ✅ OAuth reconnect preserves `last_synced_at` (unless reset requested)
- ✅ Incremental sync continues to work as before
- ✅ Initial sync uses 30-day window for new accounts
- ✅ Token refresh doesn't affect sync state

### Non-Functional Requirements

- ✅ No breaking changes to existing API contracts
- ✅ Backward compatible (default behavior preserved)
- ✅ LinkedIn integration unaffected
- ✅ Minimal code changes (5 files, ~50 lines changed)
- ✅ Configurable via environment variables

---

## 🔒 SAFETY GUARANTEES

1. **Backward Compatibility:** Default `syncMode` preserves existing behavior
2. **Isolation:** Changes are email-specific, LinkedIn unaffected
3. **Explicit Control:** Sync modes are explicit, not inferred
4. **State Preservation:** `last_synced_at` only reset when explicitly requested
5. **Minimal Surface Area:** Only 5 files modified, focused changes

---

## 📝 SUMMARY

### What Changes

- **Add:** Sync mode parameter (`initial`, `incremental`, `manual-recent`)
- **Add:** Manual sync config (`EMAIL_MANUAL_SYNC_DAYS`)
- **Remove:** `last_synced_at: null` from OAuth reconnect
- **Update:** Manual sync routes to use `manual-recent` mode

### What Stays the Same

- Incremental sync logic (when `last_synced_at` exists)
- Initial sync logic (when `last_synced_at` is NULL)
- Token refresh behavior
- LinkedIn integration
- Provider API integration functions

### Expected Outcome

- Manual sync reliably fetches recent emails
- OAuth reconnect doesn't reset sync progress
- Incremental sync continues working
- Clear separation of sync modes

---

**END OF PLAN**

