#!/bin/bash

# Test Script for Automatic Intent Detection
# Run this after the backend is running

echo "🧪 Testing Automatic Intent Detection Implementation"
echo "=================================================="
echo ""

# Configuration
BACKEND_URL="http://localhost:3001"
WORKSPACE_ID="eaf12104-abe4-4518-9bb5-f598c2a22053"
CONVERSATION_ID="cd34714c-f3f6-378e-ee42-e7cb7618867d"

echo "📋 Test 1: Manual Intent Detection (Pricing Inquiry)"
echo "---------------------------------------------------"
curl -X POST "$BACKEND_URL/api/agents/detect-intent" \
  -H "Content-Type: application/json" \
  -d "{
    \"conversation_id\": \"$CONVERSATION_ID\",
    \"workspace_id\": \"$WORKSPACE_ID\",
    \"message_content\": \"Hi, I am interested in your product. How much does it cost per month?\",
    \"conversation_context\": {
      \"subject\": \"Pricing Question\",
      \"sender_name\": \"Test User\"
    }
  }"
echo -e "\n"

echo ""
echo "📋 Test 2: Manual Intent Detection (Demo Request)"
echo "---------------------------------------------------"
curl -X POST "$BACKEND_URL/api/agents/detect-intent" \
  -H "Content-Type: application/json" \
  -d "{
    \"conversation_id\": \"$CONVERSATION_ID\",
    \"workspace_id\": \"$WORKSPACE_ID\",
    \"message_content\": \"Can you show me a demo? I would love to see your platform in action.\"
  }"
echo -e "\n"

echo ""
echo "📋 Test 3: Get Latest Intent for Conversation"
echo "---------------------------------------------------"
curl -X GET "$BACKEND_URL/api/agents/intents/$CONVERSATION_ID/latest"
echo -e "\n"

echo ""
echo "📋 Test 4: Get All Intents for Workspace"
echo "---------------------------------------------------"
curl -X GET "$BACKEND_URL/api/agents/intents/workspace/$WORKSPACE_ID?limit=5"
echo -e "\n"

echo ""
echo "📋 Test 5: Check Agent Configuration"
echo "---------------------------------------------------"
curl -X GET "$BACKEND_URL/api/agents/config/$WORKSPACE_ID/intent_detection"
echo -e "\n"

echo ""
echo "=================================================="
echo "✅ Tests Complete!"
echo ""
echo "Next Steps:"
echo "1. Check console logs in your backend terminal"
echo "2. Look for: '✅ [Auto Intent] Lead-quality intent detected'"
echo "3. Verify database: SELECT * FROM conversation_intents ORDER BY detected_at DESC LIMIT 5;"
echo "4. Test with real email/LinkedIn message"
echo ""

