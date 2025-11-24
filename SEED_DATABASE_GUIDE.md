# Database Seeding Guide

## 🎯 Quick Start: Populate Database with Dummy Data

### Option 1: Using Seed Script (Recommended)

**Prerequisites:**
- At least one user created via frontend signup
- `SUPABASE_SERVICE_ROLE_KEY` in `.env` file (optional but recommended)

**Steps:**

1. **Get Service Role Key** (if not already set):
   - Go to Supabase Dashboard: https://supabase.com/dashboard
   - Select your project
   - Go to **Settings** → **API**
   - Copy the **Service Role Key** (keep it secret!)

2. **Add to .env file:**
   ```bash
   cd Converso-backend
   # Create .env file if it doesn't exist
   echo "SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here" >> .env
   ```

3. **Run the seed script:**
   ```bash
   cd Converso-backend
   npm run seed:quick
   ```

**What it creates:**
- ✅ 7 Pipeline stages (New Lead, Contacted, Qualified, etc.)
- ✅ 3 Connected accounts (Sales Email, Support Email, LinkedIn)
- ✅ 6 Conversations (mix of email and LinkedIn)
- ✅ 9 Messages across conversations

---

### Option 2: Using SQL Script (No Service Role Key Needed)

If you don't have the service role key, use the SQL script:

1. **Go to Supabase Dashboard:**
   - https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor:**
   - Click **SQL Editor** in left sidebar
   - Click **New query**

3. **Run the seed script:**
   - Open `QUICK_SEED.sql` file
   - Copy the entire content
   - Paste into SQL Editor
   - Click **Run** (or press Cmd/Ctrl + Enter)

**Note:** This script requires at least one user to exist (created via signup).

---

## 📋 What Gets Created

### Pipeline Stages
- New Lead
- Contacted
- Qualified
- Proposal Sent
- Negotiation
- Closed Won
- Closed Lost

### Connected Accounts
- Sales Team Email (sales@converso.com)
- Support Email (support@converso.com)
- LinkedIn Business Account

### Sample Conversations
1. **John Doe** (Email) - New lead, interested in product
2. **Jane Smith** (Email) - Follow up on meeting, engaged status
3. **Mike Johnson** (LinkedIn) - Qualified lead
4. **Sarah Williams** (Email) - Product demo request
5. **David Brown** (Email) - Pricing inquiry
6. **Emily Davis** (LinkedIn) - New connection

### Messages
- Multiple messages per conversation
- Mix of lead messages and SDR responses
- Realistic timestamps

---

## 🔧 Troubleshooting

### Error: "Cannot list users"
**Solution:** Add `SUPABASE_SERVICE_ROLE_KEY` to `.env` file

### Error: "No users found"
**Solution:** 
1. Create at least one user via frontend signup (`/signup`)
2. Then run the seed script again

### Error: "Permission denied" or RLS errors
**Solution:** Use the SQL script (`QUICK_SEED.sql`) which bypasses RLS

### Error: "Duplicate key" or "Already exists"
**Solution:** This is normal - the script skips existing data. Your data is already seeded!

---

## 🚀 After Seeding

1. **Refresh your frontend** - You should see:
   - Conversations in `/inbox/email`
   - Conversations in `/inbox/linkedin`
   - Conversations in `/inbox/conversations`
   - Pipeline stages in `/pipeline`

2. **Test the app:**
   - View conversations
   - Filter by type (email/LinkedIn)
   - Check pipeline stages
   - View messages

---

## 📝 Available Seed Scripts

- `npm run seed:quick` - Quick seed (recommended, uses existing users)
- `npm run seed:simple` - Simple seed (similar to quick)
- `npm run seed` - Full seed (creates users, requires service role key)
- `npm run seed:mock` - Mock seed (for testing)

---

## ✅ Verification

After seeding, verify data in Supabase Dashboard:

1. Go to **Table Editor**
2. Check tables:
   - `pipeline_stages` - Should have 7 stages
   - `connected_accounts` - Should have 3 accounts
   - `conversations` - Should have 6 conversations
   - `messages` - Should have 9 messages

---

## 🎉 Success!

Once seeded, your database will have realistic sample data for testing and development!

