#!/bin/bash

# LinkedIn Webhook Test Script
# Tests the webhook endpoint locally and via ngrok

echo "🧪 LinkedIn Webhook Test Suite"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check if backend is running
echo "Test 1: Checking if backend is running on port 3001..."
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend is running${NC}"
else
    echo -e "${RED}✗ Backend is NOT running${NC}"
    echo "  Please start the backend with: cd Converso-backend && npm run dev"
    exit 1
fi
echo ""

# Test 2: Check webhook endpoint locally
echo "Test 2: Testing webhook endpoint locally..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3001/api/linkedin/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "type": "message.received",
    "chat_id": "test-chat-123",
    "account_id": "test-account-456",
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ]; then
    echo -e "${GREEN}✓ Webhook endpoint is accessible${NC}"
    echo "  Response: $BODY"
else
    echo -e "${RED}✗ Webhook endpoint returned error${NC}"
    echo "  HTTP Code: $HTTP_CODE"
    echo "  Response: $BODY"
fi
echo ""

# Test 3: Check SSE endpoint
echo "Test 3: Testing SSE endpoint..."
timeout 2 curl -s http://localhost:3001/api/events/stream > /tmp/sse_test.txt 2>&1
if grep -q "event: ping" /tmp/sse_test.txt; then
    echo -e "${GREEN}✓ SSE endpoint is working${NC}"
    echo "  Received: $(head -n1 /tmp/sse_test.txt)"
else
    echo -e "${YELLOW}⚠ SSE endpoint may not be working${NC}"
    echo "  Check backend logs"
fi
rm -f /tmp/sse_test.txt
echo ""

# Test 4: Check ngrok status
echo "Test 4: Checking ngrok tunnel..."
if curl -s http://localhost:4040/api/tunnels > /tmp/ngrok_status.json 2>&1; then
    NGROK_URL=$(cat /tmp/ngrok_status.json | grep -o '"public_url":"https://[^"]*"' | head -n1 | cut -d'"' -f4)
    if [ -n "$NGROK_URL" ]; then
        echo -e "${GREEN}✓ ngrok tunnel is active${NC}"
        echo "  Public URL: $NGROK_URL"
        echo ""
        echo "  📋 Webhook URL for Unipile:"
        echo "  ${NGROK_URL}/api/linkedin/webhook"
        echo ""
        
        # Test 5: Test webhook via ngrok
        echo "Test 5: Testing webhook via ngrok..."
        NGROK_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST ${NGROK_URL}/api/linkedin/webhook \
          -H "Content-Type: application/json" \
          -d '{
            "type": "message.received",
            "chat_id": "test-chat-123",
            "account_id": "test-account-456",
            "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
          }')
        
        NGROK_HTTP_CODE=$(echo "$NGROK_RESPONSE" | tail -n1)
        NGROK_BODY=$(echo "$NGROK_RESPONSE" | head -n-1)
        
        if [ "$NGROK_HTTP_CODE" = "200" ] || [ "$NGROK_HTTP_CODE" = "404" ]; then
            echo -e "${GREEN}✓ Webhook accessible via ngrok${NC}"
            echo "  Response: $NGROK_BODY"
        else
            echo -e "${RED}✗ Webhook NOT accessible via ngrok${NC}"
            echo "  HTTP Code: $NGROK_HTTP_CODE"
            echo "  Response: $NGROK_BODY"
        fi
    else
        echo -e "${YELLOW}⚠ ngrok is running but no tunnels found${NC}"
        echo "  Make sure ngrok is forwarding to port 3001"
    fi
    rm -f /tmp/ngrok_status.json
else
    echo -e "${YELLOW}⚠ ngrok is NOT running${NC}"
    echo "  Start ngrok with: ./start-webhook-tunnel.sh"
fi
echo ""

# Summary
echo "================================"
echo "📊 Test Summary"
echo "================================"
echo ""
echo "Next steps:"
echo "1. If all tests pass, update webhook URL in Unipile dashboard"
echo "2. Send a test LinkedIn message to verify end-to-end flow"
echo "3. Check browser console for: [SSE] Received linkedin_message event"
echo "4. Verify unread badge appears on conversation"
echo ""
echo "Troubleshooting:"
echo "- Backend logs: Check terminal running 'npm run dev' in Converso-backend"
echo "- Frontend logs: Check browser console (F12)"
echo "- ngrok logs: Check terminal running ngrok or visit http://localhost:4040"
echo ""





