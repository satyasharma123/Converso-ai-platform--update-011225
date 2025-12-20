# SDRXS Testing Guide - Quick Reference

## 🚀 Quick Start

### 1. Apply Database Migration
```bash
cd Converso-frontend
npx supabase migration up
```

Or manually apply the migration file:
```bash
psql -h <your-db-host> -U postgres -d postgres -f supabase/migrations/20251219000003_create_conversation_user_state.sql
```

### 2. Restart Servers
```bash
# Terminal 1 - Backend
cd Converso-backend
npm run dev

# Terminal 2 - Frontend  
cd Converso-frontend
npm run dev
```

### 3. Open Application
```
http://localhost:5173
```

---

## 📋 Test Checklist

### Test 1: SDR with Zero Assignments

**Login as:** SDR user with no assigned conversations

**Expected Behavior:**
- ✅ Email Inbox: Shows "No assigned conversations" (NOT "Connect Email")
- ✅ LinkedIn Inbox: Shows "No assigned conversations"
- ✅ Inbox count = 0
- ✅ Sent count = 0
- ✅ Favorites tab = empty
- ✅ Unread tab = empty
- ✅ No "Assign to SDR" option visible anywhere
- ✅ Cannot access Settings → Pipeline/Workspace/Rules tabs

**How to Test:**
1. Login as SDR user
2. Navigate to Email Inbox
3. Verify empty state message
4. Navigate to LinkedIn Inbox
5. Verify empty state message
6. Check folder counts (should all be 0)
7. Try to access Settings tabs (should redirect to Profile)

---

### Test 2: SDR with Assigned Conversations

**Setup:**
1. Login as Admin
2. Assign 2 conversations to SDR user
3. Logout and login as SDR

**Expected Behavior:**
- ✅ SDR sees EXACTLY 2 conversations (no more, no less)
- ✅ Cannot see unassigned conversations
- ✅ Cannot see conversations assigned to others
- ✅ Can mark conversations as favorite (independent from Admin)
- ✅ Can mark conversations as unread (independent from Admin)
- ✅ Can edit lead profile fields
- ✅ Can move pipeline stage
- ✅ Cannot assign/reassign conversations
- ✅ Folder counts reflect only assigned conversations

**How to Test:**
1. As Admin: Assign 2 conversations to SDR
2. Logout, login as SDR
3. Count visible conversations (should be exactly 2)
4. Try to find unassigned conversations (should not exist)
5. Click on conversation → verify can edit lead fields
6. Click on conversation → verify can change stage
7. Look for "Assign to SDR" option (should not exist)
8. Check folder counts (should reflect only assigned)

---

### Test 3: Data Isolation (Favorites & Unread)

**Setup:**
1. Have 1 conversation assigned to SDR
2. Login as Admin

**Test Scenario A: Admin Favorites Don't Affect SDR**
1. As Admin: Mark conversation as favorite (⭐)
2. Logout, login as SDR
3. ✅ Verify conversation is NOT favorite for SDR
4. As SDR: Mark conversation as favorite
5. Logout, login as Admin
6. ✅ Verify Admin's favorite state unchanged

**Test Scenario B: Unread State is Independent**
1. As Admin: Mark conversation as unread
2. Logout, login as SDR
3. ✅ Verify conversation is still read for SDR
4. As SDR: Mark conversation as unread
5. Logout, login as Admin
6. ✅ Verify Admin's read state unchanged

---

### Test 4: Admin Full Access

**Login as:** Admin user

**Expected Behavior:**
- ✅ Sees ALL workspace conversations (assigned + unassigned)
- ✅ Can assign/reassign conversations
- ✅ "Assign to SDR" visible in:
  - Conversation kebab menu
  - Bulk actions dropdown
  - Lead profile panel
- ✅ Can access all Settings tabs (Profile, Pipeline, Workspace, Rules)
- ✅ Folder counts include all workspace conversations
- ✅ Favorites/unread independent from SDR users

**How to Test:**
1. Login as Admin
2. Verify can see all conversations (including unassigned)
3. Click conversation → verify "Assign to SDR" dropdown visible
4. Select multiple conversations → verify bulk "Assign to SDR" visible
5. Navigate to Settings → verify all tabs accessible
6. Check folder counts (should be total workspace counts)

---

### Test 5: Assignment Controls Hidden for SDR

**Login as:** SDR user

**Check These Locations:**
- ✅ Conversation kebab menu (⋮) → No "Assign to SDR" option
- ✅ Bulk actions dropdown → No "Assign to SDR" submenu
- ✅ Lead profile panel → SDR dropdown is read-only or hidden
- ✅ Settings → Cannot access Pipeline/Workspace/Rules tabs

**How to Test:**
1. Login as SDR
2. Open conversation → click kebab menu (⋮)
3. Verify no assignment options
4. Select multiple conversations → click bulk actions
5. Verify no "Assign to SDR" submenu
6. Try to navigate to Settings → Pipeline (should redirect)

