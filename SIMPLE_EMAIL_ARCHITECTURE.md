# Simple Email Architecture - Clean Slate

## Current Problem

1. **Conversations without messages** - Can't determine folder
2. **Wrong sender/recipient logic** - Sent emails showing as received
3. **Over-complicated folder derivation** - Too many layers

## Simple Solution

### Architecture Rules (KISS Principle)

**ONE SIMPLE RULE:**
- **1 Email = 1 Conversation = 1 Message**
- Message has `provider_folder` (inbox/sent/deleted)
- Conversation's folder = its message's `provider_folder`

### Data Model

```sql
-- conversations table (metadata only)
{
  id: uuid,
  conversation_type: 'email',
  subject: string,
  sender_name: string,
  sender_email: string,
  received_on_account_id: uuid,  -- Which account received/sent this
  workspace_id: uuid
}

-- messages table (the actual email)
{
  id: uuid,
  conversation_id: uuid,
  provider: 'gmail' | 'outlook',
  provider_folder: 'inbox' | 'sent' | 'deleted' | 'archive',
  sender_email: string,
  html_body: string,
  text_body: string,
  is_from_lead: boolean  -- false for sent emails
}
```

### Sync Logic (SIMPLE)

```typescript
// For each email from Gmail/Outlook API:

1. Determine folder from API response
   - Gmail: labels contain 'SENT' → 'sent'
   - Gmail: labels contain 'INBOX' → 'inbox'
   - Outlook: from SentItems folder → 'sent'
   - Outlook: from Inbox folder → 'inbox'

2. Create conversation (if not exists)
   - Use email's subject, sender, recipient

3. Create message
   - Store provider_folder from step 1
   - Set is_from_lead = (folder !== 'sent')
   - Store email body

4. Done. No complex logic.
```

### Display Logic (SIMPLE)

```typescript
// Get emails for a folder:

SELECT c.*, m.provider_folder, m.html_body
FROM conversations c
JOIN messages m ON c.id = m.conversation_id
WHERE c.conversation_type = 'email'
  AND m.provider_folder = 'inbox'  -- or 'sent', 'deleted'
ORDER BY c.created_at DESC

// That's it. No derivation, no priority rules.
```

### Send Email Logic (SIMPLE)

```typescript
// When user sends email:

1. Send via Gmail/Outlook API
2. DON'T create local conversation/message
3. Wait for next sync
4. Sync will fetch it from 'Sent' folder
5. Done.
```

## Implementation Plan

### Step 1: Clean Database

```sql
-- Delete all email conversations (they're broken anyway)
DELETE FROM messages WHERE provider IN ('gmail', 'outlook');
DELETE FROM conversations WHERE conversation_type = 'email';
```

### Step 2: Fix Email Sync Service

File: `Converso-backend/src/services/emailSync.ts`

**Current Problem:** Creates conversations without proper message linking

**Fix:** Simplify to:
1. Fetch emails from provider
2. For each email:
   - Get folder from API response
   - Create conversation
   - Create message with provider_folder
   - Done

### Step 3: Fix API Query

File: `Converso-backend/src/api/conversations.ts`

**Current Problem:** Complex folder derivation with 0 messages

**Fix:** Simple JOIN query:
```typescript
const { data } = await supabaseAdmin
  .from('conversations')
  .select(`
    *,
    messages!inner(provider_folder, html_body, text_body)
  `)
  .eq('conversation_type', 'email')
  .eq('messages.provider_folder', folder)  // Direct filter
  .order('created_at', { ascending: false });
```

### Step 4: Test

1. Delete old data
2. Reconnect email accounts
3. Wait for sync
4. Check folders - should work

## Why This Works

- **No complex logic** - Just store what provider tells us
- **No derivation** - Folder comes from provider
- **No edge cases** - One email = one message = one folder
- **LinkedIn safe** - Only touches `provider IN ('gmail', 'outlook')`

## Files to Change

1. `Converso-backend/src/services/emailSync.ts` - Simplify sync
2. `Converso-backend/src/api/conversations.ts` - Simple JOIN query
3. Database - Clean slate (delete old data)

That's it. No more complexity.
