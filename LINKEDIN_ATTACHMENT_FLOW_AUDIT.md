# LinkedIn Attachment Preview Flow — End-to-End Call Graph

**Date:** 2024-12-XX  
**Objective:** Map the complete flow from UI click → backend proxy → Unipile fetch → browser display

---

## 📋 EXECUTIVE SUMMARY

**Problem:** Clicking "View attachment" opens new tab → "No file available / no link available"

**Flow Overview:**
1. Frontend renders attachment link with proxied URL
2. Backend decodes `att://` reference → fetches from Unipile → streams to browser
3. Browser displays media or downloads file

**Key Finding:** Attachments stored as JSONB in `messages.attachments` column. URLs are proxied through `/api/linkedin/media` endpoint.

---

## 🔍 STEP 1: FRONTEND — ATTACHMENT RENDERING & CLICK

### File: `Converso-frontend/src/components/Inbox/ConversationView.tsx`

### 1.1 Attachment Data Structure

**Location:** Lines 686-729

**Data Shape:**
```typescript
message.attachments = [
  {
    url?: string,           // Primary field (att://... or https://...)
    preview_url?: string,    // Fallback
    asset_url?: string,      // Fallback
    href?: string,           // Fallback
    name?: string,           // Display name
    mime_type?: string,      // e.g., "image/png"
    type?: string,           // e.g., "image"
  }
]
```

**Source:** Stored as JSONB in `messages.attachments` column (see Step 3)

### 1.2 URL Extraction Helper

**Location:** Lines 23-31

```typescript
const getAttachmentUrl = (att: any): string | null => {
  return (
    att?.url ||
    att?.preview_url ||
    att?.asset_url ||
    att?.href ||
    null
  );
};
```

**Returns:** First available URL field (typically `att://...` format)

### 1.3 Image Detection Helper

**Location:** Lines 37-56

```typescript
const isImageAttachment = (att: any): boolean => {
  // Checks mime_type, type, or URL extension
  // Returns true if image detected
};
```

### 1.4 Attachment Rendering Logic

**Location:** Lines 686-729

**For Images:**
```typescript
if (isImageAttachment({ ...att, url })) {
  const proxiedUrl = conversation.unipile_account_id
    ? `/api/linkedin/media?url=${encodeURIComponent(url)}&account_id=${encodeURIComponent(conversation.unipile_account_id)}`
    : url;
  
  return <img src={proxiedUrl} alt={att.name || 'image'} />;
}
```

**For Non-Images:**
```typescript
const proxiedUrl = conversation.unipile_account_id
  ? `/api/linkedin/media?url=${encodeURIComponent(url)}&account_id=${encodeURIComponent(conversation.unipile_account_id)}`
  : url;

return (
  <a href={proxiedUrl} target="_blank" rel="noopener noreferrer">
    {att.name || 'View attachment'}
  </a>
);
```

### 1.5 Click URL Format

**Example URL:**
```
/api/linkedin/media?url=att%3A%2F%2Faccount123%2Fbase64encodedurl&account_id=unipile_account_456
```

**Query Parameters:**
- `url`: URL-encoded attachment reference (typically `att://...`)
- `account_id`: Unipile account ID from `conversation.unipile_account_id`

**Note:** If `conversation.unipile_account_id` is missing, the raw URL is used directly (likely fails).

---

## 🔍 STEP 2: BACKEND — MEDIA PROXY ROUTE

### File: `Converso-backend/src/routes/linkedin.media.routes.ts`

### 2.1 Route Registration

**File:** `Converso-backend/src/routes/index.ts` (Line 49)

```typescript
router.use('/linkedin/media', linkedinMediaRoutes);
```

**Full Path:** `GET /api/linkedin/media`

### 2.2 Route Handler

**Location:** Lines 16-117

**Expected Query Params:**
- `url` (string, required): Attachment reference (must start with `att://`)
- `account_id` (string, required): Unipile account ID

### 2.3 Decoding Flow

**Step 1: Extract raw URL**
```typescript
const rawUrl = req.query.url as string | undefined;
// Example: "att://account123/base64encodedurl"
```

