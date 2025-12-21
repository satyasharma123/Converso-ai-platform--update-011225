# Work Queue API Endpoint Testing Guide

## Endpoint Details

**URL:** `GET /api/conversations/work-queue-view`

**Authentication:** Required (via `optionalAuth` middleware)

**Description:** Read-only endpoint that queries the `conversation_work_queue` SQL view

---

## Query Parameters

### `filter` (optional)
- **Type:** `'all' | 'pending' | 'overdue' | 'idle'`
- **Default:** `'all'`
- **Description:** Filter work queue items by status

**Filter Options:**
- `all` - No additional filter (all conversations in workspace)
- `pending` - Only conversations where `pending_reply = true` (we owe a response)
- `overdue` - Only conversations where `overdue = true` (pending + >24 hours)
- `idle` - Only conversations where `idle_days > 0` (some idle time)

---

## Role-Based Filtering

### Admin Users
- **Access:** All conversations in workspace
- **Filter:** `workspace_id = :workspaceId`

### SDR Users
- **Access:** Only assigned conversations
- **Filter:** `workspace_id = :workspaceId AND assigned_sdr_id = :userId`

---

## Default Sorting

Results are sorted by:
1. `overdue DESC` - Overdue items first
2. `last_inbound_at ASC` - Oldest pending messages first

---

## Example Requests

### 1. Get All Work Queue Items
```bash
curl -X GET "http://localhost:3001/api/conversations/work-queue-view?filter=all" \
  -H "x-user-id: <user-uuid>" \
  -H "x-user-role: admin"
```

### 2. Get Pending Reply Items
```bash
curl -X GET "http://localhost:3001/api/conversations/work-queue-view?filter=pending" \
  -H "x-user-id: <user-uuid>" \
  -H "x-user-role: sdr"
```

### 3. Get Overdue Items
```bash
curl -X GET "http://localhost:3001/api/conversations/work-queue-view?filter=overdue" \
  -H "x-user-id: <user-uuid>" \
  -H "x-user-role: admin"
```

### 4. Get Idle Conversations
```bash
curl -X GET "http://localhost:3001/api/conversations/work-queue-view?filter=idle" \
  -H "x-user-id: <user-uuid>" \
  -H "x-user-role: sdr"
```

---

## Response Format

**Success Response:** JSON array of work queue items

```json
[
  {
    "conversation_id": "uuid",
    "conversation_type": "email",
    "sender_name": "John Doe",
    "sender_email": "john@example.com",
    "sender_linkedin_url": null,
    "subject": "Product inquiry",
    "preview": "I'm interested in...",
    "assigned_sdr_id": "sdr-uuid",
    "custom_stage_id": "stage-uuid",
    "stage_assigned_at": "2024-12-20T10:00:00Z",
    "workspace_id": "workspace-uuid",
    "created_at": "2024-12-15T08:00:00Z",
    "last_message_at": "2024-12-20T10:00:00Z",
    "last_inbound_at": "2024-12-20T10:00:00Z",
    "last_outbound_at": "2024-12-19T16:00:00Z",
    "pending_reply": true,
    "idle_days": 1,
    "overdue": true
  }
]
```

**Error Response:**

```json
{
  "error": "User ID is required"
}
```

```json
{
  "error": "Invalid filter parameter",
  "valid_filters": ["all", "pending", "overdue", "idle"]
}
```

---

## Frontend Integration Example

### Using Axios
```typescript
import axios from 'axios';

// Get all work queue items
const getAllWorkQueue = async () => {
  const response = await axios.get('/api/conversations/work-queue-view', {
    params: { filter: 'all' }
  });
  return response.data;
};

// Get pending items
const getPendingItems = async () => {
  const response = await axios.get('/api/conversations/work-queue-view', {
    params: { filter: 'pending' }
  });
  return response.data;
};

// Get overdue items
const getOverdueItems = async () => {
  const response = await axios.get('/api/conversations/work-queue-view', {
    params: { filter: 'overdue' }
  });
  return response.data;
};
```

