# Testing Guide for Converso Application

## Quick Start Testing

### 1. Start Both Servers

**Terminal 1 - Backend:**
```bash
cd Converso-backend
npm run dev
```
Backend should be running on: `http://localhost:3001`

**Terminal 2 - Frontend:**
```bash
cd Converso-frontend
npm run dev
```
Frontend should be running on: `http://localhost:8080`

---

## Testing Methods

### Method 1: Test via Frontend (Easiest)

1. **Open Browser**: Go to `http://localhost:8080`
2. **Login**: Use demo credentials:
   - Admin: `admin@converso.ai` / `admin123`
   - SDR: `sdr@converso.ai` / `sdr123`
3. **Navigate through the app**:
   - Dashboard
   - Email Inbox
   - Conversations
   - Pipeline
   - Team Members
   - Settings

All data will be fetched from your Supabase database through the backend API.

---

### Method 2: Test Backend APIs Directly (Using curl)

#### Health Check
```bash
curl http://localhost:3001/health
```
Expected: `{"status":"ok","message":"Server is running"}`

#### Get All Conversations
```bash
curl "http://localhost:3001/api/conversations?userId=test-user-123&userRole=admin"
```
Note: Replace `test-user-123` with an actual user ID from your Supabase database.

#### Get Pipeline Stages
```bash
curl http://localhost:3001/api/pipeline-stages
```

#### Get Team Members
```bash
curl http://localhost:3001/api/team-members
```

#### Get Connected Accounts
```bash
curl "http://localhost:3001/api/connected-accounts?userId=test-user-123"
```

#### Get Messages for a Conversation
```bash
curl http://localhost:3001/api/messages/conversation/CONVERSATION_ID
```
Replace `CONVERSATION_ID` with an actual conversation ID.

---

### Method 3: Test with Postman or Thunder Client

1. **Import Collection** (create these requests):

#### Base URL: `http://localhost:3001`

#### Requests to Create:

**1. Health Check**
- Method: `GET`
- URL: `http://localhost:3001/health`

**2. Get Conversations**
- Method: `GET`
- URL: `http://localhost:3001/api/conversations`
- Headers:
  - `x-user-id: YOUR_USER_ID`
  - `x-user-role: admin`
- Query Params (optional):
  - `type: email` or `linkedin`

**3. Get Single Conversation**
- Method: `GET`
- URL: `http://localhost:3001/api/conversations/:id`

**4. Assign Conversation**
- Method: `PATCH`
- URL: `http://localhost:3001/api/conversations/:id/assign`
- Body (JSON):
```json
{
  "sdrId": "user-id-here"
}
```

**5. Update Conversation Status**
- Method: `PATCH`
- URL: `http://localhost:3001/api/conversations/:id/status`
- Body (JSON):
```json
{
  "status": "engaged"
}
```

**6. Get Messages**
- Method: `GET`
- URL: `http://localhost:3001/api/messages/conversation/:conversationId`

**7. Send Message**
- Method: `POST`
- URL: `http://localhost:3001/api/messages`
- Headers:
  - `x-user-id: YOUR_USER_ID`
- Body (JSON):
```json
{
  "conversationId": "conv-id",
  "content": "Hello, this is a test message"
}
```

**8. Get Pipeline Stages**
- Method: `GET`
- URL: `http://localhost:3001/api/pipeline-stages`

**9. Create Pipeline Stage**
- Method: `POST`
- URL: `http://localhost:3001/api/pipeline-stages`
- Body (JSON):
```json
{
  "name": "New Stage",
  "description": "Stage description",
  "display_order": 5
}
```

**10. Get Team Members**
- Method: `GET`
- URL: `http://localhost:3001/api/team-members`

---

## Testing Checklist

### ✅ Backend API Tests

- [ ] Health check endpoint works
- [ ] Conversations API returns data
- [ ] Messages API returns data
- [ ] Pipeline stages API returns data
- [ ] Team members API returns data
- [ ] Connected accounts API returns data
- [ ] Create operations work (POST)
- [ ] Update operations work (PATCH/PUT)
- [ ] Delete operations work (DELETE)

### ✅ Frontend Tests

- [ ] Login works with demo credentials
- [ ] Dashboard loads with data
- [ ] Conversations list displays
- [ ] Messages display in conversations
- [ ] Can send messages
- [ ] Pipeline stages display
- [ ] Team members display
- [ ] Connected accounts display
- [ ] All CRUD operations work from UI

---

## Common Issues & Solutions

### Issue: "Cannot GET /api/conversations"
**Solution**: Make sure backend server is running on port 3001

### Issue: "User ID is required"
**Solution**: Add `x-user-id` header or `userId` query parameter

### Issue: Empty data returned
**Solution**: Check if your Supabase database has data in the tables

### Issue: CORS errors
**Solution**: Backend has CORS enabled, but check browser console for specific errors

### Issue: Authentication errors
**Solution**: Make sure you're logged in through the frontend, or provide proper auth headers

---

## Database Testing

To test with real data, make sure your Supabase database has:

1. **Users** in `auth.users` table
2. **Profiles** in `profiles` table
3. **Conversations** in `conversations` table
4. **Messages** in `messages` table
5. **Pipeline Stages** in `pipeline_stages` table
6. **Team Members** (profiles + user_roles)
7. **Connected Accounts** in `connected_accounts` table

---

## Quick Test Script

Save this as `test-api.sh`:

```bash
#!/bin/bash

BASE_URL="http://localhost:3001"
USER_ID="test-user-123"

echo "Testing Health Check..."
curl -s "$BASE_URL/health" | jq .

echo "\nTesting Conversations..."
curl -s "$BASE_URL/api/conversations?userId=$USER_ID&userRole=admin" | jq .

echo "\nTesting Pipeline Stages..."
curl -s "$BASE_URL/api/pipeline-stages" | jq .

echo "\nTesting Team Members..."
curl -s "$BASE_URL/api/team-members" | jq .
```

Run with: `chmod +x test-api.sh && ./test-api.sh`

---

## Browser Testing

1. Open browser DevTools (F12)
2. Go to **Network** tab
3. Interact with the frontend
4. Watch API calls being made
5. Check responses and status codes

---

## Next Steps

Once basic testing passes:
1. Test error scenarios (invalid IDs, missing data)
2. Test authentication/authorization
3. Test edge cases
4. Load testing (if needed)
5. Integration testing

