# Quick Start Checklist - Returning to Project

Use this checklist when returning to work on the project after a break.

## ✅ Pre-Work Setup

- [ ] Open project in IDE (VS Code/Cursor)
- [ ] Check if backend server is running (`cd Converso-backend && npm run dev`)
- [ ] Check if frontend server is running (`cd Converso-frontend && npm run dev`)
- [ ] Verify database connection (Supabase dashboard)
- [ ] Check environment variables are set (`.env` files)

## 📖 Quick Reference Read

- [ ] Read `IMPLEMENTATION_REFERENCE.md` (5 min overview)
- [ ] Check `CODE_SNIPPETS_REFERENCE.md` for common patterns
- [ ] Review recent changes in git history

## 🔍 Verify Current State

- [ ] Test email inbox page loads correctly
- [ ] Verify email sync is working
- [ ] Check if any error messages in browser console
- [ ] Check backend logs for errors
- [ ] Test a few core functions (view email, mark as read, etc.)

## 🎯 Key Files to Remember

### Frontend
- `Converso-frontend/src/pages/EmailInbox.tsx` - Main email page
- `Converso-frontend/src/components/Inbox/EmailView.tsx` - Email display
- `Converso-frontend/src/components/Inbox/ConversationList.tsx` - Email list
- `Converso-frontend/src/components/Inbox/LeadProfilePanel.tsx` - Right drawer

### Backend
- `Converso-backend/src/services/emailSync.ts` - Email sync logic
- `Converso-backend/src/routes/messages.routes.ts` - Message endpoints
- `Converso-backend/src/routes/conversations.routes.ts` - Conversation endpoints

### Database
- `SETUP_DATABASE_FOR_EMAIL_SYNC.sql` - Database setup script
- Supabase dashboard for database inspection

## 🚨 Common Issues & Quick Fixes

### Issue: Emails not syncing
**Fix:** 
1. Check `sync_status` table in Supabase
2. Verify OAuth tokens in `connected_accounts` table
3. Restart backend server

### Issue: Email body not showing
**Fix:**
1. Open browser DevTools → Network tab
2. Check if `/api/messages/conversation/:id` returns `email_body`
3. Check backend logs for API errors

### Issue: Read/unread not working
**Fix:**
1. Check database `is_read` field value
2. Verify `toggleRead` mutation is called (React DevTools)
3. Check backend route `/api/conversations/:id/read`

### Issue: Layout broken/scrolling issues
**Fix:**
1. Check Tailwind classes on containers
2. Verify fixed widths (200px, 320px, 340px)
3. Check `overflow-hidden` vs `overflow-y-auto`

## 🔧 Development Commands

```bash
# Backend
cd Converso-backend
npm install          # Install dependencies
npm run dev          # Start dev server (port 3001)
npm run build        # Build for production

# Frontend
cd Converso-frontend
npm install          # Install dependencies
npm run dev          # Start dev server (port 3000)
npm run build        # Build for production

# Database
# Run SQL scripts in Supabase SQL Editor
# Or use Supabase CLI if configured
```

## 📝 Next Steps When Starting Work

1. **Identify what you want to build/change**
2. **Find relevant files** (use `IMPLEMENTATION_REFERENCE.md`)
3. **Review existing code patterns** (use `CODE_SNIPPETS_REFERENCE.md`)
4. **Make changes incrementally**
5. **Test each change**

## 🎓 Key Concepts to Remember

- **Email Sync:** Metadata synced first, full body fetched on-demand
- **Read Status:** Black dot = unread, no dot = read
- **Layout:** Fixed widths to prevent horizontal scrolling
- **API Calls:** All use `/api/` prefix on frontend
- **Database:** Use `supabaseAdmin` in backend for admin operations

## 📞 Quick Help

- **Function Location:** Check `IMPLEMENTATION_REFERENCE.md` → "Key Functions Reference"
- **Component Props:** Check component file's interface/types
- **API Endpoints:** Check `IMPLEMENTATION_REFERENCE.md` → "API Endpoints"
- **Database Schema:** Check `IMPLEMENTATION_REFERENCE.md` → "Database Schema"

---

**Last Updated:** November 30, 2025