### Using React Query
```typescript
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/backend-api';

const useWorkQueue = (filter: 'all' | 'pending' | 'overdue' | 'idle' = 'all') => {
  return useQuery({
    queryKey: ['work-queue', filter],
    queryFn: async () => {
      const response = await apiClient.get('/api/conversations/work-queue-view', {
        params: { filter }
      });
      return response.data;
    }
  });
};

// Usage in component
function WorkQueuePage() {
  const { data: workQueue, isLoading } = useWorkQueue('pending');
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <div>
      {workQueue.map(item => (
        <div key={item.conversation_id}>
          {item.sender_name} - {item.pending_reply ? 'Pending' : 'Done'}
        </div>
      ))}
    </div>
  );
}
```

---

## Testing Checklist

### Basic Functionality
- [ ] Endpoint returns 200 status
- [ ] Response is a JSON array
- [ ] Each item has all required fields

### Filter Tests
- [ ] `filter=all` returns all conversations in workspace
- [ ] `filter=pending` returns only `pending_reply = true`
- [ ] `filter=overdue` returns only `overdue = true`
- [ ] `filter=idle` returns only `idle_days > 0`
- [ ] Invalid filter returns 400 error

### Role-Based Filtering
- [ ] Admin sees all conversations in workspace
- [ ] SDR sees only assigned conversations
- [ ] Workspace isolation enforced

### Sorting
- [ ] Overdue items appear first
- [ ] Within overdue, oldest `last_inbound_at` first
- [ ] Non-overdue items sorted by `last_inbound_at` ASC

### Error Handling
- [ ] Missing user ID returns 400
- [ ] Missing workspace ID returns 400
- [ ] Invalid filter parameter returns 400 with valid options

---

## Performance Considerations

### View Query Performance
- View uses indexes on `conversations` and `messages` tables
- LEFT JOIN ensures all conversations included
- Aggregations computed on-the-fly

### Optimization Tips
1. Use specific filters (`pending`, `overdue`) instead of `all` when possible
2. View queries are read-only and don't lock tables
3. Consider pagination for large datasets (future enhancement)

---

## Comparison: Old vs New Endpoint

### Old Endpoint: `/api/conversations/work-queue`
- Queries `conversations` and `messages` tables directly
- Performs aggregations in Node.js
- More complex logic in application layer

### New Endpoint: `/api/conversations/work-queue-view`
- Queries `conversation_work_queue` view
- Aggregations computed by database
- Simpler application logic
- Better performance for complex queries

---

## Migration Path

### Phase 1: Both Endpoints Available
- Old endpoint: `/api/conversations/work-queue`
- New endpoint: `/api/conversations/work-queue-view`

### Phase 2: Frontend Migration
- Update frontend to use new endpoint
- Test thoroughly

### Phase 3: Deprecate Old Endpoint
- Mark old endpoint as deprecated
- Remove after frontend fully migrated

---

## Troubleshooting

### Issue: Empty Array Returned
**Possible Causes:**
- No conversations in workspace
- SDR has no assigned conversations
- Filter too restrictive

**Solution:** Try `filter=all` first to verify data exists

### Issue: 400 Error - User ID Required
**Cause:** Missing authentication headers

**Solution:** Ensure `x-user-id` header is set

### Issue: 400 Error - Invalid Filter
**Cause:** Typo in filter parameter

**Solution:** Use one of: `all`, `pending`, `overdue`, `idle`

### Issue: View Not Found
**Cause:** Migration not run

**Solution:** Run migration:
```bash
supabase db push
```

---

## Next Steps

1. Run the migration to create the view
2. Test the endpoint with curl/Postman
3. Integrate into frontend Work Queue page
4. Add pagination (future enhancement)
5. Add search functionality (future enhancement)
