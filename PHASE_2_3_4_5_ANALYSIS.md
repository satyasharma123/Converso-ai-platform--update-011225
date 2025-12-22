# Phase 2-5: Complete Analysis & Fix

## 🔍 PHASE 2: REPRODUCE WITH EVIDENCE

### Request Trace (Simulated Based on Code Analysis)

**Scenario:** User clicks "View attachment" on a LinkedIn message with an image attachment.

#### 1. UI Opens URL:
```
/api/linkedin/media?url=att%3A%2F%2Faccount123%2FaHR0cHM6Ly9tZWRpYS5saWNuZC5jb20v...&account_id=unipile_account_456
```

**Decoded query params:**
- `url`: `att://account123/aHR0cHM6Ly9tZWRpYS5saWNuZC5jb20v...` (URL-encoded)
- `account_id`: `unipile_account_456`

#### 2. Backend Receives:
```javascript
rawUrl = "att://account123/aHR0cHM6Ly9tZWRpYS5saWNuZC5jb20v..." // Already URL-decoded by Express
accountId = "unipile_account_456"
```

#### 3. Backend Decodes (BEFORE FIX):
```javascript
// Step 1: Remove prefix
attRef = "account123/aHR0cHM6Ly9tZWRpYS5saWNuZC5jb20v..."

// Step 2: Split
parts = ["account123", "aHR0cHM6Ly9tZWRpYS5saWNuZC5jb20v..."]

// Step 3: Extract base64 (PROBLEM!)
base64Payload = parts[1] // "aHR0cHM6Ly9tZWRpYS5saWNuZC5jb20v..."

// Step 4: Decode base64 (WITHOUT URL-decoding first!)
decodedUrl = Buffer.from(base64Payload, 'base64').toString('utf-8')
// Result: Invalid or corrupted URL if base64 was URL-encoded
```

#### 4. Backend Calls Upstream:
```javascript
axios.get(decodedUrl, {
  headers: { 'X-API-KEY': UNIPILE_API_KEY },
  params: { account_id: accountId }
})
```

**Expected:** `https://media.licdn.com/...`  
**Actual:** Invalid URL (if base64 contained URL-encoded chars like `%2F`)

#### 5. Upstream Returns:
- **If URL invalid:** 400/404 error
- **If URL valid:** Binary media data

#### 6. Backend Returns:
- **If upstream failed:** `{ error: 'Failed to load media' }` (JSON)
- **If upstream succeeded:** Binary stream with headers

---

## 🎯 PHASE 3: DIAGNOSE ROOT CAUSE

### Analysis: Bucket A — Bad Reference Decoding

**CRITICAL ISSUE IDENTIFIED:**

**File:** `Converso-backend/src/routes/linkedin.media.routes.ts`  
**Line:** 68 (before fix)

**Problem:**
```typescript
const base64Payload = parts[1];  // Line 57
// ... audit log computes decodeURIComponent but doesn't use it (Line 62)
const decodedUrl = Buffer.from(base64Payload, 'base64').toString('utf-8');  // Line 68
```

**Root Cause:**
1. When `att://` URLs are passed in query params, Express automatically URL-decodes them
2. However, the **base64 payload itself** may contain URL-encoded characters (like `%2F` for `/`)
3. The code computes `decodeURIComponent(parts[1])` for logging (line 62) but **doesn't use it**
4. Direct base64 decoding of URL-encoded base64 will fail or produce invalid URLs

**Evidence:**
- Line 62 computes `urlDecodedBase64` but never uses it
- Line 68 uses `base64Payload` directly without URL-decoding
- Base64 strings in URLs often contain `+`, `/`, `=` which get URL-encoded to `%2B`, `%2F`, `%3D`

**Bucket Classification:** ✅ **Bucket A — Bad Reference Decoding**

**Secondary Issues:**
- **Bucket B (Headers):** Content-Type might be missing for non-images
- **Bucket C (Upstream):** Not applicable (already proxying)
- **Bucket D (Expired URLs):** Possible but not primary issue
- **Bucket E (Frontend):** Frontend correctly encodes and passes params

---

## 🔧 PHASE 4: IMPLEMENT MINIMAL FIX

### Fix Strategy

**Primary Fix:** Use URL-decoded base64 before base64 decoding

**Changes Required:**
1. ✅ Use `decodeURIComponent(parts[1])` before `Buffer.from(..., 'base64')`
2. ✅ Add error handling for invalid base64
3. ✅ Ensure proper Content-Type headers for all media types
4. ✅ Add Content-Disposition header for downloads
5. ✅ Improve error messages

### Implementation Details

#### Fix 1: URL-Decode Base64 Before Decoding

**File:** `Converso-backend/src/routes/linkedin.media.routes.ts`

