# Code Snippets Reference Guide

Quick reference for common code patterns used throughout the project.

---

## Frontend Patterns

### 1. React Query Hook Usage

```typescript
// Fetch data
const { data, isLoading, error } = useQuery({
  queryKey: ['conversations', userId],
  queryFn: async () => {
    return conversationsApi.list();
  },
  enabled: !!userId,
});

// Mutation
const mutation = useMutation({
  mutationFn: async (params) => {
    return apiCall(params);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
    toast.success('Success!');
  },
  onError: (error) => {
    toast.error('Failed!');
  },
});

// Use mutation
mutation.mutate({ conversationId, isRead: true });
```

### 2. Conditional Rendering with Tailwind

```typescript
// Read/unread indicator
{isUnread && (
  <span className="w-1.5 h-1.5 rounded-full bg-foreground flex-shrink-0"></span>
)}

// Conditional classes
<div className={cn(
  "base-class",
  condition && "conditional-class",
  selected && "selected-class"
)}>
```

### 3. State Management Pattern

```typescript
// Multiple related states
const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
const [accountFilter, setAccountFilter] = useState('all');
const [searchQuery, setSearchQuery] = useState('');

// Derived/computed values
const filteredConversations = conversations.filter(conv => {
  const matchesAccount = accountFilter === 'all' || conv.received_on_account_id === accountFilter;
  const matchesSearch = searchQuery === '' || 
    conv.senderName.toLowerCase().includes(searchQuery.toLowerCase());
  return matchesAccount && matchesSearch;
});
```

### 4. useEffect Patterns

```typescript
// Auto-trigger on mount
useEffect(() => {
  if (!user || !connectedAccounts.length) return;
  
  // Do something
  connectedAccounts.forEach(account => {
    initSync.mutate(account.id);
  });
}, [user, connectedAccounts]);

// Timer/cleanup pattern
useEffect(() => {
  if (!conversation.id || conversation.is_read) return;
  
  const timer = setTimeout(() => {
    toggleRead.mutate({ conversationId: conversation.id, isRead: true });
  }, 5000);
  
  return () => clearTimeout(timer);
}, [conversation.id, conversation.is_read]);
```

### 5. API Client Usage

```typescript
// GET request
const data = await apiClient.get<Type>('/api/endpoint');

// POST request
const result = await apiClient.post<Type>('/api/endpoint', { body });

// With error handling
try {
  const data = await apiClient.get('/api/endpoint');
  return data;
} catch (error) {
  console.error('Error:', error);
  throw error;
}
```

### 6. Component Props Pattern

```typescript
// Define interface
interface ComponentProps {
  conversation: {
    id: string;
    senderName: string;
    isRead: boolean;
  };
  onSelect?: (id: string) => void;
}

// Use in component
export function Component({ conversation, onSelect }: ComponentProps) {
  // ...
}
```

### 7. Dropdown Menu Pattern

```typescript
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon">
      <MoreVertical className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={() => handleAction()}>
      <Icon className="h-4 w-4 mr-2" />
      Action Label
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### 8. Scroll Area Pattern

```typescript
<ScrollArea className="flex-1 max-h-[400px]">
  <div className="space-y-3 pr-3">
    {items.map(item => (
      <div key={item.id}>{/* content */}</div>
    ))}
  </div>
</ScrollArea>
```

---

## Backend Patterns

### 1. Express Route Handler

```typescript
router.get(
  '/endpoint',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }
    
    const data = await service.getData(userId);
    res.json({ data });
  })
);
```

### 2. Database Query Pattern

```typescript
// Using supabaseAdmin (bypasses RLS)
const { data, error } = await supabaseAdmin
  .from('table_name')
  .select('*')
  .eq('field', value)
  .order('created_at', { ascending: false });

if (error) throw error;
return data;
```

### 3. Service Layer Pattern

```typescript
// In services/file.ts
export const serviceName = {
  async getData(params: Type): Promise<ReturnType> {
    if (!params.id) {
      throw new Error('ID required');
    }
    
    return apiModule.getData(params.id);
  },
};

