# URL-Based State Persistence Guide

## Overview

This guide documents the URL-based state persistence system implemented across the Converso AI Platform. The system enables filters, tabs, and search inputs to persist across page refreshes and enables deep linking.

## Architecture

### Design Principles

1. **Path params → Structural state**
   - `folder`, `conversationId`, `pipelineId`, etc.
   - Example: `/inbox/email/sent/conv_123`

2. **Search params → UI state**
   - Filters, tabs, search, view modes
   - Example: `/inbox/email/inbox?tab=unread&sdr=john&q=urgent`

3. **URL is the source of truth**
   - State hydrates from URL on load
   - State writes back to URL on change

4. **Defaults don't pollute URL**
   - Only non-default values appear in URL
   - `?tab=all` is omitted (default)
   - `?tab=unread` is included (non-default)

## Core Hook: `useUrlState`

### Location
`src/hooks/useUrlState.ts`

### API

```typescript
const urlState = useUrlState<{
  tab: string;
  account: string;
  sdr: string;
  stage: string;
  q: string;
}>();

// Get value from URL
const tab = urlState.get("tab", "all"); // Returns "all" if not in URL

// Set values in URL (non-default values only)
urlState.set({
  tab: tabValue !== "all" ? tabValue : undefined,
  account: accountFilter !== "all" ? accountFilter : undefined,
  q: searchQuery || undefined,
});
```

### Features

- **Automatic cleanup**: `undefined`, `null`, `""`, and `"all"` values are removed from URL
- **Replace by default**: Uses `replace: true` to avoid polluting browser history
- **Type-safe**: Generic type parameter for autocomplete

## Implementation Pattern

### Step 1: Import the hook

```typescript
import { useUrlState } from "@/hooks/useUrlState";
```

### Step 2: Initialize with type

```typescript
const urlState = useUrlState<{
  tab: string;
  account: string;
  q: string;
}>();
```

### Step 3: Hydrate state from URL (once on mount)

```typescript
useEffect(() => {
  setTabValue(urlState.get("tab", "all") as 'all' | 'unread' | 'favorites');
  setAccountFilter(urlState.get("account", "all"));
  setSearchQuery(urlState.get("q", ""));
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

**Important**: This runs once on mount and does NOT overwrite user interactions later.

### Step 4: Sync UI state → URL

```typescript
useEffect(() => {
  urlState.set({
    tab: tabValue !== "all" ? tabValue : undefined,
    account: accountFilter !== "all" ? accountFilter : undefined,
    q: searchQuery || undefined,
  });
}, [tabValue, accountFilter, searchQuery, urlState]);
```

**Important**: Only include non-default values to keep URLs clean.

## Reference Implementation: Email Inbox

### File
`src/pages/EmailInbox.tsx`

### State Persisted

| State | URL Param | Default | Example |
|-------|-----------|---------|---------|
| Tab | `tab` | `all` | `?tab=unread` |
| Account Filter | `account` | `all` | `?account=acc_123` |
| SDR Filter | `sdr` | `all` | `?sdr=john_id` |
| Stage Filter | `stage` | `all` | `?stage=qualified` |
| Search Query | `q` | `""` | `?q=urgent` |

### Example URLs

```
/inbox/email/inbox
/inbox/email/inbox?tab=unread
/inbox/email/sent?q=proposal
/inbox/email/inbox?tab=favorites&sdr=john_id&stage=qualified
```

## Rollout to Other Modules

### LinkedIn Inbox

**State to persist:**
- `tab` (all, unread, favorites)
- `account` (account filter)
- `q` (search query)

**Implementation:**
```typescript
const urlState = useUrlState<{
  tab: string;
  account: string;
  q: string;
}>();
```

### Sales Pipeline

**State to persist:**
- `assignedTo` (team member filter)
- `channelType` (email, linkedin, all)
- `search` (search query)
- `dateFrom` / `dateTo` (date range)

**Implementation:**
```typescript
const urlState = useUrlState<{
  assignedTo: string;
  channelType: string;
  search: string;
  dateFrom: string;
  dateTo: string;
}>();
```

**Note**: Dates should be serialized as ISO strings.

### Work Queue

**State to persist:**
- `status` (pending, overdue, idle, all)
- `priority` (high, medium, low, all)
- `assignee` (team member filter)

**Implementation:**
```typescript
const urlState = useUrlState<{
  status: string;
  priority: string;
  assignee: string;
}>();
```

### Analytics

**State to persist:**
- `range` (7d, 30d, 90d, custom)
- `metric` (conversations, response_time, conversion)
- `groupBy` (day, week, month)

**Implementation:**
```typescript
const urlState = useUrlState<{
  range: string;
  metric: string;
  groupBy: string;
}>();
```

## Best Practices

### 1. Default Values

Always define clear defaults and exclude them from URL:

```typescript
// ✅ Good
urlState.set({
  tab: tabValue !== "all" ? tabValue : undefined,
});

