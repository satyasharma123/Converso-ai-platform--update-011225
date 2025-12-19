#!/bin/bash

# Test Email Body Corruption Fix
# This script tests that emails always show content (never "No email content available")

echo "🧪 Testing Email Body Fix..."
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get DATABASE_URL from backend .env
cd "$(dirname "$0")/Converso-backend"
if [ -f .env ]; then
  export $(cat .env | grep DATABASE_URL | xargs)
fi

if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}❌ DATABASE_URL not found in .env${NC}"
  exit 1
fi

echo "1️⃣ Checking recent email conversations..."
RECENT_EMAILS=$(psql "$DATABASE_URL" -t -c "
  SELECT 
    id, 
    subject, 
    LENGTH(COALESCE(preview, '')) as preview_len,
    LENGTH(COALESCE(email_body_html, '')) as html_len,
    LENGTH(COALESCE(email_body_text, '')) as text_len,
    email_body_fetched_at IS NOT NULL as fetched
  FROM conversations 
  WHERE conversation_type = 'email' 
  ORDER BY created_at DESC 
  LIMIT 5;
")

echo "$RECENT_EMAILS"
echo ""

# Count emails with NO content (preview, html, or text)
EMPTY_COUNT=$(psql "$DATABASE_URL" -t -c "
  SELECT COUNT(*) 
  FROM conversations 
  WHERE conversation_type = 'email' 
    AND (preview IS NULL OR preview = '')
    AND (email_body_html IS NULL OR email_body_html = '')
    AND (email_body_text IS NULL OR email_body_text = '')
    AND created_at > NOW() - INTERVAL '7 days';
")

EMPTY_COUNT=$(echo $EMPTY_COUNT | tr -d ' ')

if [ "$EMPTY_COUNT" -gt 0 ]; then
  echo -e "${YELLOW}⚠️  Found $EMPTY_COUNT emails with NO content (preview, html, or text)${NC}"
  echo "   These emails will show 'No email content available' until body is fetched"
else
  echo -e "${GREEN}✅ All recent emails have at least preview content${NC}"
fi

echo ""
echo "2️⃣ Testing API endpoint..."

# Get a recent email ID
EMAIL_ID=$(psql "$DATABASE_URL" -t -c "
  SELECT id 
  FROM conversations 
  WHERE conversation_type = 'email' 
  ORDER BY created_at DESC 
  LIMIT 1;
" | tr -d ' ')

if [ -z "$EMAIL_ID" ]; then
  echo -e "${RED}❌ No emails found in database${NC}"
  exit 1
fi

echo "   Testing with email ID: $EMAIL_ID"

# Test API endpoint
API_RESPONSE=$(curl -s "http://localhost:3001/api/emails/$EMAIL_ID")

# Check if response contains preview or body
HAS_PREVIEW=$(echo "$API_RESPONSE" | jq -r '.data.preview // empty' | wc -c)
HAS_BODY=$(echo "$API_RESPONSE" | jq -r '.data.email_body // empty' | wc -c)

if [ "$HAS_PREVIEW" -gt 10 ] || [ "$HAS_BODY" -gt 10 ]; then
  echo -e "${GREEN}✅ API returns content (preview or body)${NC}"
  echo "   Preview length: $HAS_PREVIEW chars"
  echo "   Body length: $HAS_BODY chars"
else
  echo -e "${RED}❌ API returns NO content${NC}"
  echo "   Response: $(echo "$API_RESPONSE" | jq -r '.data | {preview, email_body, email_body_html, email_body_text}')"
fi

echo ""
echo "3️⃣ Recommendations:"
echo ""

if [ "$EMPTY_COUNT" -gt 0 ]; then
  echo -e "${YELLOW}📝 You have $EMPTY_COUNT emails without content.${NC}"
  echo "   These are likely from a sync that failed to fetch metadata."
  echo "   To fix:"
  echo "   1. Disconnect and reconnect your email account"
  echo "   2. Wait for sync to complete"
  echo "   3. Open each email to trigger lazy loading"
else
  echo -e "${GREEN}✅ All emails have content. The fix is working!${NC}"
fi

echo ""
echo "4️⃣ Next steps:"
echo "   1. Open your app at http://localhost:5173"
echo "   2. Navigate to Email Inbox"
echo "   3. Click on any email"
echo "   4. Check browser console for logs:"
echo "      - [useEmailWithBody] Fetched email: ..."
echo "      - [EmailBodyContent] Rendering with: ..."
echo "   5. Verify email content is displayed (not 'No email content available')"
echo ""

echo "✅ Test complete!"

