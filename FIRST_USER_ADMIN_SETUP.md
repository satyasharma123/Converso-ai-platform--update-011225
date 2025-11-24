# First User Admin Setup

## 🎯 Configuration Complete

The system is now configured so that:
- ✅ **First user** who signs up becomes **Admin**
- ✅ **Subsequent signups are blocked** - Users cannot sign up directly
- ✅ **SDRs must be added by Admin** - Only admins can create new users

---

## 📋 Setup Steps

### Step 1: Run Migration

Run this SQL in Supabase Dashboard → SQL Editor:

```sql
-- The migration file: 20251124000001_first_user_admin.sql
-- This creates the trigger that makes first user admin and blocks others
```

Or the migration should run automatically if you're using Supabase migrations.

### Step 2: Delete All Existing Users

**Option A: Using Backend Script (Recommended)**

```bash
cd Converso-backend
npm run delete-users
```

**Option B: Using SQL Script**

1. Go to Supabase Dashboard → SQL Editor
2. Run the content of `DELETE_ALL_USERS.sql`
3. Then manually delete users from: Authentication → Users

**Option C: Manual Deletion**

1. Go to Supabase Dashboard
2. Navigate to: **Authentication** → **Users**
3. Delete all users manually
4. Also delete from: **Table Editor** → `user_roles` and `profiles`

### Step 3: Test Signup as First User (Admin)

1. **Go to:** `/signup` in your app
2. **Fill in the form:**
   - Full Name: Your name
   - Email: Your email
   - Password: Your password
   - Confirm Password: Same password
3. **Click "Sign Up"**
4. **Verify:**
   - You should be created as **Admin**
   - Check in Supabase: Authentication → Users → Your user
   - Check in Table Editor → `user_roles` → Should show role = 'admin'

### Step 4: Test That Subsequent Signups Are Blocked

1. **Try to sign up again** with a different email
2. **Expected Result:**
   - Error message: "Signup is disabled. Only the first user can sign up. Please contact an admin to create your account."
   - User is not created

---

## 🔧 How It Works

### Database Trigger

The `handle_new_user()` function:
1. **Checks if user is first user:**
   - Counts existing users
   - If count = 0, user is first

2. **First User:**
   - Creates profile
   - Assigns 'admin' role
   - Allows signup

3. **Subsequent Users:**
   - Deletes the user record
   - Raises exception
   - Blocks signup

### Frontend Handling

The signup page:
- Shows appropriate error message
- Prevents confusion
- Guides users to contact admin

---

## 👥 Adding SDRs (Admin Only)

After the first admin is created, SDRs must be added by the admin:

### Option 1: Via Supabase Dashboard (Manual)

1. **Go to:** Supabase Dashboard → Authentication → Users
2. **Click "Add User"**
3. **Fill in:**
   - Email: sdr@example.com
   - Password: (set password)
   - Auto Confirm: Yes
4. **After user is created:**
   - Go to: Table Editor → `user_roles`
   - Insert: `user_id` = (new user's ID), `role` = 'sdr'

### Option 2: Via Backend API (Future)

Create an admin endpoint to add users:
- `/api/admin/users` - Create new user
- `/api/admin/users/:id/role` - Assign role

---

## ✅ Verification Checklist

After setup:

- [ ] Migration run successfully
- [ ] All existing users deleted
- [ ] First user can sign up
- [ ] First user has 'admin' role
- [ ] Subsequent signups are blocked
- [ ] Error message shows correctly
- [ ] Admin can access admin features
- [ ] SDRs can be added manually

---

## 🧪 Testing

### Test 1: First User Signup
1. Delete all users
2. Sign up with new email
3. Verify admin role assigned
4. ✅ Should work

### Test 2: Blocked Signup
1. Try to sign up with different email
2. Verify error message
3. Verify user not created
4. ✅ Should be blocked

### Test 3: Admin Access
1. Login as first user (admin)
2. Access admin-only pages (e.g., `/team`)
3. Verify admin features work
4. ✅ Should have admin access

---

## 📝 Important Notes

1. **Only First User Can Sign Up:**
   - After first admin is created, no one else can sign up
   - All other users must be added by admin

2. **SDR Creation:**
   - Must be done manually by admin
   - Or via admin API (to be built)

3. **User Deletion:**
   - If you delete the first admin, you'll need to delete all users again
   - Then the next signup becomes admin

4. **Production:**
   - Make sure migration runs in production
   - Test first user signup in production
   - Document the admin account credentials securely

---

## 🚀 Next Steps

1. **Delete all users** (use script or manual)
2. **Test first user signup** - Should become admin
3. **Test blocked signup** - Should show error
4. **Create admin UI** (optional) - For adding SDRs
5. **Document admin credentials** - Store securely

---

## ✅ Status

- ✅ Migration created
- ✅ Delete users script created
- ✅ Frontend error handling updated
- ⏭️ Ready to test!

**Next:** Delete all users and test signup as first admin!