**Step 2: Remove `att://` prefix**
```typescript
const attRef = rawUrl.replace('att://', '');
// Example: "account123/base64encodedurl"
```

**Step 3: Split into parts**
```typescript
const parts = attRef.split('/', 2);
// Example: ["account123", "base64encodedurl"]
```

**Step 4: Extract base64 payload**
```typescript
const base64Payload = parts[1];
// Example: "base64encodedurl"
```

**Step 5: Decode base64 to URL**
```typescript
const decodedUrl = Buffer.from(base64Payload, 'base64').toString('utf-8');
// Example: "https://media.licdn.com/..."
```

**Validation:** Checks that `decodedUrl.startsWith('https://')`

### 2.4 Upstream Fetch

**Location:** Lines 82-91

```typescript
const response = await axios.get(decodedUrl, {
  responseType: 'arraybuffer',
  headers: {
    'X-API-KEY': UNIPILE_API_KEY,
  },
  params: {
    account_id: accountId,  // From query param
  },
  timeout: 30000,
});
```

**Upstream:** Unipile API (URL decoded from base64)

**Headers Forwarded:**
- `X-API-KEY`: Unipile API key from `process.env.UNIPILE_API_KEY`

**Query Params Forwarded:**
- `account_id`: Unipile account ID

### 2.5 Response Headers

**Location:** Lines 105-109

```typescript
res.setHeader(
  'Content-Type',
  response.headers['content-type'] || 'image/jpeg'
);
res.setHeader('Cache-Control', 'public, max-age=86400');
```

**Response Body:**
```typescript
res.send(Buffer.from(response.data));
```

**Streams:** Binary data (arraybuffer) directly to browser

### 2.6 Error Handling

**Location:** Lines 112-116

```typescript
catch (err: any) {
  return res
    .status(err.response?.status || 500)
    .json({ error: 'Failed to load media' });
}
```

**Returns:** JSON error response (not binary)

---

## 🔍 STEP 3: DATABASE — ATTACHMENT STORAGE

### 3.1 Schema

**Table:** `public.messages`

**Column:** `attachments` (JSONB)

**Migration:** `20251207000005_linkedin_unipile.sql` (Line 16)

```sql
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
```

### 3.2 Storage Location

**File:** `Converso-backend/src/unipile/linkedinWebhook.4actions.ts` (Line 538)

```typescript
await supabaseAdmin.from('messages').upsert({
  // ... other fields
  attachments: message.attachments || null,
  // ...
});
```

**Source:** Unipile webhook payload (`message.attachments`)

### 3.3 Retrieval

**File:** `Converso-backend/src/api/messages.ts` (Lines 8-16)

```typescript
const { data, error } = await supabaseAdmin
  .from('messages')
  .select('*')
  .eq('conversation_id', conversationId)
  .order('created_at', { ascending: true });
```

**Transformation:** `Converso-backend/src/utils/transformers.ts` (Line 113)

```typescript
attachments: (msg as any).attachments ?? [],
```

**Frontend Receives:** Array of attachment objects with `url`, `name`, `mime_type`, etc.

---

## 🔍 STEP 4: SUPABASE STORAGE CHECK

### 4.1 Is Supabase Storage Used?

**Answer:** ❌ **NO**

**Evidence:**
- No references to `supabase.storage` in attachment flow
- No signed URL generation
- No bucket uploads/downloads
- Direct proxying through backend → Unipile

### 4.2 Storage Mechanism

**Current:** Direct proxy (backend fetches from Unipile → streams to browser)

**No Caching:** Media is fetched on-demand, not stored locally

**No Signed URLs:** URLs are proxied, not rewritten to Supabase Storage URLs

---

## 📊 CALL GRAPH SUMMARY

