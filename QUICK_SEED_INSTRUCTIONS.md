# Quick Database Seed - Instructions

## 🚀 Fastest Way to Populate Database

### Step 1: Make sure you have at least one user
- Go to your app: http://localhost:8080/signup
- Create a test account (email confirmation can be disabled for testing)

### Step 2: Run SQL Script in Supabase

1. **Open Supabase Dashboard:**
   - Go to: https://supabase.com/dashboard
   - Select your project: `wahvinwuyefmkmgmjspo`

2. **Open SQL Editor:**
   - Click **SQL Editor** in left sidebar
   - Click **New query** button

3. **Copy and Run the Script:**
   - Open file: `SEED_DATABASE.sql`
   - Copy **ALL** the content
   - Paste into SQL Editor
   - Click **Run** button (or press Cmd/Ctrl + Enter)

4. **Wait for Success Message:**
   - You should see: "✅ Seed completed successfully!"

### Step 3: Verify Data

1. **In Supabase Dashboard:**
   - Go to **Table Editor**
   - Check tables:
     - `pipeline_stages` - Should have 7 rows
     - `connected_accounts` - Should have 3 rows
     - `conversations` - Should have 6 rows
     - `messages` - Should have 9 rows

2. **In Your App:**
   - Refresh the frontend
   - Go to `/inbox/email` - Should see 4 email conversations
   - Go to `/inbox/linkedin` - Should see 2 LinkedIn conversations
   - Go to `/inbox/conversations` - Should see all 6 conversations
   - Go to `/pipeline` - Should see pipeline stages

## ✅ What Gets Created

- **7 Pipeline Stages:** New Lead, Contacted, Qualified, Proposal Sent, Negotiation, Closed Won, Closed Lost
- **3 Connected Accounts:** Sales Email, Support Email, LinkedIn Account
- **6 Conversations:** 4 email + 2 LinkedIn
- **9 Messages:** Distributed across conversations

## 🎉 Done!

Your database is now populated with realistic sample data for testing!