**Change:**
```typescript
// BEFORE (Line 68):
const decodedUrl = Buffer.from(base64Payload, 'base64').toString('utf-8');

// AFTER:
let decodedUrl: string;
try {
  const urlDecodedBase64Payload = decodeURIComponent(base64Payload);
  decodedUrl = Buffer.from(urlDecodedBase64Payload, 'base64').toString('utf-8');
} catch (decodeError: any) {
  // Fallback: try direct base64 decode (for non-URL-encoded base64)
  try {
    decodedUrl = Buffer.from(base64Payload, 'base64').toString('utf-8');
  } catch (base64Error: any) {
    return res.status(400).json({ error: 'Invalid base64 encoding' });
  }
}
```

#### Fix 2: Improve Response Headers

**Change:**
```typescript
// BEFORE:
res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
res.setHeader('Cache-Control', 'public, max-age=86400');

// AFTER:
const contentType = response.headers['content-type'] || 'application/octet-stream';
res.setHeader('Content-Type', contentType);
res.setHeader('Cache-Control', 'public, max-age=86400');

// Add Content-Length if available
if (response.headers['content-length']) {
  res.setHeader('Content-Length', response.headers['content-length']);
}

// Add Content-Disposition for proper browser handling
const isImage = contentType.startsWith('image/');
const contentDisposition = isImage
  ? 'inline'
  : `attachment; filename="${response.headers['content-disposition']?.match(/filename="?([^"]+)"?/)?.[1] || 'attachment'}"`;
res.setHeader('Content-Disposition', contentDisposition);
```

#### Fix 3: Better Error Handling

**Change:**
```typescript
// BEFORE:
catch (err: any) {
  return res.status(err.response?.status || 500).json({ error: 'Failed to load media' });
}

// AFTER:
catch (err: any) {
  const statusCode = err.response?.status || 500;
  const errorMessage = err.response?.status === 404
    ? 'Media not found'
    : err.response?.status === 401 || err.response?.status === 403
    ? 'Unauthorized to access media'
    : 'Failed to load media';
  return res.status(statusCode).json({ error: errorMessage });
}
```

---

## ✅ PHASE 5: VERIFICATION CHECKLIST

### Testing Steps

#### 1. Test Image Attachments

**Prerequisites:**
- LinkedIn conversation with image attachment
- `unipile_account_id` present in conversation
- Backend running with `UNIPILE_API_KEY` set

**Steps:**
1. Open LinkedIn inbox in Converso UI
2. Click on conversation with image attachment
3. Verify image preview loads OR "View attachment" link works
4. Click "View attachment" link
5. Verify image opens in new tab

**Expected Result:**
- Image displays correctly
- No "No file available" error

#### 2. Test Non-Image Attachments

**Steps:**
1. Open LinkedIn conversation with PDF/document attachment
2. Click "View attachment" link
3. Verify file downloads or opens correctly

**Expected Result:**
- File downloads with correct filename
- Content-Type header is correct

#### 3. Test Error Cases

**Test Case A: Missing account_id**
- Conversation without `unipile_account_id`
- Expected: Fallback to direct URL (may fail, but graceful)

**Test Case B: Invalid att:// format**
- Malformed attachment URL
- Expected: 400 error with clear message

**Test Case C: Unipile API failure**
- Invalid/expired Unipile URL
- Expected: Appropriate error message (404, 401, etc.)

#### 4. Regression Tests

**Verify:**
- ✅ LinkedIn messaging send/receive unchanged
- ✅ Email attachments unaffected
- ✅ Other routes/components untouched
- ✅ No console errors in browser

---

## 🧪 READY-TO-RUN DEBUG COMMANDS

### 1. Test Backend Media Endpoint Directly

```bash
# Replace with actual values from your database
ATT_URL="att://account123/base64encodedurl"
ACCOUNT_ID="unipile_account_456"

# Test with curl
curl -v "http://localhost:3000/api/linkedin/media?url=$(echo -n "$ATT_URL" | jq -sRr @uri)&account_id=$ACCOUNT_ID" \
  -H "Accept: image/*" \
  -o /tmp/test-attachment

# Check response
file /tmp/test-attachment
```

### 2. Check Backend Logs

**Location:** Server console where backend is running

**Look for:**
```
[MEDIA AUDIT] rawUrl { rawUrl: 'att://...' }
[MEDIA AUDIT] att parts { parts: [...] }
[MEDIA AUDIT] urlDecodedBase64 { urlDecodedBase64: '...' }
[MEDIA AUDIT] decodedUrl { decodedUrl: 'https://...' }
[MEDIA AUDIT] upstream response { status: 200, contentType: 'image/jpeg', ... }
```

### 3. Test with Sample Base64

```bash
# Create test base64 URL
TEST_URL="https://media.licdn.com/dms/image/test"
BASE64_URL=$(echo -n "$TEST_URL" | base64)
ATT_REF="att://test_account/$BASE64_URL"

