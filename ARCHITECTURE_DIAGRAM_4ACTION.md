# LinkedIn 4-Action Sync - Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interface (React)                    │
│  ┌──────────────┐  ┌────────────────┐  ┌────────────────────┐ │
│  │   Settings   │  │ LinkedIn Inbox │  │ Conversation View  │ │
│  │ Connect Acct │  │ (Convos List)  │  │  (Messages View)   │ │
│  └──────┬───────┘  └────────┬───────┘  └─────────┬──────────┘ │
└─────────┼───────────────────┼────────────────────┼─────────────┘
          │                   │                    │
          │ OAuth Flow        │ Fetch Data         │ Send/Receive
          ▼                   ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Backend API (Express)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────┐     ┌──────────────────────────────┐ │
│  │ LinkedIn OAuth      │     │  Sync API Endpoints           │ │
│  │ Routes              │     │  /api/linkedin/sync/*         │ │
│  │                     │     │  - /full (all 4 actions)      │ │
│  │ - start-auth        │────▶│  - /action1 (chats)           │ │
│  │ - auth-callback     │     │  - /action2 (senders)         │ │
│  │   • Creates account │     │  - /action3 (pictures)        │ │
│  │   • Triggers sync ──┼────▶│  - /action4 (messages)        │ │
│  └─────────────────────┘     │  - /resume                    │ │
│                               │  - /status                    │ │
│  ┌─────────────────────┐     └───────────┬──────────────────┘ │
│  │ Webhook Endpoint    │                 │                     │
│  │ /api/linkedin/      │                 │                     │
│  │ webhook             │                 │                     │
│  │                     │                 │                     │
│  │ - Receives events   │                 │                     │
│  │ - Verifies sig      │                 │                     │
│  │ - Incremental sync ─┼─────────────────┘                     │
│  └─────────────────────┘                                       │
│           │                                                     │
│           ▼                                                     │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │        LinkedIn Sync Service (4 Actions)                 │ │
│  │        linkedinSync.4actions.ts                          │ │
│  │                                                           │ │
│  │  ┌────────────────────────────────────────────────────┐ │ │
│  │  │ Action 1: syncLinkedInChatsForAccount()            │ │ │
│  │  │ • GET /chats?account_id={id}                       │ │ │
│  │  │ • Upsert conversations with chat_id                │ │ │
│  │  │ • Store sender_attendee_id                         │ │ │
│  │  │ • Set tracking flags to false                      │ │ │
│  │  └────────────────────────────────────────────────────┘ │ │
│  │           │                                               │ │
│  │           ▼                                               │ │
│  │  ┌────────────────────────────────────────────────────┐ │ │
│  │  │ Action 2: enrichLinkedInSendersFromAttendees()     │ │ │
│  │  │ • Query convos where sender_enriched = false       │ │ │
│  │  │ • GET /chat_attendees/{id} for each               │ │ │
│  │  │ • Update sender_name, sender_linkedin_url          │ │ │
│  │  │ • Set sender_enriched = true                       │ │ │
│  │  └────────────────────────────────────────────────────┘ │ │
│  │           │                                               │ │
│  │           ▼                                               │ │
│  │  ┌────────────────────────────────────────────────────┐ │ │
│  │  │ Action 3: enrichLinkedInSenderPictures()           │ │ │
│  │  │ • Query convos where picture_enriched = false      │ │ │
│  │  │ • GET /chat_attendees/{id}/picture for each       │ │ │
│  │  │ • Store sender_profile_picture_url                 │ │ │
│  │  │ • Set picture_enriched = true                      │ │ │
│  │  └────────────────────────────────────────────────────┘ │ │
│  │           │                                               │ │
│  │           ▼                                               │ │
│  │  ┌────────────────────────────────────────────────────┐ │ │
│  │  │ Action 4: syncLinkedInMessagesForAccount()         │ │ │
│  │  │ • Query convos where initial_sync_done = false     │ │ │
│  │  │ • GET /chats/{id}/messages for each               │ │ │
│  │  │ • Use cached sender data from conversation         │ │ │
│  │  │ • Ensure sender_name NEVER null                    │ │ │
│  │  │ • Upsert messages with linkedin_message_id         │ │ │
│  │  │ • Set initial_sync_done = true                     │ │ │
│  │  └────────────────────────────────────────────────────┘ │ │
│  │                                                           │ │
│  └───────────────────────┬───────────────────────────────────┘ │
│                          │                                     │
│                          │ Calls Unipile APIs                  │
│                          ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Unipile Client (unipileClient.ts)                       │ │
│  │  • Rate limiter (60 req/min, 300ms gap)                  │ │
│  │  • Retry logic for 429 errors                            │ │
│  │  • Automatic backoff                                     │ │
│  └────────────────────────┬─────────────────────────────────┘ │
└───────────────────────────┼───────────────────────────────────┘
                            │
                            │ HTTPS Requests
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Unipile API (api23.unipile.com)              │
├─────────────────────────────────────────────────────────────────┤
│  GET  /chats?account_id={id}                                    │
│  GET  /chats/{chat_id}/messages?account_id={id}                │
│  GET  /chat_attendees/{attendee_id}                            │
│  GET  /chat_attendees/{attendee_id}/picture                    │
│  POST /chats/{chat_id}/messages (send message)                 │
│                                                                  │
│  Webhooks sent to: /api/linkedin/webhook                       │
│  • message.created                                              │
│  • message.updated                                              │
│  • chat.updated                                                 │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          │ Connects to
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     LinkedIn (linkedin.com)                      │
│  • LinkedIn Direct Messages                                     │
│  • Profile Data                                                 │
│  • Real-time notifications                                      │
└─────────────────────────────────────────────────────────────────┘

                            ▲
                            │ Reads/Writes
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Supabase Database                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ conversations table                                         ││
│  │ ┌─────────────────────────────────────────────────────────┐││
│  │ │ • id (uuid, PK)                                          │││
│  │ │ • conversation_type ('linkedin')                         │││
│  │ │ • provider ('linkedin')                                  │││
│  │ │ • chat_id (TEXT, UNIQUE) ← Unipile chat ID              │││
│  │ │ • sender_attendee_id ← Unipile attendee ID              │││
│  │ │ • sender_name ← From Action 2                           │││
│  │ │ • sender_linkedin_url ← From Action 2                   │││
│  │ │ • sender_profile_picture_url ← From Action 3            │││
│  │ │ • linkedin_sender_id ← LinkedIn provider ID             │││
│  │ │ • provider_member_urn ← LinkedIn member URN             │││
│  │ │ • last_message_at                                        │││
│  │ │ • received_on_account_id (FK)                           │││
│  │ │ • workspace_id (FK)                                      │││
│  │ │ • initial_sync_done (BOOLEAN) ← Action 4 tracking       │││
│  │ │ • sender_enriched (BOOLEAN) ← Action 2 tracking         │││
│  │ │ • picture_enriched (BOOLEAN) ← Action 3 tracking        │││
│  │ └─────────────────────────────────────────────────────────┘││
│  └────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ messages table                                              ││
│  │ ┌─────────────────────────────────────────────────────────┐││
│  │ │ • id (uuid, PK)                                          │││
│  │ │ • conversation_id (FK to conversations.id)               │││
│  │ │ • message_type ('linkedin')                              │││
│  │ │ • linkedin_message_id (TEXT, UNIQUE)                     │││
│  │ │ • sender_attendee_id                                     │││
│  │ │ • sender_name (NOT NULL!) ← Never null!                 │││
│  │ │ • sender_linkedin_url                                    │││
│  │ │ • content (TEXT)                                         │││
│  │ │ • created_at (timestamptz)                               │││
│  │ │ • is_from_lead (BOOLEAN)                                 │││
│  │ │ • attachments (JSONB)                                    │││
│  │ │ • reactions (JSONB)                                      │││
│  │ │ • provider ('linkedin')                                  │││
│  │ └─────────────────────────────────────────────────────────┘││
│  └────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ connected_accounts table                                    ││
│  │ • id (uuid, PK)                                             ││
│  │ • account_type ('linkedin')                                 ││
│  │ • unipile_account_id ← Unipile account ID                  ││
│  │ • workspace_id (FK)                                         ││
│  │ • last_synced_at                                            ││
│  │ • sync_status ('success'/'error'/'syncing')                ││
│  │ • sync_error                                                ││
│  └────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagrams

### Initial Sync Flow (On Account Connect)

```
User Connects LinkedIn
        │
        ▼
    [OAuth Flow]
        │
        ▼
    Create/Update
    connected_accounts
        │
        ▼
  ┌─────────────────┐
  │   ACTION 1      │  GET /chats → Store in conversations
  │   Download      │  (initial_sync_done = false)
  │   Chats         │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │   ACTION 2      │  GET /chat_attendees/{id} → Update sender_name
  │   Enrich        │  (sender_enriched = true)
  │   Senders       │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │   ACTION 3      │  GET /chat_attendees/{id}/picture → Update picture
  │   Enrich        │  (picture_enriched = true)
  │   Pictures      │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │   ACTION 4      │  GET /chats/{id}/messages → Insert messages
  │   Download      │  (initial_sync_done = true, sender_name never null)
  │   Messages      │
  └────────┬────────┘
           │
           ▼
    Update sync_status
    last_synced_at
```

### Incremental Sync Flow (Webhook)

```
New LinkedIn Message
        │
        ▼
Unipile Webhook Event
        │
        ▼
[Verify Signature]
        │
        ▼
Find connected_account
   by unipile_account_id
        │
        ▼
Check if conversation exists
        │
    ┌───┴───┐
    │       │
    NO     YES
    │       │
    ▼       ▼
  Create  Use cached
   new    sender data
 convo
    │       │
    │       ▼
    │   Fetch new
    │   messages
    │       │
    └───┬───┘
        │
        ▼
  Insert messages
  (sender_name = cached or "You")
        │
        ▼
  Update last_message_at
```

### Sender Name Resolution (Action 4)

```
For each message:
        │
        ▼
  Is message.is_sender?
        │
    ┌───┴───┐
   YES     NO
    │       │
    ▼       ▼
  "You"  conversation.sender_name
    │       │
    └───┬───┘
        │
        ▼
  Is sender_name null?
        │
    ┌───┴───┐
   YES     NO
    │       │
    ▼       │
"LinkedIn   │
 Contact"   │
    │       │
    └───┬───┘
        │
        ▼
  Insert with sender_name
  (NEVER NULL!)
```

## Component Interactions

```
┌──────────────────────────────────────────────────────────────┐
│                     Frontend Components                       │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  LinkedInInbox.tsx                                           │
│    ├─ Fetches conversations (conversation_type='linkedin')   │
│    ├─ Displays sender_name, sender_profile_picture_url      │
│    └─ Shows last_message_at                                  │
│                                                               │
│  ConversationView.tsx                                        │
│    ├─ Fetches messages (message_type='linkedin')            │
│    ├─ Displays sender_name (never null!)                    │
│    └─ Shows message content, timestamp                       │
│                                                               │
│  Settings.tsx                                                │
│    ├─ Connect LinkedIn button                                │
│    └─ Triggers OAuth flow                                    │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

## File Structure

```
Converso-AI-Platform/
├── Converso-backend/
│   └── src/
│       ├── unipile/
│       │   ├── linkedinSync.4actions.ts        ← 4 action functions
│       │   ├── linkedinWebhook.4actions.ts     ← Webhook handler
│       │   ├── unipileClient.ts                ← Rate limiter
│       │   ├── linkedinConversationMapper.ts   ← Type definitions
│       │   └── linkedinMessageMapper.ts        ← Message mapping
│       └── routes/
│           ├── linkedin.sync.routes.ts         ← Sync API endpoints
│           ├── linkedinWebhook.routes.ts       ← Webhook endpoint
│           ├── linkedin.accounts.routes.ts     ← OAuth & accounts
│           └── index.ts                        ← Route registration
│
├── Converso-frontend/
│   └── supabase/
│       └── migrations/
│           └── 20251208000008_add_sync_tracking_columns.sql
│
└── Documentation/
    ├── IMPLEMENTATION_SUMMARY_4ACTION_SYNC.md
    ├── LINKEDIN_4ACTION_SYNC_DOCUMENTATION.md
    ├── LINKEDIN_4ACTION_QUICKSTART.md
    ├── QUICK_REFERENCE_4ACTION.md
    ├── ARCHITECTURE_DIAGRAM_4ACTION.md         ← This file
    └── test-linkedin-4action-sync.sh           ← Test script
```

## Key Design Decisions

1. **Sequential Actions**: Each action builds on the previous one's data
2. **Tracking Flags**: Database tracks completion of each action independently
3. **Cached Sender Data**: Conversations table caches sender info for efficiency
4. **Never Null**: Multiple fallback layers ensure sender_name is never null
5. **Resumable**: Can restart from any action if interrupted
6. **Rate Limited**: Built-in protection against API rate limits
7. **Webhook Optimization**: Uses cached data to avoid repeated API calls

## Security Considerations

- Webhook signature verification with HMAC-SHA256
- OAuth flow unchanged (proven security)
- API key stored in environment variables
- Rate limiting prevents abuse
- Input validation on all endpoints

## Performance Optimizations

- Conversation-level caching of sender data
- In-memory attendee cache for webhooks
- Batch operations with upsert
- Indexed database columns for fast queries
- Rate limiter prevents API throttling

---

This architecture ensures reliable, efficient, and scalable LinkedIn DM synchronization with Unipile.
