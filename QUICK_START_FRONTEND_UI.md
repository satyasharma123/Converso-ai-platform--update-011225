# 🚀 QUICK START: Frontend UI for Agent 1 & Agent 2

## ⚡ 3-Minute Setup Guide

### **Step 1: Verify Backend is Running** (30 seconds)

```bash
# Check if backend is running
curl http://localhost:3001/api/conversations/with-intents \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Workspace-Id: YOUR_WORKSPACE_ID"
```

**Expected**: JSON response with conversations including `intent` and `lead_tags` fields

---

### **Step 2: Start Frontend** (1 minute)

```bash
cd Converso-frontend
npm run dev
```

**Expected**: Frontend starts on `http://localhost:5173` (or similar)

---

### **Step 3: View AI Insights** (1 minute)

1. Navigate to **Email Inbox** or **LinkedIn Inbox**
2. Look for conversations with:
   - 📅 Intent badges (Meeting, Pricing, Demo, etc.)
   - 🤖 Lead tags (Meeting Requested, Info Requested, Lead)

**Expected Visual**:
```
┌─────────────────────────────────────────────┐
│ John Doe                  2m ago      ●     │
│ john.doe@company.com                        │
│ Demo Request                                │
│ Hi, I'd like to schedule a demo...         │
│                                             │
│ 📅 Meeting  🤖 Meeting Requested           │
│                                             │
│ sales@synq.com • Sarah                     │
└─────────────────────────────────────────────┘
```

---

### **Step 4: Test Interactions** (30 seconds)

1. **Hover over intent badge** → See detailed tooltip
2. **Click "+ Add Tag"** → See tag dropdown
3. **Select a tag** → Tag is applied
4. **Click × on tag** → Tag is removed

---

## ✅ Success Indicators

You'll know it's working when you see:

1. **Intent Badges**:
   - ✅ Colored badges with icons (💰, 🎯, 📅, etc.)
   - ✅ Hover shows tooltip with confidence, keywords, sentiment
   - ✅ "AI-detected" indicator in tooltip

2. **Lead Tags**:
   - ✅ Tag pills with AI/Manual indicator (🤖 or ✋)
   - ✅ Remove button (×) on each tag
   - ✅ "+ Add Tag" button works

3. **No Errors**:
   - ✅ No console errors
   - ✅ No TypeScript errors
   - ✅ No network errors

---

## 🐛 Quick Troubleshooting

### **Problem**: No intent badges showing
**Solution**:
```bash
# 1. Check if Agent 1 is enabled
curl http://localhost:3001/api/agents/config/WORKSPACE_ID/intent_detection

# 2. Check if intents exist in database
# Run in Supabase SQL Editor:
SELECT * FROM conversation_intents LIMIT 10;

# 3. Send a test message to trigger intent detection
```

---

### **Problem**: No lead tags showing
**Solution**:
```bash
# 1. Check if Agent 2 is enabled
curl http://localhost:3001/api/agents/config/WORKSPACE_ID/lead_action

# 2. Check if tags exist in database
# Run in Supabase SQL Editor:
SELECT id, sender_name, lead_tags FROM conversations WHERE lead_tags IS NOT NULL LIMIT 10;

# 3. Manually trigger Agent 2
curl -X POST http://localhost:3001/api/agents/run-lead-action \
  -H "Content-Type: application/json" \
  -d '{"conversation_id": "CONV_ID", "workspace_id": "WORKSPACE_ID"}'
```

---

### **Problem**: Components not rendering
**Solution**:
```bash
# 1. Check for TypeScript errors
cd Converso-frontend
npm run type-check

# 2. Check for build errors
npm run build

# 3. Clear cache and restart
rm -rf node_modules/.vite
npm run dev
```

---

## 📊 What to Check

### **Browser DevTools → Network Tab**
Look for:
- ✅ `GET /api/conversations/with-intents` (200 OK)
- ✅ Response includes `intent` and `lead_tags` fields

### **Browser DevTools → Console**
Should see:
- ✅ No errors
- ✅ No warnings about missing components

### **Browser DevTools → React DevTools**
Check:
- ✅ `IntentBadge` component renders
- ✅ `LeadTagPill` component renders
- ✅ Props are passed correctly

---

## 🎯 Testing Checklist

### **Visual Tests** (2 minutes)
- [ ] Intent badges appear on conversations
- [ ] Badges have correct colors
- [ ] Badges have correct icons
- [ ] Tags appear on conversations
- [ ] Tags have AI/Manual indicator

### **Interaction Tests** (2 minutes)
- [ ] Hover over badge shows tooltip
- [ ] Tooltip shows confidence score
- [ ] Tooltip shows keywords
- [ ] "+ Add Tag" opens dropdown
- [ ] Selecting tag applies it
- [ ] Removing tag works

### **API Tests** (1 minute)
- [ ] `/api/conversations/with-intents` returns data
- [ ] `POST /api/agents/apply-manual-tags` works
- [ ] Network tab shows no errors

---

## 📁 Files to Check

If something's not working, check these files:

1. **Components**:
   - `Converso-frontend/src/components/AIAgents/IntentBadge.tsx`
   - `Converso-frontend/src/components/AIAgents/LeadTagPill.tsx`
   - `Converso-frontend/src/components/AIAgents/LeadTagSelector.tsx`

2. **Integration**:
   - `Converso-frontend/src/components/Inbox/ConversationList.tsx`
   - `Converso-frontend/src/lib/backend-api.ts`
   - `Converso-frontend/src/hooks/useConversations.tsx`

3. **Backend**:
   - `Converso-backend/src/routes/conversations.routes.ts`
   - `Converso-backend/src/services/autoIntentDetection.ts`
   - `Converso-backend/src/services/leadActionAgent.ts`

---

## 🚀 Next Steps

Once everything is working:

1. **Test with real data**:
   - Send test emails with meeting requests
   - Verify intents are detected
   - Verify tags are applied

2. **Test manual override**:
   - Manually apply tags
   - Verify AI doesn't override
   - Verify 🤖 changes to ✋

3. **Test on mobile**:
   - Check responsive design
   - Verify tooltips work on touch
   - Check tag selector on mobile

4. **Deploy to staging**:
   - Test in staging environment
   - Verify with real users
   - Collect feedback

---

## 📞 Need Help?

1. Check `FRONTEND_AGENT1_AGENT2_IMPLEMENTATION.md` for full documentation
2. Check `AGENT1_AGENT2_COMPLETE_SUMMARY.md` for backend details
3. Check browser console for errors
4. Check network tab for API issues
5. Check database for data

---

**Time to Setup**: ~3 minutes  
**Difficulty**: Easy  
**Risk**: 🟢 Low (non-breaking)

**Status**: ✅ Ready to test

