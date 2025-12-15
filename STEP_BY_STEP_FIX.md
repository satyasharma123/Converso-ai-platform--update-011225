# 🔧 Step-by-Step Fix: LinkedIn Real-time Notifications

## Current Situation
- ❌ Webhook returning: **403 Forbidden**
- ❌ New messages not showing up in real-time
- ❌ Unread badges not appearing
- ❌ ngrok forwarding to: **port 8082 (Frontend)**

## Goal
- ✅ Webhook returning: **200 OK**
- ✅ New messages appear instantly
- ✅ Unread badges show on conversations
- ✅ ngrok forwarding to: **port 3001 (Backend)**

---

## 🎯 The Fix (Follow These Steps)

### Step 1: Open Terminal 36
This is the terminal currently running ngrok (showing the 403 errors).

### Step 2: Stop ngrok
```bash
Press: Ctrl+C
```

You should see ngrok stop and return to the command prompt.

### Step 3: Start ngrok on Correct Port
Type this command:
```bash
ngrok http 3001
```

Press Enter.

### Step 4: Copy the HTTPS URL
You'll see output like this:
```
Forwarding    https://andreas-preartistic-airily.ngrok-free.app -> http://localhost:3001
```

**Copy the HTTPS URL** (the part that starts with `https://`)

### Step 5: Open Unipile Dashboard
Go to: https://dashboard.unipile.com

### Step 6: Navigate to Webhooks
Click: **Settings** → **Webhooks**

### Step 7: Update Webhook URL
Paste your copied URL and add `/api/linkedin/webhook` at the end:
```
https://your-ngrok-url.ngrok-free.app/api/linkedin/webhook
```

Example:
```
https://andreas-preartistic-airily.ngrok-free.app/api/linkedin/webhook
```

### Step 8: Save Changes
Click the **Save** button in Unipile dashboard.

### Step 9: Test It!
Send a LinkedIn message to your connected account.

### Step 10: Verify It's Working
Check these 4 things:

#### ✅ Check 1: Backend Logs (Terminal 29)
Look for:
```
[Webhook] Received event
[Webhook] Synced X messages for chat...
```

#### ✅ Check 2: Frontend Console (Browser F12)
Look for:
```
[SSE] Received linkedin_message event
```

#### ✅ Check 3: Unread Badge
You should see a blue badge with a number on the conversation.

#### ✅ Check 4: Auto-refresh
Click the conversation - it should automatically refresh and show the new message.

---

## 🎨 Visual Guide

### BEFORE (Broken ❌)
```
Terminal 36:
┌─────────────────────────────────────────┐
│ ngrok http 8082                         │
│                                         │
│ Forwarding:                             │
│ https://xxx.ngrok-free.app → :8082     │
│                            ↓            │
│                         FRONTEND        │
│                         (Wrong!)        │
│                                         │
│ HTTP Requests:                          │
│ POST /api/linkedin/webhook  403 ❌      │
└─────────────────────────────────────────┘
```

### AFTER (Working ✅)
```
Terminal 36:
┌─────────────────────────────────────────┐
│ ngrok http 3001                         │
│                                         │
│ Forwarding:                             │
│ https://xxx.ngrok-free.app → :3001     │
│                            ↓            │
│                         BACKEND         │
│                         (Correct!)      │
│                                         │
│ HTTP Requests:                          │
│ POST /api/linkedin/webhook  200 ✅      │
└─────────────────────────────────────────┘
```

---

## 📋 Quick Checklist

Before you start:
- [ ] Backend is running (Terminal 29: `npm run dev`)
- [ ] Frontend is running (Terminal 28: `npm run dev`)
- [ ] You have access to Unipile dashboard

After the fix:
- [ ] ngrok shows port 3001 (not 8082)
- [ ] Webhook URL updated in Unipile
- [ ] Test message sent
- [ ] Backend logs show webhook received
- [ ] Frontend console shows SSE event
- [ ] Unread badge appears
- [ ] Auto-refresh works

---

## 🚨 Troubleshooting

### Problem: Can't stop ngrok
**Solution**: Close the terminal and open a new one

### Problem: ngrok command not found
**Solution**: Install ngrok from https://ngrok.com/download

### Problem: Still getting 403 after fix
**Solution**: 
1. Double-check ngrok is on port 3001
2. Verify webhook URL in Unipile includes `/api/linkedin/webhook`
3. Make sure you saved changes in Unipile

### Problem: Backend not running
**Solution**: 
```bash
cd Converso-backend
npm run dev
```

### Problem: Can't access Unipile dashboard
**Solution**: Contact Unipile support or check your login credentials

---

## 🎓 Understanding the Fix

### Why Port 3001?
- Port 3001 = Backend API (handles webhooks, database, SSE)
- Port 8082 = Frontend (React UI, no webhook handling)

### Why Did This Happen?
Someone likely ran `ngrok http 8082` thinking it should forward to the visible frontend. But webhooks need to go to the backend API!

### Will This Happen Again?
If you restart ngrok, remember to use port 3001. Consider creating an alias:
```bash
# Add to ~/.zshrc or ~/.bashrc
alias ngrok-webhook='ngrok http 3001'
```

Then you can just run:
```bash
ngrok-webhook
```

---

## 🎉 Success Indicators

You'll know it's working when:

1. **ngrok terminal** shows:
   ```
   POST /api/linkedin/webhook  200 OK
   ```

2. **Backend terminal** shows:
   ```
   [Webhook] Received event
   [Webhook] Synced 1 messages for chat abc123
   ```

3. **Browser console** shows:
   ```
   [SSE] Received linkedin_message event: {conversation_id: "..."}
   ```

4. **UI shows**:
   - Blue unread badge on conversation
   - New message appears when you click
   - Badge disappears after reading

---

## 📞 Need Help?

If you're still stuck after following these steps:

1. Run the test script:
   ```bash
   ./test-webhook.sh
   ```

2. Check the detailed documentation:
   - `LINKEDIN_WEBHOOK_FIX.md` - Technical details
   - `QUICK_FIX_LINKEDIN_NOTIFICATIONS.md` - Quick reference

3. Verify your setup:
   - Backend running on port 3001? ✓
   - Frontend running on port 8082? ✓
   - ngrok forwarding to 3001? ✓
   - Webhook URL updated in Unipile? ✓

---

**Ready? Let's fix it! Start with Step 1 above.** 🚀
