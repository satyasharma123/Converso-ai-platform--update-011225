# Migration Guide: Frontend to Backend API

## Overview
This guide explains how we've migrated the frontend from direct Supabase calls to using the Express backend API.

## Architecture Changes

### Before (Direct Supabase)
```
Frontend → Supabase Client → Supabase Database
```

### After (Backend API)
```
Frontend → API Client → Express Backend → Supabase Database
```

## What Changed

### 1. New API Client Layer
- **Location**: `src/lib/api-client.ts`
- **Purpose**: Handles all HTTP requests to the backend
- **Features**:
  - Automatic auth token injection
  - User context headers (x-user-id, x-user-role)
  - Error handling
  - Configurable base URL via `VITE_API_URL` env variable

### 2. Backend API Service Layer
- **Location**: `src/lib/backend-api.ts`
- **Purpose**: Type-safe API methods that call the Express backend
- **Replaces**: Direct calls to `@/backend/services/*`

### 3. Updated Hooks
All hooks now use the new backend API:
- `useConversations` → uses `conversationsApi`
- `useMessages` → uses `messagesApi`
- `usePipelineStages` → uses `pipelineStagesApi`
- `useTeamMembers` → uses `teamMembersApi`
- `useConnectedAccounts` → uses `connectedAccountsApi`

## Migration Status

✅ **Completed:**
- API client created
- Backend API service layer created
- All hooks migrated to use backend API
- Environment variable support added

⏳ **Still Using Supabase Directly:**
- Authentication (`useAuth.tsx`) - This is intentional for now
- User session management

## How to Start Both Services

### 1. Start Backend Server
```bash
cd Converso-backend
npm install  # First time only
npm run dev
```
Backend runs on: `http://localhost:3001`

### 2. Start Frontend
```bash
cd Converso-frontend
npm install  # First time only
npm run dev
```
Frontend runs on: `http://localhost:8080`

## Environment Variables

Create a `.env` file in `Converso-frontend/`:
```env
VITE_API_URL=http://localhost:3001
```

For production, set this to your deployed backend URL.

## Testing the Migration

1. **Start both servers** (backend and frontend)
2. **Open the frontend** in your browser
3. **Check browser console** for any API errors
4. **Test features:**
   - View conversations
   - Send messages
   - View pipeline stages
   - View team members

## Next Steps

1. **Connect Backend to Real Database**: Update backend routes to use Supabase instead of mock data
2. **Add Authentication Middleware**: Verify JWT tokens in backend
3. **Add Error Handling**: Better error messages and retry logic
4. **Add Request Caching**: Optimize API calls
5. **Add Rate Limiting**: Protect backend from abuse

## Rollback Plan

If you need to rollback:
1. Revert hook imports to use `@/backend/services/*`
2. Remove `src/lib/api-client.ts` and `src/lib/backend-api.ts`
3. Frontend will work with direct Supabase again

## Benefits of This Architecture

1. **Separation of Concerns**: Business logic in backend
2. **Security**: Database credentials only in backend
3. **Scalability**: Can add caching, rate limiting, etc.
4. **Flexibility**: Easy to switch databases or add features
5. **Testing**: Can mock backend for frontend tests