```
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND: ConversationView.tsx                              │
│                                                             │
│ 1. Render attachment link                                    │
│    └─> getAttachmentUrl(att)                                │
│        └─> Returns: att.url (e.g., "att://...")            │
│                                                             │
│ 2. Build proxied URL                                        │
│    └─> `/api/linkedin/media?url=${encodeURIComponent(url)}` │
│        `&account_id=${conversation.unipile_account_id}`     │
│                                                             │
│ 3. User clicks link                                         │
│    └─> Browser navigates to proxied URL                     │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ BACKEND: linkedin.media.routes.ts                          │
│                                                             │
│ 1. Extract query params                                     │
│    └─> rawUrl = "att://account123/base64..."               │
│    └─> accountId = "unipile_account_456"                    │
│                                                             │
│ 2. Decode att:// reference                                  │
│    └─> Remove "att://" prefix                               │
│    └─> Split by "/" → ["account123", "base64..."]          │
│    └─> Buffer.from(base64, 'base64').toString('utf-8')     │
│        └─> Returns: "https://media.licdn.com/..."          │
│                                                             │
│ 3. Fetch from Unipile                                      │
│    └─> axios.get(decodedUrl, {                             │
│          headers: { 'X-API-KEY': UNIPILE_API_KEY },         │
│          params: { account_id: accountId }                  │
│        })                                                   │
│                                                             │
│ 4. Stream response                                          │
│    └─> res.setHeader('Content-Type', ...)                  │
│    └─> res.send(Buffer.from(response.data))                │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ UNIPILE API                                                 │
│                                                             │
│ Returns: Binary media data (image, PDF, etc.)                │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ BROWSER                                                     │
│                                                             │
│ Displays: Image preview OR downloads file                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🐛 POTENTIAL FAILURE POINTS

### 1. Missing `unipile_account_id`
**Location:** Frontend (ConversationView.tsx:714-715)  
**Symptom:** Raw `att://` URL used directly (not proxied)  
**Result:** Browser cannot resolve `att://` protocol

### 2. Invalid `att://` Format
**Location:** Backend (linkedin.media.routes.ts:37-39)  
**Symptom:** URL doesn't start with `att://`  
**Result:** 400 error: "Invalid attachment reference"

### 3. Malformed Base64
**Location:** Backend (linkedin.media.routes.ts:53-55)  
**Symptom:** `parts.length !== 2` after split  
**Result:** 400 error: "Malformed att reference"

### 4. Invalid Decoded URL
**Location:** Backend (linkedin.media.routes.ts:78-80)  
**Symptom:** Decoded URL doesn't start with `https://`  
**Result:** 400 error: "Invalid decoded media URL"

### 5. Unipile API Failure
**Location:** Backend (linkedin.media.routes.ts:82-91)  
**Symptom:** Unipile returns error (401, 404, 500, etc.)  
**Result:** 500 error: "Failed to load media"

### 6. Missing UNIPILE_API_KEY
**Location:** Backend (linkedin.media.routes.ts:33-35)  
**Symptom:** Environment variable not set  
**Result:** 500 error: "UNIPILE_API_KEY missing"

---

## 📝 FILES INVOLVED

### Frontend
- `Converso-frontend/src/components/Inbox/ConversationView.tsx` (Lines 23-31, 37-56, 686-729)

### Backend
- `Converso-backend/src/routes/linkedin.media.routes.ts` (Full file)
- `Converso-backend/src/routes/index.ts` (Line 49)
- `Converso-backend/src/api/messages.ts` (Lines 8-16)
- `Converso-backend/src/utils/transformers.ts` (Line 113)
- `Converso-backend/src/unipile/linkedinWebhook.4actions.ts` (Line 538)

### Database
- `Converso-frontend/supabase/migrations/20251207000005_linkedin_unipile.sql` (Line 16)

---

## ✅ NEXT STEPS (Phase 1 Complete)

**Phase 1 Status:** ✅ **COMPLETE**

**Deliverables:**
1. ✅ Identified exact click path (frontend)
2. ✅ Identified backend route (`/api/linkedin/media`)
3. ✅ Mapped URL decoding flow
4. ✅ Confirmed Supabase Storage NOT involved
5. ✅ Documented call graph

**Ready for Phase 2:** Debug logging added (see `linkedin.media.routes.ts` with `// AUDIT ONLY` comments)

**Next Phase:** Run attachment click → inspect logs → identify failure point
