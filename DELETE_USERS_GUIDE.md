# Delete All Users - Complete Guide

## 🔍 Issue
Manual deletion in Supabase Dashboard shows: "Database error deleting user"

This happens because of foreign key constraints - you need to delete related data first.

---

## ✅ Solution: Use SQL Script (Recommended)

### Step 1: Run SQL Script to Delete Related Data

1. **Go to Supabase Dashboard:**
   - https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor:**
   - Click **SQL Editor** in left sidebar
   - Click **New query**

3. **Run the Fixed Script:**
   - Open: `DELETE_ALL_USERS_FIXED.sql`
   - Copy **ALL** content
   - Paste into SQL Editor
   - Click **Run**

This will delete all related data in the correct order:
- ✅ User messages
- ✅ Conversation assignments
- ✅ Connected accounts
- ✅ User roles
- ✅ Profiles

### Step 2: Delete Auth Users

After running the SQL script, delete auth users:

1. **Go to:** Authentication → Users
2. **Select all users** (or delete one by one)
3. **Click "Delete"**
4. **Confirm deletion**

Now it should work without errors!

---

## 🔧 Alternative: Use Backend Script

If you prefer using the backend script:

```bash
cd Converso-backend
npm run delete-users
```

This script:
- ✅ Deletes related data first (in correct order)
- ✅ Then deletes auth users
- ✅ Handles all foreign key constraints
- ✅ Shows progress and errors

**Note:** Requires `SUPABASE_SERVICE_ROLE_KEY` in `.env` file.

---

## 📋 Deletion Order (Why It Matters)

Foreign keys require deletion in this order:

1. **Messages** (references users via sender_id)
2. **Conversations** (references users via assigned_to) - Clear assignments
3. **Connected Accounts** (references users via user_id)
4. **User Roles** (references users via user_id)
5. **Profiles** (references users via id)
6. **Auth Users** (last - this is what you delete in dashboard)

If you try to delete users first, you'll get foreign key errors.

---

## 🧪 Verify Deletion

After deletion, verify:

1. **Check Tables:**
   - Table Editor → `user_roles` - Should be empty
   - Table Editor → `profiles` - Should be empty
   - Table Editor → `connected_accounts` - Should be empty
   - Table Editor → `messages` - Should only have lead messages (no sender_id)

2. **Check Auth:**
   - Authentication → Users - Should be empty

3. **Check Conversations:**
   - Table Editor → `conversations` - `assigned_to` should be NULL for all

---

## ✅ After Deletion

Once all users are deleted:

1. **Run the migration:**
   - Go to SQL Editor
   - Run: `20251124000001_first_user_admin.sql`

2. **Test first user signup:**
   - Go to `/signup`
   - Sign up with your email
   - You should become admin automatically

3. **Test blocked signup:**
   - Try to sign up with different email
   - Should show error: "Signup is disabled..."

---

## 🚨 Troubleshooting

### Error: "Foreign key constraint violation"
**Solution:** Make sure you ran the SQL script FIRST to delete related data

### Error: "Cannot delete user"
**Solution:** 
- Check if user has any remaining references
- Run the SQL script again
- Then try deleting from dashboard

### Error: "User not found"
**Solution:** User might already be deleted, check Authentication → Users

---

## 📝 Quick Checklist

- [ ] Run `DELETE_ALL_USERS_FIXED.sql` in SQL Editor
- [ ] Verify related data is deleted
- [ ] Delete auth users from dashboard
- [ ] Verify all users are deleted
- [ ] Run migration: `20251124000001_first_user_admin.sql`
- [ ] Test first user signup

---

## 🎯 Recommended Approach

**Best method:**
1. Run SQL script (`DELETE_ALL_USERS_FIXED.sql`)
2. Delete auth users from dashboard
3. Run migration
4. Test signup

This ensures all foreign key constraints are handled properly!