// In api/file.ts
export async function getData(id: string): Promise<ReturnType> {
  const { data, error } = await supabaseAdmin
    .from('table')
    .select('*')
    .eq('id', id)
    .single();
    
  if (error) throw error;
  return data;
}
```

### 4. Error Handling Pattern

```typescript
try {
  const result = await apiCall();
  return result;
} catch (error: any) {
  logger.error('Operation failed:', error);
  
  if (error.message?.includes('token')) {
    throw new Error('Token expired, please reconnect');
  }
  
  throw error;
}
```

### 5. Token Refresh Pattern

```typescript
async function refreshToken(account: ConnectedAccount): Promise<TokenData> {
  try {
    // Refresh logic
    const newTokens = await oauthClient.refreshToken(account.refresh_token);
    
    // Update in database
    await supabaseAdmin
      .from('connected_accounts')
      .update({
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token || account.refresh_token,
        expires_at: newTokens.expires_at,
      })
      .eq('id', account.id);
    
    return newTokens;
  } catch (error) {
    throw new Error('Failed to refresh token');
  }
}
```

### 6. Email Body Fetching Pattern

```typescript
async function fetchEmailBody(
  conversationId: string,
  messageId: string,
  account: ConnectedAccount
): Promise<string> {
  // Determine provider
  const isGmail = account.oauth_provider === 'google';
  const isOutlook = account.oauth_provider === 'microsoft';
  
  // Fetch body
  const body = isGmail
    ? await fetchGmailEmailBody(account, messageId)
    : await fetchOutlookEmailBody(account, messageId);
  
  // Store in database
  await supabaseAdmin
    .from('messages')
    .update({ email_body: body })
    .eq('id', messageId);
  
  return body;
}
```

---

## Database Patterns

### 1. Join Query Pattern

```typescript
const { data } = await supabaseAdmin
  .from('conversations')
  .select(`
    *,
    received_account:connected_accounts(
      account_name,
      account_email,
      account_type
    )
  `)
  .eq('workspace_id', workspaceId);
```

### 2. Update Pattern

```typescript
const { error } = await supabaseAdmin
  .from('table_name')
  .update({
    field1: newValue1,
    field2: newValue2,
  })
  .eq('id', recordId);

if (error) throw error;
```

### 3. Insert Pattern

```typescript
const { data, error } = await supabaseAdmin
  .from('table_name')
  .insert({
    field1: value1,
    field2: value2,
  })
  .select()
  .single();

if (error) throw error;
return data;
```

---

## Styling Patterns

### 1. Fixed Width Layout

```typescript
<div className="h-[calc(100vh-100px)] overflow-hidden flex">
  {/* Sidebar */}
  <div className="w-[200px] border-r">...</div>
  
  {/* Main Content */}
  <div className="flex-1 min-w-0">...</div>
  
  {/* Drawer */}
  <div className="w-[340px] border-l">...</div>
</div>
```

### 2. Collapsible Sidebar

```typescript
const [isCollapsed, setIsCollapsed] = useState(false);

<div className={cn(
  "transition-all duration-300",
  isCollapsed ? "w-[60px]" : "w-[200px]"
)}>
  {/* Content */}
</div>
```

### 3. Sliding Drawer

```typescript
const [isOpen, setIsOpen] = useState(false);

<div className={cn(
  "absolute right-0 top-0 h-full transition-transform duration-300",
  isOpen ? "translate-x-0" : "translate-x-full"
)} style={{ width: '340px' }}>
  {/* Drawer Content */}
</div>
```

### 4. Truncation Pattern

```typescript
// Text truncation
<p className="truncate">{longText}</p>

// Multi-line truncation
<p className="line-clamp-2">{longText}</p>

// With break words
<div className="break-words max-w-full">{text}</div>
```

### 5. Read/Unread Indicator

```typescript
// Unread dot
{!conversation.isRead && (
  <span className="w-1.5 h-1.5 rounded-full bg-foreground"></span>
)}

// Bold for unread
<span className={cn(
  "text-sm",
  !conversation.isRead && "font-bold"
)}>
  {conversation.senderName}
</span>
```

---

## Common Utilities

### 1. Format Time Ago

```typescript
function formatTimeAgo(date: string): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffDays}d`;
}
```

### 2. Get Initials

```typescript
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
```

### 3. Transform Data

```typescript
function transformConversation(conv: any): Conversation {
  return {
    id: conv.id,
    senderName: conv.sender_name,
    senderEmail: conv.sender_email,
    isRead: conv.is_read,
    // ... more fields
  };
}
```

---

## Testing Patterns

### 1. Component Testing Setup

```typescript
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

function renderWithProviders(ui: ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}
```

### 2. Mock API Calls

```typescript
jest.mock('@/lib/backend-api', () => ({
  conversationsApi: {
    list: jest.fn().mockResolvedValue([]),
  },
}));
```

---

**Remember:** Always check existing code for patterns before creating new ones. Consistency is key!

---

**Last Updated:** November 30, 2025
