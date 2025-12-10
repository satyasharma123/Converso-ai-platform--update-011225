# Converso-AI Platform: LinkedIn Integration (as of Dec 2025)

---

## 🏗️ **Overview**

Converso uses Unipile’s API to connect LinkedIn messaging (DMs), contacts, and profiles to Supabase. It provides a full commercial integration that:
- Syncs LinkedIn chats and messages into PostgreSQL (Supabase)
- Correctly maps and upserts LinkedIn identifiers and fields
- (Fallback) Enriches each sender with full LinkedIn profile via Unipile, when IDs are present
- Provides a backend API for frontend use (never queries LinkedIn or Unipile directly from frontend)
- Maps all fields per LinkedIn/Unipile conventions—never relying on internal-only Unipile fields

---

## 🔗 **Sync Architecture (Backend)**

**Key Service Entry Point**: `syncLinkedInAccount(accountId: string, workspaceId?: string)` in `linkedinSync.service.ts`

### 1. **Fetching Chats and Messages**
- **Fetch LinkedIn chats/conversations**:
   - `GET /chats?provider=linkedin&account_id={unipile_account_id}`
   - Returns all inbox conversations for the LinkedIn account.
- **Fetch messages per chat**:
   - `GET /chats/{chat_id}/messages?account_id={unipile_account_id}`
   - Returns messages within the specific LinkedIn chat.

### 2. **Data Mapping**
- **Chat Mapping:**
  - Uses `mapChatToConversation` to convert Unipile chat to Supabase payload.
  - Determines the “other participant” in the chat via `participants.find(p => !p.is_me)`
  - **Stores**:
    - `linkedin_sender_id` := |provider_id| of the other participant (when available) or from `last_message.sender.provider_id`
    - `sender_name` := name/display_name/address of other participant or via enrichment
    - Always writes to `public.conversations` with `conversation_type: 'linkedin'`
- **Message Mapping:**
  - Uses `mapMessageToPayload` to convert each Unipile message to a DB payload
  - **Stores**:
    - `linkedin_sender_id`: |sender_provider_id| (LinkedIn `urn:li:person:...`)—the only true identifier for profile lookup
    - `sender_name`: via enrichment or message fallback
    - `sender_linkedin_url` from profile enrichment
    - `linkedin_message_id` := Unipile's message.id (unique per message, UNIQUE INDEX enforced in DB)
    - Content, timestamps, and direction

### 3. **Upsert Logic**
- **Conversations**: upserted by deterministic UUID
- **Messages**: upserted by `linkedin_message_id` (enforced via UNIQUE INDEX in DB)
- Both use Supabase `.upsert(...)` with `onConflict` as needed

### 4. **Profile Enrichment**
- For each unique sender in incoming messages, backend may enrich data from Unipile’s Users API:
  - **Endpoint:** `GET /api/v1/users/by-identifier/{sender_provider_id}`
  - Extracts sender's name, public LinkedIn profile URL, and more
  - Cached in RAM for the batch run to avoid API rate hits
  - Only possible if `sender_provider_id` field exists in the message!

### 5. **Logging and Debugging**
- All mapping and sync functions log full raw chat/message payloads received from Unipile
- Debug output includes the computed `linkedin_sender_id` and resulting Supabase row payloads
- On upsert error, logs full Supabase response and failed payload

---

## 🗄️ **Supabase Schema Key Fields**

### `conversations` table
| Column                | Purpose                            |
|-----------------------|-------------------------------------|
| id (UUID)             | Primary key, deterministic per chat |
| conversation_type     | 'linkedin' for LinkedIn DMs         |
| sender_name           | Lead or contact name (enriched, fallback, or 'Unknown') |
| linkedin_sender_id    | `urn:li:person:...`                 |
| sender_linkedin_url   | LinkedIn URL from Unipile profile   |

### `messages` table
| Column                | Purpose                            |
|-----------------------|-------------------------------------|
| id (UUID)             | Deterministic per message           |
| conversation_id       | Foreign key to conversations table  |
| linkedin_sender_id    | LinkedIn provider id (crucial)      |
| sender_name           | Name from profile or fallback       |
| sender_linkedin_url   | LinkedIn profile URL (from enrichment, if exists) |
| linkedin_message_id   | The Unipile message.id, uniquely indexed           |
| content               | Body text as stored in Unipile      |
| created_at            | Origin timestamp                    |

---

## ⚡ **Key Implementation Notes**
1. **Do NOT use Unipile sender_id.** Only `sender_provider_id` is valid for LinkedIn profile operations.
2. **If sender_provider_id is missing in Unipile data, enrichment/profile is IMPOSSIBLE.**
3. **The sync process is idempotent.** Upserts avoid duplication and can be run repeatedly as needed.
4. **Conforms to robust logging for all data-in/data-out operations.**

---

## 💡 **Customization/Extensibility**
- If Unipile/LnkedIn APIs expand in the future, mapping code only needs small tweaks.
- Migration scripts provided to add missing indexes or columns; all schema changes are patchable in SQL.
- Strong typing at the mapping layer enables easy code review and extension.

---

## 🧑‍💻 **How to Add New LinkedIn Accounts or Resync**
- Add in Unipile, authorize properly (ensure all permissions are granted for richer metadata)
- Use frontend or CLI to trigger a sync (`syncLinkedInAccount`)
- Backend will fetch all chats and messages since cutoff window, upserting as needed

---

## 🚩 **Caveats and Gotchas**
- If Unipile/LinkedIn API returns empty fields (no `sender_provider_id`), there is no possible way to enrich those messages/profiles; this is an upstream limitation (contact Unipile support in such cases).
- Always check logs for any message marked as having NULL `linkedin_sender_id` or `sender_name: 'Unknown'`. This often means upstream data is missing.
- DN ensure the UNIQUE INDEX on `messages.linkedin_message_id` exists, or upsert will fail.

---

## 📦 **How to Evolve/Extend Next**
- Add webhook support for realtime messaging
- Add daily/grouping counters (DM quota logic)
- Add HTML/attachment support if needed by expanding mapping types
- Normalize profile data for use in UI
- Add UI display of sender enrichment status, error reporting, and troubleshooting for missing Unipile fields

---

## 🚀 **Ready for Production — Provided Upstream Data is Correct**
Any missing sender info is 100% a function of upstream data completeness from Unipile+LinkedIn.

For more debugging or implementation questions, see the logs or contact the lead developer.
