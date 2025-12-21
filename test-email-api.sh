#!/bin/bash

# Simple API Test for Email Body Fix
# Tests that the API returns content (not empty)

echo "🧪 Testing Email Body API Fix..."
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if backend is running
echo "1️⃣ Checking if backend is running..."
HEALTH_CHECK=$(curl -s http://localhost:3001/health 2>/dev/null)

if [ -z "$HEALTH_CHECK" ]; then
  echo -e "${RED}❌ Backend is not running on http://localhost:3001${NC}"
  echo "   Start it with: cd Converso-backend && npm run dev"
  exit 1
fi

echo -e "${GREEN}✅ Backend is running${NC}"
echo ""

# Test the conversations endpoint to get a recent email ID
echo "2️⃣ Fetching recent emails..."
EMAILS_RESPONSE=$(curl -s "http://localhost:3001/api/emails?workspace_id=test&days=30&limit=5" 2>/dev/null)

# Check if we got any emails
EMAIL_COUNT=$(echo "$EMAILS_RESPONSE" | jq -r '.data | length' 2>/dev/null)

if [ -z "$EMAIL_COUNT" ] || [ "$EMAIL_COUNT" = "null" ] || [ "$EMAIL_COUNT" -eq 0 ]; then
  echo -e "${YELLOW}⚠️  No emails found in the system${NC}"
  echo "   This is normal if you haven't synced emails yet."
  echo ""
  echo "   To test the fix:"
  echo "   1. Go to your app: http://localhost:5173"
  echo "   2. Connect an email account (Settings → Integrations)"
  echo "   3. Wait for sync to complete"
  echo "   4. Open any email and check if content is displayed"
  exit 0
fi

echo -e "${GREEN}✅ Found $EMAIL_COUNT emails${NC}"
echo ""

# Get the first email ID
EMAIL_ID=$(echo "$EMAILS_RESPONSE" | jq -r '.data[0].id' 2>/dev/null)

if [ -z "$EMAIL_ID" ] || [ "$EMAIL_ID" = "null" ]; then
  echo -e "${RED}❌ Could not extract email ID${NC}"
  exit 1
fi

echo "3️⃣ Testing email detail API with ID: $EMAIL_ID"
echo ""

# Fetch the email detail
EMAIL_DETAIL=$(curl -s "http://localhost:3001/api/emails/$EMAIL_ID" 2>/dev/null)

# Check if response has data
HAS_DATA=$(echo "$EMAIL_DETAIL" | jq -r '.data' 2>/dev/null)

if [ -z "$HAS_DATA" ] || [ "$HAS_DATA" = "null" ]; then
  echo -e "${RED}❌ API returned no data${NC}"
  echo "   Response: $EMAIL_DETAIL"
  exit 1
fi

# Extract content fields
PREVIEW=$(echo "$EMAIL_DETAIL" | jq -r '.data.preview // empty' 2>/dev/null)
EMAIL_BODY=$(echo "$EMAIL_DETAIL" | jq -r '.data.email_body // empty' 2>/dev/null)
EMAIL_BODY_HTML=$(echo "$EMAIL_DETAIL" | jq -r '.data.email_body_html // empty' 2>/dev/null)
EMAIL_BODY_TEXT=$(echo "$EMAIL_DETAIL" | jq -r '.data.email_body_text // empty' 2>/dev/null)
SUBJECT=$(echo "$EMAIL_DETAIL" | jq -r '.data.subject // empty' 2>/dev/null)

# Calculate lengths
PREVIEW_LEN=${#PREVIEW}
BODY_LEN=${#EMAIL_BODY}
HTML_LEN=${#EMAIL_BODY_HTML}
TEXT_LEN=${#EMAIL_BODY_TEXT}

echo "   📧 Subject: $SUBJECT"
echo "   📝 Preview length: $PREVIEW_LEN chars"
echo "   📄 Email body length: $BODY_LEN chars"
echo "   🌐 HTML body length: $HTML_LEN chars"
echo "   📃 Text body length: $TEXT_LEN chars"
echo ""

# Check if we have ANY content
TOTAL_CONTENT=$((PREVIEW_LEN + BODY_LEN + HTML_LEN + TEXT_LEN))

if [ $TOTAL_CONTENT -gt 50 ]; then
  echo -e "${GREEN}✅ SUCCESS! API returns content${NC}"
  echo ""
  echo "   The fix is working! The API returned:"
  if [ $HTML_LEN -gt 0 ]; then
    echo "   - Full HTML body ($HTML_LEN chars)"
  fi
  if [ $TEXT_LEN -gt 0 ]; then
    echo "   - Text body ($TEXT_LEN chars)"
  fi
  if [ $PREVIEW_LEN -gt 0 ]; then
    echo "   - Preview ($PREVIEW_LEN chars)"
  fi
  echo ""
  echo "   ✨ Your emails should now display properly in the UI!"
else
  echo -e "${RED}❌ PROBLEM: API returned minimal content${NC}"
  echo ""
  echo "   This email might not have been synced properly."
  echo "   Try:"
  echo "   1. Disconnect and reconnect your email account"
  echo "   2. Wait for sync to complete"
  echo "   3. Run this test again"
fi

echo ""
echo "4️⃣ Next steps:"
echo "   1. Open your app: http://localhost:5173"
echo "   2. Go to Email Inbox"
echo "   3. Click on any email"
echo "   4. Open browser console (F12) and look for:"
echo "      [useEmailWithBody] Fetched email: ..."
echo "      [EmailBodyContent] Rendering with: ..."
echo "   5. Verify email content is displayed"
echo ""

echo "✅ Test complete!"