// ❌ Bad - pollutes URL with defaults
urlState.set({
  tab: tabValue,
});
```

### 2. Hydration Timing

Hydrate once on mount, not on every URL change:

```typescript
// ✅ Good - runs once
useEffect(() => {
  setState(urlState.get("key", "default"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

// ❌ Bad - overwrites user interactions
useEffect(() => {
  setState(urlState.get("key", "default"));
}, [urlState]);
```

### 3. Type Safety

Use TypeScript generics for autocomplete:

```typescript
// ✅ Good
const urlState = useUrlState<{
  tab: 'all' | 'unread' | 'favorites';
  account: string;
}>();

// ❌ Bad - no autocomplete
const urlState = useUrlState();
```

### 4. Backward Compatibility

Always provide defaults for missing params:

```typescript
// ✅ Good - works if param is missing
const tab = urlState.get("tab", "all");

// ❌ Bad - breaks if param is missing
const tab = urlState.get("tab");
```

## Testing Checklist

When implementing URL state persistence:

- [ ] Refresh preserves filters
- [ ] Deep links work (e.g., `?tab=unread&sdr=john`)
- [ ] Default values don't appear in URL
- [ ] Back/forward buttons work correctly
- [ ] No infinite loops or re-renders
- [ ] No breaking changes to existing API calls
- [ ] No breaking changes to data fetching logic

## Migration Notes

### Existing localStorage Patterns

If a module already uses localStorage for filters (e.g., Sales Pipeline), you can:

1. **Keep localStorage for UI preferences** (sidebar collapse, column widths)
2. **Move filters to URL** for shareability and refresh persistence
3. **Migrate gradually** - URL takes precedence over localStorage

Example:
```typescript
// Hydrate from URL first, then localStorage as fallback
useEffect(() => {
  const urlTab = urlState.get("tab");
  const storedTab = localStorage.getItem("tab");
  setTab(urlTab || storedTab || "all");
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

## Troubleshooting

### Issue: Infinite re-render loop

**Cause**: `urlState` object changes on every render, triggering effect.

**Solution**: Use primitive values in dependency array:
```typescript
// ❌ Bad
useEffect(() => {
  urlState.set({ tab });
}, [tab, urlState]); // urlState changes every render

// ✅ Good
useEffect(() => {
  urlState.set({ tab });
}, [tab]); // Only tab in dependencies
```

### Issue: URL updates too frequently

**Cause**: Debounce not applied to search input.

**Solution**: Debounce search input before syncing to URL:
```typescript
const [searchQuery, setSearchQuery] = useState("");
const [debouncedSearch, setDebouncedSearch] = useState("");

useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedSearch(searchQuery);
  }, 300);
  return () => clearTimeout(timer);
}, [searchQuery]);

useEffect(() => {
  urlState.set({ q: debouncedSearch || undefined });
}, [debouncedSearch]);
```

### Issue: State resets on navigation

**Cause**: Hydration effect runs on every navigation.

**Solution**: Use empty dependency array to run once:
```typescript
useEffect(() => {
  // Hydrate from URL
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // Empty array = run once
```

## Future Enhancements

1. **URL state serialization** - Support for complex objects (dates, arrays)
2. **URL state compression** - Shorter URLs for complex filters
3. **URL state validation** - Validate params against schema
4. **URL state history** - Track filter history for analytics

## Support

For questions or issues with URL state persistence:
1. Check this guide first
2. Review the Email Inbox reference implementation
3. Test with the provided checklist
4. Document any new patterns discovered