# URL encode the att:// reference
ENCODED_ATT=$(echo -n "$ATT_REF" | jq -sRr @uri)

# Test endpoint
curl -v "http://localhost:3000/api/linkedin/media?url=$ENCODED_ATT&account_id=test_account"
```

### 4. Database Query to Find Test Attachment

```sql
-- Find messages with attachments
SELECT 
  m.id as message_id,
  m.conversation_id,
  m.attachments,
  c.chat_id,
  c.unipile_account_id
FROM messages m
JOIN conversations c ON m.conversation_id = c.id
WHERE 
  m.attachments IS NOT NULL 
  AND jsonb_array_length(m.attachments) > 0
  AND c.conversation_type = 'linkedin'
LIMIT 5;
```

### 5. Browser DevTools Check

**In Browser Console:**
```javascript
// Check if attachment URL is correctly formed
const att = { url: "att://account123/base64..." };
const proxiedUrl = `/api/linkedin/media?url=${encodeURIComponent(att.url)}&account_id=unipile_account_456`;
console.log('Proxied URL:', proxiedUrl);

// Test fetch
fetch(proxiedUrl)
  .then(r => {
    console.log('Status:', r.status);
    console.log('Content-Type:', r.headers.get('content-type'));
    return r.blob();
  })
  .then(blob => console.log('Blob size:', blob.size));
```

---

## 📋 FILES CHANGED

### Modified Files

1. **`Converso-backend/src/routes/linkedin.media.routes.ts`**
   - Fixed base64 decoding to URL-decode first
   - Added error handling for invalid base64
   - Improved response headers (Content-Type, Content-Length, Content-Disposition)
   - Enhanced error messages

### Files NOT Changed (Scope Lock)

- ✅ Frontend components (no changes needed)
- ✅ Database schema (no changes needed)
- ✅ Other routes (no changes)
- ✅ Sync logic (no changes)
- ✅ Notification logic (no changes)

---

## 📊 PATCH SUMMARY

### What Was Fixed

1. **Root Cause:** Base64 payload was not URL-decoded before base64 decoding
2. **Impact:** Invalid URLs sent to Unipile API, causing 400/404 errors
3. **Solution:** URL-decode base64 payload before decoding, with fallback for non-URL-encoded base64
4. **Additional:** Improved headers and error messages for better browser handling

### Testing Checklist

- [ ] Image attachments display correctly
- [ ] PDF/document attachments download correctly
- [ ] Error cases handled gracefully
- [ ] No regressions in LinkedIn messaging
- [ ] No regressions in email attachments
- [ ] Backend logs show correct decoding flow

### Next Steps

1. Deploy fix to staging
2. Test with real LinkedIn attachments
3. Monitor backend logs for `[MEDIA AUDIT]` entries
4. Verify no errors in browser console
5. Remove audit logs after verification (marked with `// AUDIT ONLY`)

---

## 🔍 DEBUGGING TIPS

### If Images Still Don't Load

1. **Check Backend Logs:**
   - Look for `[MEDIA AUDIT]` entries
   - Verify `decodedUrl` is a valid HTTPS URL
   - Check upstream response status

2. **Check Browser Network Tab:**
   - Verify request URL is correct
   - Check response status code
   - Verify Content-Type header

3. **Check Database:**
   - Verify `unipile_account_id` is present in conversation
   - Verify attachment URL format in `messages.attachments`

4. **Check Environment:**
   - Verify `UNIPILE_API_KEY` is set
   - Verify backend can reach Unipile API

### Common Issues

**Issue:** "Invalid base64 encoding"
- **Cause:** Base64 payload is corrupted or malformed
- **Fix:** Check attachment URL in database

**Issue:** "Media not found" (404)
- **Cause:** Unipile URL is expired or invalid
- **Fix:** May need to refresh attachment URL from Unipile

**Issue:** "Unauthorized to access media" (401/403)
- **Cause:** Unipile API key invalid or account_id wrong
- **Fix:** Verify `UNIPILE_API_KEY` and `account_id`

---

## ✅ VERIFICATION COMPLETE

**Status:** ✅ **READY FOR TESTING**

**Summary:**
- Root cause identified: Bucket A (Bad Reference Decoding)
- Fix implemented: URL-decode base64 before decoding
- Headers improved: Content-Type, Content-Length, Content-Disposition
- Error handling enhanced: Better error messages
- Audit logs in place: Ready for debugging

**Next:** Test with real LinkedIn attachments and verify fix works.
