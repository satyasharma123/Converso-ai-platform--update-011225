# 🔌 Integration Setup Guide - Google, Outlook, LinkedIn

## 📋 Overview

This guide explains how to set up **real data fetching** from Google Gmail, Microsoft Outlook, and LinkedIn. Currently, we only have basic OAuth setup for Gmail SMTP. To actually **fetch emails and messages**, we need to implement API integrations.

---

## 🎯 What We Need to Implement

### Current Status:
- ✅ **Basic OAuth Flow**: Google OAuth setup exists (for SMTP)
- ✅ **Account Storage**: Can store connected account info in database
- ❌ **Data Fetching**: Not implemented yet
- ❌ **Real-time Sync**: Not implemented yet
- ❌ **Webhooks/Polling**: Not implemented yet

### What's Needed:
1. **Gmail API Integration** - Fetch emails, send emails
2. **Microsoft Graph API** - Fetch Outlook emails
3. **LinkedIn API** - Fetch LinkedIn messages
4. **Token Storage** - Securely store OAuth tokens
5. **Background Jobs** - Poll for new messages
6. **Webhook Handlers** - Receive real-time notifications (if available)

---

## 📚 API Documentation Links

### 1. **Google Gmail API**
- **Docs**: https://developers.google.com/gmail/api
- **Scopes Needed**:
  - `https://www.googleapis.com/auth/gmail.readonly` - Read emails
  - `https://www.googleapis.com/auth/gmail.send` - Send emails
  - `https://www.googleapis.com/auth/gmail.modify` - Modify emails (mark as read, etc.)
- **Setup**: Google Cloud Console → Enable Gmail API

### 2. **Microsoft Outlook (Graph API)**
- **Docs**: https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview
- **Scopes Needed**:
  - `Mail.Read` - Read emails
  - `Mail.Send` - Send emails
  - `Mail.ReadWrite` - Modify emails
- **Setup**: Azure Portal → App Registration → API Permissions

### 3. **LinkedIn API**
- **Docs**: https://learn.microsoft.com/en-us/linkedin/
- **Scopes Needed**:
  - `r_messages` - Read messages
  - `w_messages` - Send messages
- **Setup**: LinkedIn Developer Portal → Create App

---

## 🏗️ Implementation Architecture

### Phase 1: Token Storage & Management
1. **Extend `connected_accounts` table** to store OAuth tokens
2. **Token encryption** for security
3. **Token refresh logic** (tokens expire)

### Phase 2: Gmail API Integration
1. **Update OAuth scopes** to include Gmail API scopes
2. **Gmail API service** to fetch emails
3. **Email sync job** to poll for new emails
4. **Store emails** in `conversations` and `messages` tables

### Phase 3: Outlook API Integration
1. **Microsoft OAuth setup**
2. **Graph API service** to fetch emails
3. **Email sync job** for Outlook
4. **Store emails** in database

### Phase 4: LinkedIn API Integration
1. **LinkedIn OAuth setup**
2. **LinkedIn API service** to fetch messages
3. **Message sync job** for LinkedIn
4. **Store messages** in database

### Phase 5: Real-time Sync
1. **Background worker** (cron job or queue)
2. **Polling mechanism** (check every 5-15 minutes)
3. **Webhook handlers** (if providers support it)

---

## 🚀 Quick Start: What I Can Implement

I can implement the **complete integration system** for you, including:

### ✅ What I'll Build:

1. **Database Schema Updates**
   - Add OAuth token storage to `connected_accounts`
   - Add sync status tracking
   - Add last sync timestamps

2. **Gmail API Integration**
   - Complete OAuth flow with Gmail scopes
   - Gmail API service to fetch emails
   - Email parsing and storage
   - Background sync job

3. **Outlook API Integration**
   - Microsoft OAuth setup
   - Graph API service
   - Email sync

4. **LinkedIn API Integration**
   - LinkedIn OAuth setup
   - LinkedIn API service
   - Message sync

5. **Background Sync System**
   - Polling service
   - Automatic token refresh
   - Error handling and retries

6. **Frontend Updates**
   - OAuth connection flow
   - Sync status display
   - Manual sync trigger

---

## 📝 What You Need to Provide

### 1. **API Credentials** (I'll guide you through getting these)

#### Google Gmail:
- ✅ Already have: Client ID & Secret
- ⚠️ Need: Enable Gmail API in Google Cloud Console

#### Microsoft Outlook:
- ⚠️ Need: Azure App Registration
  - Client ID
  - Client Secret
  - Tenant ID

#### LinkedIn:
- ⚠️ Need: LinkedIn Developer App
  - Client ID
  - Client Secret

### 2. **Environment Variables** (I'll add these)

```env
# Google (already have)
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...

# Microsoft Outlook
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
MICROSOFT_TENANT_ID=...

# LinkedIn
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
```

---

## 🎯 Implementation Options

### Option 1: **Full Implementation** (Recommended)
I implement everything:
- ✅ All API integrations
- ✅ Background sync jobs
- ✅ Token management
- ✅ Error handling
- ✅ Frontend UI updates

**Time**: ~2-3 hours of implementation
**You provide**: API credentials (I'll guide you)

### Option 2: **Step-by-Step Implementation**
We implement one at a time:
1. Gmail first
2. Then Outlook
3. Then LinkedIn

**Time**: ~1 hour per integration
**You provide**: API credentials as we go

### Option 3: **You Get Credentials First**
You get all API credentials, then I implement everything at once.

---

## 🔧 Next Steps

**Choose one:**

1. **"Implement Gmail integration first"** - I'll build the complete Gmail API integration
2. **"Get me the setup instructions"** - I'll create detailed guides for getting API credentials
3. **"Implement all three at once"** - I'll build everything, you provide credentials as we go

---

## 📖 API Setup Guides I'll Create

If you choose to get credentials first, I'll create:

1. **`GMAIL_API_SETUP.md`** - Step-by-step Google Cloud Console setup
2. **`OUTLOOK_API_SETUP.md`** - Step-by-step Azure Portal setup
3. **`LINKEDIN_API_SETUP.md`** - Step-by-step LinkedIn Developer setup

---

## 💡 Recommendation

**I recommend Option 1 (Full Implementation)** because:
- ✅ I handle all the complex API integration code
- ✅ You just need to get API credentials (I'll guide you)
- ✅ Everything works together seamlessly
- ✅ Faster overall development

**What do you want to do?**

1. Start with Gmail integration?
2. Get setup guides first?
3. Implement all three at once?

Let me know and I'll proceed! 🚀