---

## 🔍 Debugging Tips

### Issue: SDR sees unassigned conversations

**Debug Steps:**
```bash
# 1. Check backend logs
cd Converso-backend
npm run dev
# Look for: "[Conversations API] type=..., folder=..., userId=..."

# 2. Check API response
# Open browser DevTools → Network tab
# Look for: GET /api/conversations?type=email&userId=...
# Verify: Response only contains conversations where assigned_to = userId

# 3. Check database directly
psql -h <host> -U postgres -d postgres
SELECT id, sender_name, assigned_to FROM conversations WHERE conversation_type = 'email';
# Verify: SDR user ID matches assigned_to
```

**Fix:**
- Verify backend server restarted after Step 1 changes
- Check `Converso-backend/src/api/conversations.ts` lines 120-122
- Should be: `query = query.eq('assigned_to', userId);`

---

### Issue: Favorites/Unread not working

**Debug Steps:**
```bash
# 1. Check if migration applied
psql -h <host> -U postgres -d postgres
\dt conversation_user_state
# Should show table exists

# 2. Check RPC functions exist
\df toggle_conversation_favorite
\df toggle_conversation_read
# Should show functions exist

# 3. Test RPC function manually
SELECT * FROM toggle_conversation_favorite(
  '<conversation-id>'::uuid, 
  '<user-id>'::uuid
);
```

**Fix:**
- Apply migration: `npx supabase migration up`
- Restart backend server
- Check browser console for API errors

---

### Issue: "Connect Email" still showing for SDR

**Debug Steps:**
```bash
# 1. Check frontend code
# File: Converso-frontend/src/pages/EmailInbox.tsx
# Line: ~802
# Should check userRole === 'sdr' FIRST

# 2. Check userRole value
# Add console.log in EmailInbox.tsx:
console.log('userRole:', userRole);
# Should output: "sdr" for SDR users

# 3. Check useAuth hook
# File: Converso-frontend/src/hooks/useAuth.tsx
# Verify role is correctly extracted from user
```

**Fix:**
- Verify frontend server restarted
- Check Step 5 changes applied correctly
- Clear browser cache and reload

---

### Issue: Mailbox counts incorrect

**Debug Steps:**
```bash
# 1. Test API endpoint
curl -H "x-user-id: <sdr-user-id>" \
     -H "x-user-role: sdr" \
     http://localhost:3001/api/conversations/mailbox-counts

# Should return:
# {"data":{"inbox":2,"sent":1,"archive":0,"trash":0}}

# 2. Check route order
# File: Converso-backend/src/routes/conversations.routes.ts
# /mailbox-counts route MUST be BEFORE /:id route
```

**Fix:**
- Verify route order in conversations.routes.ts
- Restart backend server
- Check API response in browser DevTools

---

## 📊 Expected Results Summary

| User Type | Assigned Convos | Visible Convos | Can Assign | Favorites | Unread | Empty State |
|-----------|----------------|----------------|------------|-----------|--------|-------------|
| Admin     | N/A            | ALL            | ✅ Yes     | Per-user  | Per-user | "Connect Email" |
| SDR       | 0              | 0              | ❌ No      | Per-user  | Per-user | "No assigned" |
| SDR       | 2              | 2              | ❌ No      | Per-user  | Per-user | N/A |

---

## ✅ Success Criteria

**All tests pass when:**
1. SDR with 0 assignments sees "No assigned conversations"
2. SDR with N assignments sees exactly N conversations
3. SDR cannot see unassigned or other users' conversations
4. SDR cannot access assignment controls
5. Admin sees all workspace conversations
6. Admin can assign/reassign conversations
7. Favorites are user-specific (Admin ≠ SDR)
8. Unread state is user-specific (Admin ≠ SDR)
9. Email and LinkedIn behave identically
10. Mailbox counts are assignment-aware for SDRs

---

## 📞 Support

If all tests pass: **Implementation successful!** ✅

If tests fail:
1. Check `SDRXS_SECURITY_ISOLATION_COMPLETE.md` for detailed implementation
2. Review debugging tips above
3. Check backend logs for errors
4. Verify migration applied successfully
5. Ensure both servers restarted

---

## 🎯 Quick Test Script

```bash
# 1. Apply migration
cd Converso-frontend && npx supabase migration up

# 2. Restart backend
cd ../Converso-backend && npm run dev &

# 3. Restart frontend
cd ../Converso-frontend && npm run dev &

# 4. Open browser
open http://localhost:5173

# 5. Test as SDR
# - Login as SDR
# - Verify empty state shows "No assigned conversations"
# - Have Admin assign 2 conversations
# - Verify exactly 2 visible

# 6. Test as Admin
# - Login as Admin
# - Verify all conversations visible
# - Verify can assign conversations
# - Mark conversation as favorite
# - Login as SDR → verify not favorite for SDR

# ✅ All tests pass → Success!
```

